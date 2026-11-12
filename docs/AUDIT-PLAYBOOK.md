# Playbook para agentes: auditar una web y hacer el informe para el cliente

**Español** · [English](en/AUDIT-PLAYBOOK.md)

Cómo escanear una web (normalmente WordPress) y convertir los hallazgos en un informe comercial: rendimiento, diseño y conversión, enlaces, SEO técnico y seguridad. Ejemplo real: el informe de *conmdemujer.es* (tienda de libros con WooCommerce y Elementor).

**Objetivo del informe:** que el cliente entienda en 2 minutos qué le cuesta su web (ventas, visibilidad, riesgo) y qué propuestas hay, con números verificables. No es un informe técnico para desarrolladores.

---

## 0. Reglas (obligatorias)

1. **Solo comprobaciones pasivas** sin permiso escrito del titular: cargar páginas públicas y hacer peticiones GET a recursos públicos, como cualquier visitante. **Nunca:** probar contraseñas, enviar formularios, añadir productos al carrito, hacer POST a `xmlrpc.php`, escanear vulnerabilidades o puertos, ni acceder a `/wp-admin`.
2. **Rastreo respetuoso:** máximo 4 peticiones simultáneas y 250 páginas por pasada. Excluir carrito, pago, cuenta, feeds y `wp-admin`.
3. **Sin datos personales en el informe:** si la API expone usuarios, poner el número, no los nombres.
4. **Cada número con su fuente y fecha** (PageSpeed con enlace al informe, fecha del rastreo). Si algo no se ha podido comprobar, decirlo.
5. **No inventar impacto económico.** Sin analítica del cliente no se puede cuantificar cuánto subirían las ventas: decirlo así y explicar por qué las mejoras suelen ayudar.
6. **Precios como estimaciones** y sin IVA, antes de ver el panel.
7. **No suponer quién es el cliente** (género de la persona propietaria, tamaño de la empresa, etc.). Usar términos neutros: "el titular del sitio".

---

## 1. Herramientas

| Necesitas | Opción preferida | Alternativa |
| --- | --- | --- |
| Navegador | Claude in Chrome (extensión) para navegar, hacer capturas y ejecutar JS en la página | Playwright o Chrome headless en el entorno de trabajo |
| PageSpeed con datos de usuarios reales | `https://pagespeed.web.dev/analysis?url=<URL codificada>` en el navegador | API de PageSpeed Insights (requiere clave) |
| Lighthouse repetible | `node scripts/audit/lighthouse.mjs https://cliente.es / /tienda/ /producto/x/` | DevTools → Lighthouse |
| Métricas de una página | `scripts/audit/page-metrics.js` | — |
| Seguridad pasiva | `scripts/audit/security-passive.js` | — |
| Enlaces y SEO de todo el sitio | `scripts/audit/crawl.js` | Screaming Frog (si lo tiene el usuario) |

Los `.js` de `scripts/audit/` se pegan en la consola o se pasan a la herramienta de ejecutar JavaScript del navegador **con la web del cliente abierta** (mismo origen).

**Truco con Claude in Chrome:** las respuestas de JavaScript largas se cortan y las que contienen URLs con `?` o cookies pueden bloquearse. Devuelve resúmenes (`JSON.stringify` de recuentos, listas recortadas con `.slice(0, 10)`) y quita las query strings (`.replace(/\?.*/, '')`).

---

## 2. Proceso (60–90 minutos)

### Paso 1 — Crear el documento primero

Crea el informe con su esqueleto (ver `docs/REPORT-TEMPLATE.md`) antes de investigar, y ve rellenando cada sección según tengas datos. El usuario ve el progreso.

### Paso 2 — PageSpeed de las páginas clave

Ejecuta PageSpeed (móvil y escritorio) en:

- Portada.
- Página de listado principal (tienda, catálogo, servicios, blog).
- Una página de detalle (ficha de producto, servicio, artículo): **suele ser la peor y es donde se decide la compra**.
- Contacto (si tiene formulario o mapa).

Extrae con JS del informe de PageSpeed (pestaña visible):

