# Playbook: migrar una web WordPress a Astro + WordPress headless

Guía paso a paso para que una persona o un agente de IA migre **otra** web WordPress con este kit. El ejemplo resuelto es Nortia Reformas (`../wordpress-original` → `astro/`).

**Resultado esperado:** el cliente sigue editando en su WordPress; la web pública es HTML estático generado por Astro, con las **mismas URLs**, el mismo contenido y rendimiento de 90–100 en móvil.

---

## 0. Antes de empezar: qué pedir y qué decidir

**Pedir al cliente:**

- Acceso de administrador a WordPress (o una copia: backup de UpdraftPlus, Duplicator o volcado SQL + `wp-content/uploads`).
- Acceso al hosting y al DNS (para el despliegue y el cambio de dominio).
- Qué partes de la web edita y con qué frecuencia (decide si hace falta vista previa y build automático).
- Formularios: a qué correo llegan y si usan un CRM.

**Decidir con el cliente (si no, no se empieza):**

| Situación | Decisión |
| --- | --- |
| Tienda WooCommerce | Carrito, pago, pedidos y cuenta **se quedan en WordPress** (subdominio `tienda.`). Astro solo genera catálogo y fichas, si compensa. Ver §9. |
| Maquetador (Elementor, Divi, WPBakery) | El diseño **no se migra, se rehace** en Astro. Presupuestar como rediseño. El texto sí se reutiliza. |
| Multidioma (WPML, Polylang) | Rutas por idioma y `hreflang`. Aumenta el esfuerzo un 30–50 %. |
| Áreas privadas, socios, LMS, foros | No son candidatas a estático. Dejar en WordPress o descartar la migración. |
| Contenido que cambia cada pocos minutos | Valorar Astro en modo servidor (SSR) en vez de estático. |

---

## 1. Entorno local con una copia de la web

1. Levanta un WordPress en Docker como `../wordpress-original` (mismo `docker-compose.yml`).
2. Importa la copia del cliente:
   ```bash
   docker compose run --rm wpcli wp db import /ruta/backup.sql
   docker compose run --rm wpcli wp search-replace 'https://cliente.es' 'http://localhost:8080' --all-tables
   # copia wp-content/uploads, plugins y temas al volumen del contenedor (docker cp)
   ```
3. Si la web va lenta en local, ejecuta `setup/diagnostico.sh` de `wordpress-original`: suele ser un plugin de seguridad (Wordfence) que hace peticiones de red que fallan. Desactívalo en local.
4. Instala el conector: `ORIGINAL=/ruta/al/wordpress ./scripts/install-connector.sh`.
5. Comprueba: `curl http://localhost:8080/wp-json/headless/v1/routes`.

---

## 2. Inventario: qué hay que migrar

```bash
WP_URL=http://localhost:8080 node scripts/inventory.mjs > docs/inventario-CLIENTE.md
docker compose run --rm wpcli wp plugin list --status=active
docker compose run --rm wpcli wp theme list
```

El inventario lista: URLs por tipo, plugins activos, **bloques de Gutenberg usados** (con número de usos y ejemplos), **shortcodes**, **campos ACF** y plantillas de página.

Revisa además a mano:

- `functions.php` del tema hijo y `wp-content/mu-plugins/`: shortcodes, filtros `the_content`, tipos de contenido a medida.
- Widgets de barra lateral y pie (`wp widget list`), que el conector no expone.
- Redirecciones (plugin Redirection: `wp redirection export` o su tabla) y `.htaccess`.
- Ajustes SEO globales (Yoast: separador de títulos, organización, redes sociales).
- Scripts de terceros en cabecera o pie (analítica, píxeles, chat).

### Clasifica cada plugin

| Plugin (ejemplos) | Qué hacer |
| --- | --- |
| ACF, Yoast/Rank Math, CPT UI | **Se queda en WordPress**; el conector expone sus datos. |
| Contact Form 7 | Se queda; Astro envía el formulario a su API (`ContactForm7.astro`). |
| WPForms, Gravity Forms, Elementor Forms | Sustituir por CF7 o por un servicio externo (Formspree, Netlify Forms) o crear un componente que envíe a su API REST. |
| Wordfence, UpdraftPlus, WP Mail SMTP, Smush, caché | Se quedan; no afectan a la web pública. Los de caché sobran. |
| Cookie banner (Cookie Notice, Complianz…) | Sustituir por `CookieBanner.astro` (o la solución del cliente si tiene CMP con IAB TCF). |
| Elementor, Divi, WPBakery, page builders | Desaparecen de la parte pública: se rehace el diseño. |
| Sliders, galerías, lightbox | Componente Astro propio, o el HTML renderizado si basta. |
| Jetpack | Analítica → herramienta propia; CDN de imágenes → Astro; formularios → CF7 o externo. |
| Botones de WhatsApp, redes, chat | Componente propio (un enlace o el script del proveedor). |
| WooCommerce | Ver §9. |

