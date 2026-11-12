// Métricas de la página actual. Pegar en la consola (o javascript_tool) con la página ya cargada.
// Devuelve: tiempo de respuesta, peso por tipo de recurso, nº de scripts/estilos, plugins y tema detectados.
(() => {
  const n = performance.getEntriesByType('navigation')[0];
  const rs = performance.getEntriesByType('resource');
  const by = {};
  const hosts = {};
  let total = n.transferSize || 0;
  for (const r of rs) {
    const s = r.transferSize || r.encodedBodySize || 0;
    total += s;
    (by[r.initiatorType] ??= [0, 0])[0]++;
    by[r.initiatorType][1] += Math.round(s / 1024);
    try { const h = new URL(r.name).host; hosts[h] = (hosts[h] || 0) + 1; } catch {}
  }
  const html = document.documentElement.outerHTML;
  const uniq = (re) => [...new Set([...html.matchAll(re)].map((m) => m[1]))];
  return JSON.stringify({
    url: location.href,
    ttfbMs: Math.round(n.responseStart - n.requestStart),
    loadMs: Math.round(n.loadEventEnd),
    requests: rs.length + 1,
    totalKB: Math.round(total / 1024),
    htmlKB: Math.round(html.length / 1024),
    byType: by, // [peticiones, KB] — "css" incluye imágenes y fuentes cargadas desde CSS
    hosts,
    externalScripts: [...document.scripts].filter((s) => s.src).length,
    inlineScripts: [...document.scripts].filter((s) => !s.src).length,
    stylesheets: document.querySelectorAll('link[rel=stylesheet]').length,
    inlineStyleKB: Math.round([...document.querySelectorAll('style')].reduce((a, s) => a + s.textContent.length, 0) / 1024),
    images: document.images.length,
    generator: [...document.querySelectorAll('meta[name=generator]')].map((m) => m.content),
    theme: uniq(/wp-content\/themes\/([a-z0-9\-_]+)/g),
    plugins: uniq(/wp-content\/plugins\/([a-z0-9\-_]+)/g),
    flags: { jquery: !!window.jQuery, elementor: !!window.elementorFrontend, woocommerce: /woocommerce/.test(html), jetpack: /jetpack/.test(html) },
    h1: [...document.querySelectorAll('h1')].map((h) => h.textContent.trim().slice(0, 80)),
    title: document.title,
    metaDescription: document.querySelector('meta[name=description]')?.content ?? null,
  });
})();
