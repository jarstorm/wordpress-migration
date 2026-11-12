#!/usr/bin/env node
/**
 * Inventario de un WordPress con el conector instalado: qué hay que migrar.
 * Lista tipos de contenido, plugins activos, bloques de Gutenberg usados,
 * shortcodes, campos ACF y plantillas, con el número de usos de cada uno.
 *
 * Uso: WP_URL=http://localhost:8080 node scripts/inventory.mjs [> inventario.md]
 */
const WP_URL = (process.env.WP_URL || 'http://localhost:8080').replace(/\/$/, '');
const TOKEN = process.env.WP_API_TOKEN;
const api = async (p) => {
  const r = await fetch(`${WP_URL}/wp-json/headless/v1${p}`, { headers: TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {} });
  if (!r.ok) throw new Error(`${r.status} en ${p}. ¿Está activo headless-connector?`);
  return r.json();
};

const site = await api('/site');
const { routes } = await api('/routes');
const menus = await api('/menus');

const count = (map, key, where) => {
  const e = map.get(key) ?? { n: 0, where: new Set() };
  e.n++;
  if (where && e.where.size < 3) e.where.add(where);
  map.set(key, e);
};
const blocks = new Map();
const shortcodes = new Map();
const acf = new Map();
const templates = new Map();
let classic = 0;

const walk = (list, path) => {
  for (const b of list ?? []) {
    count(blocks, b.name, path);
    for (const s of b.shortcodes ?? []) count(shortcodes, s.tag, path);
    walk(b.innerBlocks, path);
  }
};

const singles = routes.filter((r) => r.kind === 'single');
for (const r of singles) {
  const e = await api(`/entry/${r.id}`);
  if (e.blocks) walk(e.blocks, r.path);
  else classic++;
  // Shortcodes en contenido clásico o dentro de párrafos.
  for (const [, tag] of (e.content ?? '').matchAll(/\[([a-z0-9_\-]+)[\s\]]/gi)) count(shortcodes, `${tag} (en HTML)`, r.path);
  for (const k of Object.keys(e.acf ?? {})) count(acf, `${e.type}.${k}`, r.path);
  if (e.template) count(templates, e.template, r.path);
}

const table = (title, map) => {
  console.log(`\n## ${title}\n`);
  if (!map.size) return console.log('_Ninguno._');
  console.log('| Elemento | Usos | Ejemplos |\n| --- | --- | --- |');
  [...map.entries()].sort((a, b) => b[1].n - a[1].n).forEach(([k, v]) => console.log(`| \`${k}\` | ${v.n} | ${[...v.where].join(', ')} |`));
};

console.log(`# Inventario de ${site.name}\n`);
console.log(`- WordPress: ${WP_URL}`);
console.log(`- Idioma: ${site.language} · Enlaces permanentes: \`${site.permalink_structure}\` · Entradas por página: ${site.posts_per_page}`);
console.log(`- Portada: ${site.show_on_front === 'page' ? `página ${site.front_page}` : 'últimas entradas'} · Blog: ${site.posts_page?.path ?? '—'}`);
console.log(`- Tipos de contenido: ${site.post_types.join(', ')}`);
console.log(`- Plugins activos (${site.plugins.length}): ${site.plugins.join(', ')}`);
console.log(`- Menús: ${Object.entries(menus.locations).map(([l, s]) => `${l} → ${s}`).join(', ') || 'sin ubicaciones'}`);

const byKind = new Map();
for (const r of routes) count(byKind, r.kind === 'single' ? `single:${r.type}` : `archive:${r.archive}${r.taxonomy ? `:${r.taxonomy}` : ''}`);
table('URLs por tipo', byKind);
table('Bloques de Gutenberg', blocks);
table('Shortcodes', shortcodes);
table('Campos ACF', acf);
table('Plantillas de página', templates);
console.log(`\nEntradas sin bloques (editor clásico o maquetador): ${classic} de ${singles.length}`);