---

## 3. Preparar el proyecto Astro

1. Copia `astro/` a la nueva carpeta del cliente (o crea una rama).
2. **Vacía `src/site/`** y vuelve a crear `shortcodes.ts` y `templates.ts` con los exports vacíos:
   ```ts
   export const siteShortcodes: Record<string, any> = {};
   export function siteTemplate(entry) { return null; }
   ```
3. `.env`: `WP_URL` (WordPress) y `SITE_URL` (dominio final).
4. `npm install && npm run build`. Con el código genérico ya deberían salir todas las URLs; lo que falte se ve en la siguiente fase.

### Cómo funciona el renderizado (no cambiar sin motivo)

- `src/pages/[...slug].astro` crea una página por cada ruta de `/headless/v1/routes` (entradas, páginas, CPT, archivos y paginación).
- `src/components/blocks/Block.astro` pinta cada bloque así:
  1. Si hay componente en `blocks/registry.ts` → componente.
  2. Si es un contenedor estático con bloques hijos (columns, group…) → recorre `innerContent` y pinta los hijos (así funcionan los shortcodes dentro de columnas).
  3. Si no → el HTML que generó WordPress (`rendered`).
- **Todas** las `<img>` de `/wp-content/` se descargan en el build y se convierten a WebP con `srcset` (`src/lib/images.ts`).
- Los enlaces internos llegan ya relativos desde el conector.

---

## 4. Implementar lo específico del sitio

Todo lo del cliente va en `src/site/`; lo reutilizable, en `src/components/`.

| Elemento del inventario | Dónde se implementa |
| --- | --- |
| Shortcode propio (`[tienda_destacados]`) | Componente en `src/site/components/` + registro en `src/site/shortcodes.ts`. Recibe los atributos como props y `shortcode` (con `rendered` como alternativa). |
| Shortcode de un plugin habitual | `src/components/shortcodes/` + `registry.ts` (reutilizable en otros clientes). |
| Bloque dinámico o de plugin que no se ve bien con su HTML | Componente en `src/components/blocks/` + `registry.ts`. |
| Filtro `the_content` o plantilla PHP con campos ACF | Plantilla en `src/site/templates/` que envuelve `SingleTemplate` con los slots `before` y `after`; se elige en `src/site/templates.ts`. |
| Tipo de contenido no público (equipo, testimonios) | `getList('tipo')` del conector (no requiere que sea público). |
| Diseño | `src/styles/global.css` (variables en `:root`) y los componentes `Header`, `Footer`, `PostCard`. |

**Regla:** si el HTML de WordPress de un bloque se ve bien con el CSS, no hagas componente. Haz componente solo para lógica (datos de otras entradas), imágenes críticas o cuando el HTML dependa de CSS/JS del plugin.

### CSS de bloques

WordPress genera clases de bloque (`wp-block-columns`, `wp-block-cover`, `is-layout-flex`…) y estilos en línea que en Astro no existen. `global.css` cubre los bloques del núcleo habituales. Para cada bloque nuevo del inventario, comprueba cómo se ve y añade su CSS.

---

## 5. Paridad SEO (no se puede perder posicionamiento)

- [ ] `npm run check-urls` sin errores: cada URL del sitemap de WordPress existe en `dist/`.
- [ ] Títulos y descripciones iguales a los de Yoast/Rank Math (compara 5–10 páginas con `curl -s URL | grep -E '<title>|description'`).
- [ ] `canonical` apunta al dominio final (`SITE_URL`).
- [ ] Redirecciones del plugin Redirection y `.htaccess` trasladadas al hosting (`_redirects` en Netlify/Cloudflare Pages, `redirects` en `astro.config.mjs` o reglas de nginx).
- [ ] URLs que cambian a propósito (p. ej. `/elementor-3101/` → `/aviso-legal/`): redirección 301.
- [ ] `/feed/`, `/wp-sitemap.xml` y `/sitemap_index.xml`: redirigir a `/sitemap-index.xml` o generar RSS.
- [ ] `robots.txt` y `sitemap-index.xml` correctos.
- [ ] Datos estructurados: el schema de Yoast llega con las URLs reescritas; valida 2–3 páginas en el test de resultados enriquecidos de Google.
- [ ] Etiquetas y autores marcados `noindex` (como hace este kit) solo si el cliente ya lo tenía así en Yoast.

---

## 6. Formularios, comentarios y búsqueda

