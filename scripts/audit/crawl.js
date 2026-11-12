// Rastreador de enlaces internos. Ejecutar en la portada del sitio (mismo origen).
// Guarda el resultado en window.__crawl; consultar con los snippets de abajo.
// Respetuoso: 4 peticiones simultáneas como máximo y límite de páginas.
window.__crawl = { pages: {}, ext: {}, done: false };
(async () => {
  const LIMIT = 250;
  const C = window.__crawl, origin = location.origin;
  const norm = (h) => { try { const u = new URL(h, origin); u.hash = ''; return u.href; } catch { return null; } };
  const skip = (u) => /wp-admin|wp-json|xmlrpc|\/feed\/?$|add-to-cart|wp-login|\/(carrito|cart|checkout|finalizar-compra|mi-cuenta|my-account)\b|\?replytocom|\.(jpe?g|png|webp|gif|pdf|zip|svg)$/i.test(u);
  const queue = [origin + '/'];
  const seen = new Set(queue);
  let active = 0;
  const worker = async () => {
    while (Object.keys(C.pages).length < LIMIT) {
      const url = queue.shift();
      if (!url) { if (active === 0) return; await new Promise((r) => setTimeout(r, 200)); continue; }
      active++;
      const t = performance.now();
      try {
        const r = await fetch(url, { cache: 'no-store' });
        const html = await r.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const p = (C.pages[url] = {
          s: r.status, final: r.url !== url ? r.url : undefined, ms: Math.round(performance.now() - t),
          title: (doc.title || '').slice(0, 80), kb: Math.round(html.length / 1024),
          h1: doc.querySelector('h1')?.textContent.trim().slice(0, 80) ?? null,
          desc: !!doc.querySelector('meta[name=description]'),
          price: !!doc.querySelector('.price'), addToCart: !!doc.querySelector('.single_add_to_cart_button,.add_to_cart_button'),
          links: [],
        });
        if (r.status < 400 && new URL(r.url).origin === origin) {
          for (const a of doc.querySelectorAll('a[href]')) {
            const h = norm(a.getAttribute('href'));
            if (!h || !/^https?:/.test(h)) continue;
            p.links.push(h);
            if (new URL(h).origin === origin) { if (!seen.has(h) && !skip(h)) { seen.add(h); queue.push(h); } }
            else C.ext[h] ??= { from: url, text: a.textContent.trim().slice(0, 40) };
          }
        }
      } catch (e) { C.pages[url] = { s: 'ERR', links: [] }; }
      active--;
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  C.queueLeft = queue.length;
  C.done = true;
})();
'iniciado';

/* ---- Consultas (ejecutar cuando window.__crawl.done === true) ----

// Resumen
const P = __crawl.pages; const u = Object.keys(P);
JSON.stringify({ pages: u.length, left: __crawl.queueLeft, status: u.reduce((a, k) => (a[P[k].s] = (a[P[k].s] || 0) + 1, a), {}) });

// Enlaces rotos y desde dónde
const bad = Object.keys(P).filter((k) => P[k].s >= 400 || P[k].s === 'ERR');
JSON.stringify(bad.map((b) => [b, P[b].s, Object.entries(P).filter(([, p]) => p.links.includes(b)).map(([k]) => k).slice(0, 3)]));

// SEO básico: sin descripción, sin H1, títulos repetidos, URLs raras
const ok = Object.entries(P).filter(([, p]) => p.s === 200);
const titles = {}; ok.forEach(([, p]) => (titles[p.title] = (titles[p.title] || 0) + 1));
JSON.stringify({ noDesc: ok.filter(([, p]) => !p.desc).length, noH1: ok.filter(([, p]) => !p.h1).map(([k]) => k),
  dupTitles: Object.entries(titles).filter(([, n]) => n > 1), oddSlugs: ok.filter(([k]) => /elementor-\d+|\?p=\d+|-\d+\/$/.test(k)).map(([k]) => k) });

// Enlaces externos (solo se puede saber si el servidor responde; http:// desde https falla siempre por contenido mixto)
*/
