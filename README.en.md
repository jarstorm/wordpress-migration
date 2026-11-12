# wordpress-migration

[Español](README.md) · **English**

Migration of the **Nortia Reformas** website (`../wordpress-original`) to **Astro + headless WordPress**, and a reusable kit to migrate other WordPress sites the same way.

- **WordPress stays the same**: the client keeps editing in the same dashboard. Only a small plugin (`headless-connector`) is installed to expose the content.
- **Astro builds the public site** as static HTML: same URLs, optimised images, no PHP or database exposed.

```
                        build (npm run build)
 ┌──────────────────────┐   /wp-json/headless/v1   ┌─────────────────┐    dist/   ┌──────────────────┐
 │ WordPress (admin)    │ ───────────────────────▶ │ Astro            │ ─────────▶ │ Static hosting   │ ◀── visitors
 │ + headless-connector │                          │ (this repo)      │            │ / CDN            │
 └──────────────────────┘ ◀─────────────────────── └─────────────────┘            └──────────────────┘
          ▲  forms and comments (REST)  ◀─────────────────────────────────────────────────┘
```

## Structure

| Folder | Contents |
| --- | --- |
| `wp-connector/headless-connector/` | WordPress plugin: routes, entries with parsed blocks, menus, ACF, SEO, comments, CORS and build webhook |
| `astro/` | The new website |
| `astro/src/components/blocks/` | Gutenberg block rendering (generic) |
| `astro/src/components/shortcodes/` | Shortcodes from common plugins (Contact Form 7) |
| `astro/src/site/` | **Everything client-specific**: templates, shortcodes, own components and `config.ts` (header button and footer contact details) |
| `scripts/` | Connector installation, inventory, URL check and Lighthouse |
| `scripts/audit/` | Snippets to audit any website (metrics, passive security, link crawl) |
| `docs/` | Guides for people and agents: migration, audit and report template (Spanish in `docs/`, English in `docs/en/`) |

## Getting started

### 1. Original WordPress (unchanged)

```bash
cd ../wordpress-original
docker compose up -d
docker compose run --rm wpcli sh /setup/setup.sh   # first time only
```

### 2. Install the connector in that WordPress

```bash
cd ../wordpress-migration
./scripts/install-connector.sh
curl http://localhost:8080/wp-json/headless/v1/site   # should return JSON
```

The script copies the plugin into the container and activates it with WP-CLI. It doesn't touch any file in `wordpress-original`.

### 3. Astro site

```bash
cd astro
cp .env.example .env      # WP_URL=http://localhost:8080
npm install
npm run dev               # http://localhost:4321, with hot reload
npm run build             # generates dist/ (downloads and optimises images)
npm run preview           # serves dist/ at http://localhost:4321
```

### 4. Verify

```bash
cd astro
npm run check-urls                                                  # every WordPress URL exists and there are no broken links
node ../scripts/inventory.mjs                                        # which blocks, shortcodes and fields the site uses
node ../scripts/audit/lighthouse.mjs http://localhost:8080,http://localhost:4321 / /servicios/reforma-de-banos/ /contacto/
```

## What has been migrated

| In WordPress | In Astro |
| --- | --- |
| Hierarchical pages, posts, projects (CPT) | Same URLs (`/servicios/reforma-de-banos/`, `/proyectos/...`, `/%postname%/`) |
| Blog, projects archive, categories, tags, project types, authors | Listings with pagination (`/blog/page/2/`) |
| Gutenberg blocks | WordPress HTML + own components (Latest posts, shortcodes); images converted to WebP with `srcset` |
| `[nortia_proyectos]`, `[nortia_equipo]` (mu-plugin) | Native components in `src/site/components/` |
| Project spec sheet and service box (`the_content` filter) | Templates in `src/site/templates/` using ACF fields |
| Contact Form 7 | Same form, submitted with `fetch` to the CF7 API (without its JavaScript) |
| Comments | Rendered at build time; the form posts them to the REST API (usual moderation) |
| Menus, logo, icon | From the connector |
| Yoast SEO | Title, description and schema via the connector; canonical, Open Graph, sitemap and robots in Astro |
| Cookie Notice | Own banner, no dependencies |
| Wordfence, UpdraftPlus, Smush, Redirection, WP Mail SMTP… | Stay in WordPress; they don't affect the public site |

## Results

Mobile Lighthouse on the Astro site (test environment, with the new design and font included):

| Page | Performance | Accessibility | Best practices | SEO | LCP | Total weight |
| --- | --- | --- | --- | --- | --- | --- |
| Home | 100 | 100 | 100 | 100 | 1.4 s | 69 KiB |
| Service (bathrooms) | 100 | 100 | 100 | 100 | 0.8 s | 47 KiB |
| Project | 100 | 100 | 100 | 100 | 1.4 s | 54 KiB |
| Blog post | 100 | 100 | 100 | 100 | 1.4 s | 47 KiB |
| Contact | 98 | 99 | 100 | 100 | 0.8 s | 47 KiB |
| Blog | 100 | 98 | 100 | 100 | 1.4 s | 80 KiB |

To compare with the original WordPress on your machine:

```bash
node scripts/audit/lighthouse.mjs http://localhost:8080,http://localhost:4321 / /servicios/reforma-de-banos/ /contacto/
```

## Design

Colour, radius and shadow tokens in `:root` of `astro/src/styles/global.css`; Plus Jakarta Sans variable font (self-hosted, ~27 KB). Sticky blurred header with a quote button, full-screen mobile menu, gradient page headers, full-width home hero with services as cards, highlighted price box on service pages and a three-column footer. For another client: change the tokens and `src/site/config.ts`.

## To do / known limits

- **Draft preview**: the site is static; previewing a draft needs a server mode (Astro SSR on a `/preview` route) or a staging environment. Not implemented.
- **Publishing**: every change in WordPress needs a new build. The connector calls `headless_build_hook` when content is published or updated, and when menus, categories, site settings or a comment's status change (set it to your hosting's or CI's build URL). Changes only in the Media Library or in plugin settings need a manual build.
- **Form email**: locally, Contact Form 7 returns `mail_failed` because there is no mail server; messages are kept in Flamingo. In production, configure WP Mail SMTP.
- **Search**: the original site had none; if needed, add Pagefind to the build.
- **RSS** (`/feed/`): not generated. Add `@astrojs/rss` if the client uses it.
- **OpenStreetMap map** (HTML block with an iframe): kept as is.
- **Author page without posts** (`/author/admin/`): WordPress serves it and Astro doesn't. Add a 301 redirect on the hosting.