- **Contact Form 7:** funciona tal cual. Configura `headless_frontend_origin` con el dominio final (CORS). Prueba un envío real en staging: debe devolver `mail_sent`.
- **Comentarios:** se publican vía REST si `headless_allow_comments` = 1. Si el cliente no los usa, desactívalos en WordPress y desaparece el formulario.
- **Búsqueda:** añadir [Pagefind](https://pagefind.app) en el build si la web original tenía buscador.

---

## 7. QA antes de entregar

```bash
cd astro && npm run build && npm run check-urls
node ../scripts/audit/lighthouse.mjs https://cliente.es,http://localhost:4321 / /pagina-clave/ /entrada/ /contacto/
```

- [ ] Lighthouse móvil ≥ 90 en rendimiento y ≥ 95 en el resto, en las páginas clave.
- [ ] Revisión visual en escritorio (1400 px) y móvil (390 px) de cada plantilla: portada, página, entrada, archivo, CPT, contacto, 404.
- [ ] Menú móvil, submenús con teclado, enlace "Saltar al contenido".
- [ ] Formulario: validación (campos vacíos), envío correcto y mensaje.
- [ ] Ninguna URL de WordPress en el HTML salvo las APIs de formularios y comentarios: `grep -r "WP_HOST" dist --include=*.html`.
- [ ] Banner de cookies: aparece, recuerda la elección y no carga analítica sin aceptar.
- [ ] Comparativa de rendimiento antes/después guardada para el cliente.

---

## 8. Despliegue

1. **Hosting estático** para `dist/`: Cloudflare Pages, Netlify, Vercel o nginx. Configura las variables `WP_URL` y `SITE_URL` y el comando `cd astro && npm ci && npm run build`.
2. **WordPress pasa a un subdominio** (`cms.cliente.es` o `panel.cliente.es`):
   - `wp search-replace` del dominio antiguo al nuevo subdominio.
   - Deja accesibles: `/wp-admin` (idealmente restringido por IP o con 2FA), `/wp-json/headless/v1` (puede protegerse con `headless_api_token` si el build corre en un CI con el token), `/wp-json/contact-form-7/`, `/wp-json/wp/v2/comments` y `/wp-content/uploads` (enlaces a PDF y otros ficheros).
   - Bloquea `xmlrpc.php` y la enumeración de usuarios (`/wp-json/wp/v2/users`).
   - Marca el subdominio como `noindex` (Ajustes → Lectura) para que Google no lo indexe.
3. **Build automático:** pon la URL del *build hook* del hosting en WordPress: `wp option update headless_build_hook https://...`. Cada publicación lanza un build (1–3 minutos). Si hay entradas programadas, añade un build diario en el CI.
4. **Cambio de DNS** del dominio principal al hosting estático. Mantén el WordPress antiguo intacto una semana para volver atrás.
5. Tras el cambio: Search Console (enviar el sitemap nuevo y vigilar errores 404 durante 2–4 semanas).

---

## 9. WooCommerce

- **Se queda en WordPress:** carrito, pago, pasarelas (WooCommerce Payments, Stripe, Redsys), cuenta del cliente, pedidos, stock, envíos y puntos de recogida.
- **Puede ir a Astro:** catálogo, categorías y fichas de producto, leídos con la Store API de WooCommerce (`/wp-json/wc/store/v1/products`), que es pública.
- **Botón "Añadir al carrito":** enlace a `https://tienda.cliente.es/?add-to-cart=ID` o llamada a la Store API (`/wc/store/v1/cart/add-item`), que exige la cabecera `Nonce` y las cookies de sesión de la tienda: hay que obtenerlos primero y servir tienda y web bajo el mismo dominio. El enlace es mucho más sencillo y suele bastar.
- **Stock y precios** cambian a menudo: build en cada cambio de producto (`headless_build_hook`) o fichas en modo servidor (SSR).
- Si la tienda es el 80 % de la web, puede no compensar: valora optimizar WordPress o pasar a Shopify.

---

## 10. Problemas conocidos y soluciones

| Problema | Solución |
| --- | --- |
| Una página no sale en el build | No está publicada, su tipo no tiene `show_in_rest`, o es la página de entradas (se trata como archivo). Revisa `/headless/v1/routes`. |
| Bloque que se ve "roto" | Le falta CSS (clases `wp-block-*`, `is-layout-*`) o depende de JS del plugin. Añade CSS o un componente. |
| Shortcode sin procesar (`[algo]` en el texto) | El plugin que lo define no está activo en el WordPress del build. |
| Imágenes que no se optimizan | Están en CSS (fondos) o en otro dominio. Muévelas a un bloque de imagen o añade el dominio a `image.remotePatterns`. |
| El build tarda mucho | Muchas imágenes grandes: la primera vez se procesan todas; luego Astro las cachea en `node_modules/.astro`. Conserva esa caché en el CI. |
| `WordPress respondió 401` | `headless_api_token` está definido y falta `WP_API_TOKEN` en `.env`. |
| Formulario con error de CORS | `headless_frontend_origin` no incluye el dominio desde el que se envía. |
| Web local de WordPress muy lenta | Ver `wordpress-original/setup/diagnostico.sh` (suele ser Wordfence). |
| Contenido de Elementor | `content` trae el HTML final, pero con clases y CSS de Elementor que no existen en Astro. No intentar reproducirlo: rediseñar. |
