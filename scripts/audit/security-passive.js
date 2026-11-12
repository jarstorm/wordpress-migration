// Comprobaciones de seguridad PASIVAS (solo peticiones GET a recursos públicos, como cualquier visitante).
// No probar contraseñas, no enviar formularios, no hacer POST a xmlrpc ni escanear vulnerabilidades sin permiso escrito.
// No incluir en el informe los nombres de usuario encontrados: basta con el número.
(async () => {
  const f = async (u, o) => { try { return await fetch(u, o); } catch (e) { return { status: 'ERR', headers: new Headers(), text: async () => '' }; } };
  const o = {};
  const r = await f('/', { cache: 'no-store' });
  const h = (k) => r.headers.get(k);
  o.headers = {
    server: h('server'), poweredBy: h('x-powered-by'), cacheControl: h('cache-control'),
    hsts: !!h('strict-transport-security'), csp: !!h('content-security-policy'),
    xFrameOptions: h('x-frame-options'), xContentTypeOptions: h('x-content-type-options'),
    referrerPolicy: h('referrer-policy'), permissionsPolicy: !!h('permissions-policy'),
  };
  const users = await f('/wp-json/wp/v2/users');
  try { o.restUsersExposed = users.status === 200 ? (await users.json()).length : 0; } catch { o.restUsersExposed = 0; }
  o.authorRedirect = await f('/?author=1', { redirect: 'manual' }).then((x) => x.type === 'opaqueredirect' || x.redirected);
  o.readmeHtml = (await f('/readme.html')).status;
  o.wpLogin = (await f('/wp-login.php', { redirect: 'manual' })).status;
  o.xmlrpcGet = (await f('/xmlrpc.php')).status; // 405 = activo; 403/404 = bloqueado
  o.uploadsListing = await f('/wp-content/uploads/').then(async (x) => x.status === 200 && (await x.text()).includes('Index of'));
  const html = document.documentElement.outerHTML;
  o.generator = [...document.querySelectorAll('meta[name=generator]')].map((m) => m.content);
  o.versionParams = (html.match(/[?&]ver=[\d.]+/g) || []).length;
  o.httpLinks = [...document.querySelectorAll('a[href^="http:"]')].length;
  return JSON.stringify(o);
})();