```js
const rep = [...document.querySelectorAll('.lh-report')].filter(r => r.offsetParent !== null)[0];
const t = document.body.innerText, i = t.indexOf('Diagnose performance issues');
JSON.stringify({
  scores: t.slice(i, i + 90).replace(/\n+/g, ' | '),
  metrics: [...rep.querySelectorAll('.lh-metric')].map(x => x.querySelector('.lh-metric__title').textContent + ': ' + x.querySelector('.lh-metric__value').textContent),
  field: (t.match(/Core Web Vitals Assessment[\s\S]{0,350}/) || [''])[0].replace(/\n+/g, ' | '),
  opportunities: [...rep.querySelectorAll('.lh-audit--fail, .lh-audit--average')].map(a => a.querySelector('.lh-audit__title')?.textContent + ' — ' + (a.querySelector('.lh-audit__display-text')?.textContent || '')).slice(0, 15),
});
```

Si el bloqueo total (TBT) es alto, mira el detalle de "Reduce JavaScript execution time" y "third-party": suele haber un culpable concreto (en conmdemujer.es, un captcha que bloqueaba la ficha de producto 11 s).

Anota: puntuaciones, LCP, FCP, TBT, CLS, TTFB, si aprueba las Core Web Vitals de usuarios reales, y las 5 mayores oportunidades con su ahorro estimado. El análisis tarda 30–60 s; espera y reintenta la lectura si no hay métricas.

### Paso 3 — Tecnología y peso

En la portada, ejecuta `page-metrics.js`. Obtienes: tema, plugins visibles (por las rutas de sus ficheros), versión de WordPress y del maquetador, número de scripts y hojas de estilo, peso por tipo de recurso y tiempo de respuesta.

### Paso 4 — Seguridad pasiva

Ejecuta `security-passive.js` y traduce cada resultado a riesgo de negocio:

| Hallazgo | Cómo explicarlo | Gravedad |
| --- | --- | --- |
| `/wp-json/wp/v2/users` lista usuarios | Un atacante sabe con qué usuarios probar contraseñas | Media |
| `/wp-login.php` abierto | Objetivo de ataques automáticos de contraseñas | Media |
| `xmlrpc.php` responde 405 | Permite probar muchas contraseñas en una sola petición | Media |
| Versión visible (`generator`, `readme.html`, `?ver=`) | Facilita buscar vulnerabilidades conocidas de esa versión | Baja |
| Muchos plugins detectables | Los plugins son el origen de la mayoría de incidentes en WordPress | Media |
| Sin HSTS / CSP / X-Frame-Options / X-Content-Type-Options | Más exposición a suplantación y a inyección de scripts | Baja |
| Listado de `/wp-content/uploads/` | Cualquiera puede ver todos los ficheros subidos | Media |

Aclara siempre que no hay vulnerabilidades confirmadas y que una auditoría completa requiere permiso.

### Paso 5 — Rastreo de enlaces y SEO técnico

1. En la portada, ejecuta `crawl.js` (tarda 1–3 minutos para 250 páginas).
2. Consulta cada 30 s con el resumen del final del fichero hasta que `done` sea `true`.
3. Obtén: estados HTTP, **enlaces rotos y desde qué página**, páginas sin metadescripción, sin H1, títulos repetidos, URLs con nombres sin sentido (`/elementor-1234/`, `?p=123`) y tiempos de respuesta.
4. Enlaces externos: desde el navegador solo se sabe si el servidor responde; los `http://` fallan siempre por contenido mixto. Indícalo como "no comprobado".
5. Si quedan URLs sin revisar (límite alcanzado), dilo y di de qué tipo son.

### Paso 6 — Diseño y conversión (revisión como cliente)

Haz capturas a 1400 px y a 390 px de ancho de portada, listado y detalle, y revisa con esta lista según el tipo de web:

**Todas**
- ¿Se entiende en 5 segundos qué vende y a quién? ¿Hay un titular y un botón de acción visible sin hacer scroll?
- Menú: ¿cuántas opciones? ¿La principal (tienda, servicios, pedir cita) es la primera y se llama así?
- ¿Cabecera gigante que empuja el contenido en todas las páginas?
- Tipografías y estilos de botón coherentes; ¿se ve anticuado? (tema por defecto antiguo, maquetador encima).
- Idioma mezclado (botones en inglés), formatos de precio y fecha incorrectos.
- Contacto visible (teléfono, WhatsApp, formulario).

