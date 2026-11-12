# wordpress-migration

**Español** · [English](README.en.md)

Migración de la web de **Nortia Reformas** (`../wordpress-original`) a **Astro + WordPress headless**, y kit reutilizable para migrar otras webs WordPress de la misma forma.

- **WordPress no cambia**: el cliente sigue editando en el mismo panel. Solo se le instala un plugin pequeño (`headless-connector`) que expone el contenido.
- **Astro genera la web pública** como HTML estático: mismas URLs, imágenes optimizadas, sin PHP ni base de datos expuestos.

```
                        build (npm run build)
 ┌──────────────────────┐   /wp-json/headless/v1   ┌─────────────────┐    dist/   ┌──────────────────┐
 │ WordPress (panel)    │ ───────────────────────▶ │ Astro            │ ─────────▶ │ Hosting estático │ ◀── visitantes
 │ + headless-connector │                          │ (este repo)      │            │ / CDN            │
 └──────────────────────┘ ◀─────────────────────── └─────────────────┘            └──────────────────┘
          ▲  formularios y comentarios (REST)  ◀──────────────────────────────────────────┘
```

## Estructura

| Carpeta | Qué contiene |
| --- | --- |
| `wp-connector/headless-connector/` | Plugin de WordPress: rutas, entradas con bloques parseados, menús, ACF, SEO, comentarios, CORS y webhook de build |
| `astro/` | La web nueva |
| `astro/src/components/blocks/` | Renderizado de bloques de Gutenberg (genérico) |
| `astro/src/components/shortcodes/` | Shortcodes de plugins habituales (Contact Form 7) |
| `astro/src/site/` | **Todo lo específico del cliente**: plantillas, shortcodes, componentes propios y `config.ts` (botón de la cabecera y datos de contacto del pie) |
| `scripts/` | Instalación del conector, inventario, verificación de URLs y Lighthouse |
| `scripts/audit/` | Fragmentos para auditar cualquier web (métricas, seguridad pasiva, rastreo de enlaces) |
| `docs/` | Guías para personas y agentes: migración, auditoría y plantilla de informe (en inglés en `docs/en/`) |

## Puesta en marcha

### 1. WordPress original (sin cambios)

```bash
cd ../wordpress-original
docker compose up -d
docker compose run --rm wpcli sh /setup/setup.sh   # solo la primera vez
```

### 2. Instalar el conector en ese WordPress

```bash
cd ../wordpress-migration
./scripts/install-connector.sh
curl http://localhost:8080/wp-json/headless/v1/site   # debe devolver JSON
```

El script copia el plugin dentro del contenedor y lo activa con WP-CLI. No toca ningún fichero de `wordpress-original`.

### 3. Web en Astro

```bash
cd astro
cp .env.example .env      # WP_URL=http://localhost:8080
npm install
npm run dev               # http://localhost:4321, con recarga en caliente
npm run build             # genera dist/ (descarga y optimiza las imágenes)
npm run preview           # sirve dist/ en http://localhost:4321
```

### 4. Verificar

```bash
cd astro
npm run check-urls                                                  # todas las URLs de WordPress existen y no hay enlaces rotos
node ../scripts/inventory.mjs                                        # qué bloques, shortcodes y campos usa el sitio
node ../scripts/audit/lighthouse.mjs http://localhost:8080,http://localhost:4321 / /servicios/reforma-de-banos/ /contacto/
```

## Qué se ha migrado

| En WordPress | En Astro |
| --- | --- |
| Páginas jerárquicas, entradas, proyectos (CPT) | Mismas URLs (`/servicios/reforma-de-banos/`, `/proyectos/...`, `/%postname%/`) |
| Blog, archivo de proyectos, categorías, etiquetas, tipos de proyecto, autores | Listados con paginación (`/blog/page/2/`) |
| Bloques de Gutenberg | HTML de WordPress + componentes propios (Últimas entradas, shortcodes); imágenes a WebP con `srcset` |
| `[nortia_proyectos]`, `[nortia_equipo]` (mu-plugin) | Componentes nativos en `src/site/components/` |
| Ficha de proyecto y recuadro de servicio (filtro `the_content`) | Plantillas `src/site/templates/` con campos ACF |
| Contact Form 7 | Mismo formulario, enviado por `fetch` a la API de CF7 (sin su JavaScript) |
| Comentarios | Se muestran en el build; el formulario los envía a la API REST (moderación habitual) |
| Menús, logo, icono | Desde el conector |
| Yoast SEO | Título, descripción y schema por el conector; canonical, Open Graph, sitemap y robots en Astro |
| Cookie Notice | Banner propio sin dependencias |
| Wordfence, UpdraftPlus, Smush, Redirection, WP Mail SMTP… | Se quedan en WordPress; no afectan a la web pública |

## Resultados

Lighthouse móvil sobre la web de Astro (entorno de prueba, con el diseño nuevo y la tipografía incluida):

| Página | Rendimiento | Accesibilidad | Buenas prácticas | SEO | LCP | Peso total |
| --- | --- | --- | --- | --- | --- | --- |
| Inicio | 100 | 100 | 100 | 100 | 1,4 s | 69 KiB |
| Servicio (baños) | 100 | 100 | 100 | 100 | 0,8 s | 47 KiB |
| Proyecto | 100 | 100 | 100 | 100 | 1,4 s | 54 KiB |
| Entrada del blog | 100 | 100 | 100 | 100 | 1,4 s | 47 KiB |
| Contacto | 98 | 99 | 100 | 100 | 0,8 s | 47 KiB |
| Blog | 100 | 98 | 100 | 100 | 1,4 s | 80 KiB |

Para comparar con el WordPress original en tu máquina:

```bash
node scripts/audit/lighthouse.mjs http://localhost:8080,http://localhost:4321 / /servicios/reforma-de-banos/ /contacto/
```

## Diseño

Tokens de color, radios y sombras en `:root` de `astro/src/styles/global.css`; tipografía Plus Jakarta Sans variable (autoalojada, ~27 KB). Cabecera fija con desenfoque y botón de presupuesto, menú móvil a pantalla completa, cabecera de página con degradado, portada con hero a ancho completo y servicios en tarjetas, recuadro de precio destacado en los servicios y pie en tres columnas. Para otro cliente: cambia los tokens y `src/site/config.ts`.

## Pendiente / límites conocidos

- **Vista previa de borradores**: el sitio es estático; ver un borrador requiere un modo servidor (Astro SSR en una ruta `/preview`) o un entorno de staging. No implementado.
- **Publicación**: cada cambio en WordPress necesita un nuevo build. El conector llama a `headless_build_hook` al publicar o actualizar contenido, y al cambiar menús, categorías, ajustes del sitio o el estado de un comentario (configúralo con la URL de build de tu hosting o CI). Cambios solo en la Biblioteca de medios o en ajustes de plugins necesitan un build manual.
- **Correo de los formularios**: en local, Contact Form 7 responde `mail_failed` porque no hay servidor de correo; los mensajes quedan en Flamingo. En producción hay que configurar WP Mail SMTP.
- **Buscador**: la web original no tenía; si se necesita, añadir Pagefind al build.
- **RSS** (`/feed/`): no se genera. Añadir `@astrojs/rss` si el cliente lo usa.
- **Mapa de OpenStreetMap** (bloque HTML con iframe): se mantiene tal cual.
- **Página de autor sin entradas** (`/author/admin/`): WordPress la sirve y Astro no. Añadir una redirección 301 en el hosting.
