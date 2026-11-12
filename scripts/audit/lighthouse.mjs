#!/usr/bin/env node
/**
 * Lighthouse (móvil) sobre varias páginas y uno o dos sitios, con tabla en Markdown.
 * Sirve para auditar una web y para comparar WordPress original vs. Astro.
 *
 *   node scripts/audit/lighthouse.mjs https://cliente.es / /tienda/ /producto/x/
 *   node scripts/audit/lighthouse.mjs http://localhost:8080,http://localhost:4321 / /contacto/
 *
 * Requiere Chrome/Chromium (CHROME_PATH si no está en el PATH). Usa `npx lighthouse`.
 * Nota: PageSpeed Insights (pagespeed.web.dev) añade datos de usuarios reales (CrUX);
 * este script solo da datos de laboratorio, pero es repetible y sirve en local.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [bases, ...paths] = process.argv.slice(2);
if (!bases) {
  console.error('Uso: lighthouse.mjs <url-base[,url-base2]> [rutas...]');
  process.exit(1);
}
const dir = mkdtempSync(join(tmpdir(), 'lh-'));
const rows = [];
for (const base of bases.split(',')) {
  for (const p of paths.length ? paths : ['/']) {
    const out = join(dir, 'r.json');
    try {
      execFileSync('npx', ['-y', 'lighthouse', base.replace(/\/$/, '') + p, '--quiet', '--output=json', `--output-path=${out}`,
        '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --no-sandbox'], { stdio: 'ignore' });
      const d = JSON.parse(readFileSync(out, 'utf8'));
      const c = d.categories, a = d.audits;
      rows.push([base, p, ...['performance', 'accessibility', 'best-practices', 'seo'].map((k) => Math.round(c[k].score * 100)),
        a['first-contentful-paint'].displayValue, a['largest-contentful-paint'].displayValue, a['total-blocking-time'].displayValue,
        a['cumulative-layout-shift'].displayValue, `${Math.round(a['total-byte-weight'].numericValue / 1024)} KiB`]);
    } catch (e) {
      rows.push([base, p, 'error', '', '', '', '', '', '', '', '']);
    }
  }
}
console.log('| Sitio | Página | Rend. | Acces. | Buenas pr. | SEO | FCP | LCP | TBT | CLS | Peso |');
console.log('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
rows.forEach((r) => console.log(`| ${r.join(' | ')} |`));