**Tienda online**
- Portada: ¿productos con precio y botón de compra? ¿Novedades, más vendidos, buscador y carrito visibles?
- Listado: categorías, filtros, ordenación, productos por fila, primer producto visible sin scroll.
- Ficha: precio, botón visible sin scroll, envío y plazos, datos clave del producto (en libros: ISBN, páginas, encuadernación), valoraciones, productos relacionados, pago rápido.

**Servicios / empresa local**
- Propuesta de valor, prueba social (opiniones, casos), precios orientativos o "desde", formulario corto, zona de trabajo.

Con JS se puede contar lo que hay en la portada:

```js
JSON.stringify({
  prices: (document.body.innerText.match(/\d+[,.]\d{2}\s?€|€\s?\d+[,.]\d{2}/g) || []).length,
  addToCart: document.querySelectorAll('.add_to_cart_button, .single_add_to_cart_button').length,
  buttons: [...document.querySelectorAll('.elementor-button, .wp-block-button a, a.button, button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 15),
  search: !!document.querySelector('input[type=search]'),
  h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()),
  menu: [...document.querySelectorAll('nav a')].map(a => a.textContent.trim()).filter(Boolean).slice(0, 20),
  height: document.body.scrollHeight,
});
```

### Paso 7 — Propuesta

Siempre **dos opciones**, de menor a mayor:

- **A. Optimizar lo que hay** (2–4 días): imágenes, caché, quitar scripts donde no hacen falta, arreglar enlaces rotos, textos y formatos, endurecer la seguridad. Barata y rápida.
- **B. Migrar a Astro + WordPress headless** (con rediseño si hay maquetador): rendimiento de 95–100, WordPress oculto, mismas URLs. Más cara; el cliente sigue editando igual.

Si hay WooCommerce, en la opción B carrito, pago y pedidos **se quedan en WordPress** (ver `MIGRATION-PLAYBOOK.md` §9) e incluye la tabla "qué se queda / qué cambia" plugin a plugin.

Precios orientativos (tarifa de referencia: 500 €/día, sin IVA):

| Trabajo | Días | Precio |
| --- | --- | --- |
| Auditoría como servicio | 0,5–1 | 300–500 € |
| Opción A, web corporativa | 2–4 | 900–1.800 € |
| Opción B, web corporativa con Gutenberg | 5–7 | 2.500–3.500 € |
| Opción B, con maquetador o multidioma | 10–15 | 5.000–7.500 € |
| Opción B, tienda (escaparate en Astro, pago en WooCommerce) | 15–25 | 7.500–12.500 € |
| Mantenimiento (hosting de ambos, actualizaciones, builds, pequeños cambios) | — | 90–250 €/mes |

### Paso 8 — Revisar antes de entregar

- [ ] Cada cifra coincide con su fuente (abre el informe de PageSpeed y compruébalo).
- [ ] Ninguna afirmación sin comprobar presentada como hecho (externos, plugins invisibles, ventas).
- [ ] Sin nombres de usuario ni datos personales.
- [ ] El resumen se entiende sin leer el resto.
- [ ] Cierra las pestañas del navegador que hayas abierto.

---

## 3. Estructura del informe

Ver `docs/REPORT-TEMPLATE.md`. Orden: Resumen → Rendimiento → Análisis técnico → Diseño y conversión → Enlaces y páginas → Rendimiento de páginas clave → Seguridad → Propuesta (con "qué cambia") → Metodología y limitaciones → Fuentes.

Estilo:

- La primera frase de cada sección es la conclusión, con su número ("La ficha de libro es la página más lenta: 30/100 en móvil").
- Tablas para comparar; listas para hallazgos paralelos; frases cortas.
- Lenguaje de negocio: "el cliente tarda 3 s en ver el producto", no "LCP elevado" sin explicar.
- Sin adjetivos vacíos ("increíble", "desastroso"). Los números hablan.
