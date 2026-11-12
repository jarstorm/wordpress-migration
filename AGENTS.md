# Instrucciones para agentes

Repositorio de migraciones **WordPress → Astro + WordPress headless** y de **auditorías web** para clientes. Idioma de trabajo y de la documentación: español.

## Qué hay aquí

- `wp-connector/headless-connector/` — plugin PHP que se instala en el WordPress del cliente. Endpoints en `/wp-json/headless/v1`: `site`, `menus`, `routes`, `entry/{id}`, `list/{type}`, `term/{tax}/{id}`.
- `astro/` — web estática. Genérico en `src/components`, `src/templates`, `src/lib`; **específico del cliente solo en `src/site/`**.
- `scripts/` — `install-connector.sh`, `inventory.mjs`, `check-urls.mjs`; `scripts/audit/` para auditorías.
- `docs/MIGRATION-PLAYBOOK.md` — **léelo antes de migrar una web**.
- `docs/AUDIT-PLAYBOOK.md` y `docs/REPORT-TEMPLATE.md` — **léelos antes de auditar una web o escribir un informe**.

El WordPress de ejemplo está en `../wordpress-original` y **no se modifica**: el conector se instala con `scripts/install-connector.sh`.

## Comandos

```bash
./scripts/install-connector.sh                 # conector en el WordPress de ../wordpress-original
cd astro && npm install
npm run dev                                    # desarrollo
npm run build                                  # build estático (necesita WordPress arrancado)
npm run check-urls                             # paridad de URLs y enlaces rotos (tras el build)
node ../scripts/inventory.mjs                  # bloques, shortcodes y ACF usados
node ../scripts/audit/lighthouse.mjs <base[,base2]> <rutas...>
```

## Reglas

- Las URLs públicas no cambian. Si una tiene que cambiar, añade una redirección 301.
- No dupliques lógica genérica dentro de `src/site/`; si sirve para otros clientes, va en `src/components/` y se registra en el `registry.ts` correspondiente.
- Antes de crear un componente para un bloque, comprueba si su HTML de WordPress se ve bien con CSS (`src/styles/global.css`).
- Datos del cliente que no vienen de WordPress (botón de la cabecera, contacto del pie): `src/site/config.ts`. Colores y tipografía: tokens de `:root` en `src/styles/global.css`.
- Toda imagen de `/wp-content/` debe pasar por `src/lib/images.ts` (WebP, `srcset`, `width`/`height`, `loading`).
- Tras cualquier cambio: `npm run build && npm run check-urls` sin errores.
- WooCommerce: carrito, pago y pedidos se quedan en WordPress.
- Auditorías de webs de terceros: **solo comprobaciones pasivas** (ver `docs/AUDIT-PLAYBOOK.md` §0).
- No subas `.env` ni tokens.
