export function formatDate(iso: string, locale = 'es-ES') {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date(iso));
}

/** Ruta de la página N de un archivo: /blog/ -> /blog/page/2/ */
export function pagePath(base: string, page: number) {
  return page <= 1 ? base : `${base.replace(/\/$/, '')}/page/${page}/`;
}
