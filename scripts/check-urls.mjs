#!/usr/bin/env node
/**
 * Verifica que la web estática no pierde ninguna URL de WordPress.
 *
 * 1. Lee los sitemaps de WordPress (core /wp-sitemap.xml, Yoast /sitemap_index.xml
 *    o Rank Math) y la lista de rutas del conector (/wp-json/headless/v1/routes).
 * 2. Comprueba que cada ruta existe en astro/dist (como carpeta/index.html).
 * 3. Recorre los enlaces internos de todo el HTML generado y detecta enlaces rotos.
 *
 * Uso (desde astro/):  WP_URL=http://localhost:8080 npm run check-urls
 * Sale con código 1 si falta alguna URL o hay enlaces rotos.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const WP_URL = (process.env.WP_URL || (await envFromFile('WP_URL')) || 'http://localhost:8080').replace(/\/$/, '');
const DIST = resolve(process.argv[2] || 'dist');

async function envFromFile(key) {
  try {
    const txt = await readFile('.env', 'utf8');
    return txt.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
  } catch {
    return undefined;
  }
}

async function text(url) {
  const r = await fetch(url);
  return r.ok ? r.text() : null;
}

async function sitemapPaths() {
  const found = new Set();
  const queue = [`${WP_URL}/wp-sitemap.xml`, `${WP_URL}/sitemap_index.xml`];
  const seen = new Set();
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const xml = await text(url);
    if (!xml) continue;
    for (const [, loc] of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
      if (/\.xml(\?|$)/.test(loc)) queue.push(loc);
      else if (loc.startsWith(WP_URL)) found.add(new URL(loc).pathname);
    }
  }
  return found;
}

async function connectorPaths() {
  try {
    const r = await fetch(`${WP_URL}/wp-json/headless/v1/routes`);
    const json = await r.json();
    return new Set(json.routes.map((x) => x.path));
  } catch {
    return new Set();
  }
}

async function exists(path) {
  const clean = decodeURIComponent(path.split('?')[0].split('#')[0]);
  const candidates = [join(DIST, clean, 'index.html'), join(DIST, clean)];
  for (const c of candidates) {
    try {
      if ((await stat(c)).isFile()) return true;
    } catch {}
  }
  return false;
}

async function* htmlFiles(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* htmlFiles(p);
    else if (e.name.endsWith('.html')) yield p;
  }
}

const expected = new Set([...(await sitemapPaths()), ...(await connectorPaths())]);
// Las páginas del sitemap de usuarios/attachments pueden no tener equivalente: se informan aparte.
const missing = [];
for (const p of [...expected].sort()) if (!(await exists(p))) missing.push(p);

const broken = new Map();
let files = 0;
for await (const file of htmlFiles(DIST)) {
  files++;
  const html = await readFile(file, 'utf8');
  for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    if (!(await exists(href))) {
      const from = file.replace(DIST, '').replace(/index\.html$/, '');
      if (!broken.has(href)) broken.set(href, new Set());
      broken.get(href).add(from);
    }
  }
}

console.log(`URLs de WordPress comprobadas: ${expected.size}`);
console.log(`Páginas HTML generadas: ${files}`);
if (missing.length) {
  console.log(`\n✗ ${missing.length} URL(s) de WordPress sin página en Astro:`);
  missing.forEach((p) => console.log(`  ${p}`));
} else console.log('✓ Todas las URLs de WordPress existen en la web nueva.');
if (broken.size) {
  console.log(`\n✗ ${broken.size} enlace(s) interno(s) roto(s):`);
  for (const [href, from] of broken) console.log(`  ${href}  (en ${[...from].slice(0, 3).join(', ')}${from.size > 3 ? '…' : ''})`);
} else console.log('✓ Ningún enlace interno roto.');
process.exit(missing.length || broken.size ? 1 : 0);
