# Playbook for agents: audit a website and write the client report

[Español](../AUDIT-PLAYBOOK.md) · **English**

How to scan a website (usually WordPress) and turn the findings into a sales report: performance, design and conversion, links, technical SEO and security. Real example: the report on *conmdemujer.es* (a book shop built with WooCommerce and Elementor).

**Goal of the report:** the client understands in 2 minutes what their website is costing them (sales, visibility, risk) and what the options are, with verifiable numbers. It is not a technical report for developers.

> Reports for Spanish clients are written in Spanish. The Spanish template is `docs/REPORT-TEMPLATE.md`; the English one is `docs/en/REPORT-TEMPLATE.md`.

---

## 0. Rules (mandatory)

1. **Passive checks only** without the owner's written permission: load public pages and send GET requests to public resources, like any visitor. **Never:** try passwords, submit forms, add products to the cart, POST to `xmlrpc.php`, scan for vulnerabilities or ports, or access `/wp-admin`.
2. **Polite crawling:** at most 4 concurrent requests and 250 pages per run. Exclude cart, checkout, account, feeds and `wp-admin`.
3. **No personal data in the report:** if the API exposes users, give the number, not the names.
4. **Every number with its source and date** (PageSpeed with a link to the report, crawl date). If something couldn't be checked, say so.
5. **Don't invent financial impact.** Without the client's analytics it is impossible to quantify how much sales would grow: say so and explain why the improvements usually help.
6. **Prices as estimates**, excluding VAT, before seeing the dashboard.
7. **Don't make assumptions about the client** (the owner's gender, company size, etc.). Use neutral terms: "the site owner".

---

## 1. Tools

| You need | Preferred option | Alternative |
| --- | --- | --- |
| Browser | Claude in Chrome (extension) to browse, take screenshots and run JS on the page | Playwright or headless Chrome in the workspace |
| PageSpeed with real-user data | `https://pagespeed.web.dev/analysis?url=<encoded URL>` in the browser | PageSpeed Insights API (needs a key) |
| Repeatable Lighthouse | `node scripts/audit/lighthouse.mjs https://client.com / /shop/ /product/x/` | DevTools → Lighthouse |
| Metrics for one page | `scripts/audit/page-metrics.js` | — |
| Passive security | `scripts/audit/security-passive.js` | — |
| Links and SEO for the whole site | `scripts/audit/crawl.js` | Screaming Frog (if the user has it) |

The `.js` files in `scripts/audit/` are pasted into the console or passed to the browser's JavaScript tool **with the client's site open** (same origin).

**Tip with Claude in Chrome:** long JavaScript results get truncated, and results containing URLs with `?` or cookies may be blocked. Return summaries (`JSON.stringify` of counts, lists trimmed with `.slice(0, 10)`) and strip query strings (`.replace(/\?.*/, '')`).

---

## 2. Process (60–90 minutes)

### Step 1 — Create the document first

Create the report with its skeleton (see the report template) before researching, and fill in each section as the data comes in. The user sees the progress.

### Step 2 — PageSpeed on the key pages

Run PageSpeed (mobile and desktop) on:

- Home page.
- Main listing page (shop, catalogue, services, blog).
- A detail page (product, service, article): **it is usually the worst one and it is where the purchase is decided**.
- Contact (if it has a form or a map).

Extract with JS from the PageSpeed report (visible tab):

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

If Total Blocking Time (TBT) is high, look at the details of "Reduce JavaScript execution time" and "third-party": there is usually a specific culprit (on conmdemujer.es, a captcha that blocked the product page for 11 s).

Note down: scores, LCP, FCP, TBT, CLS, TTFB, whether real-user Core Web Vitals pass, and the 5 biggest opportunities with their estimated savings. The analysis takes 30–60 s; wait and retry the extraction if there are no metrics yet.

### Step 3 — Technology and weight

On the home page, run `page-metrics.js`. You get: theme, visible plugins (from their file paths), WordPress and page-builder version, number of scripts and stylesheets, weight per resource type and response time.

### Step 4 — Passive security

Run `security-passive.js` and translate each result into business risk:

| Finding | How to explain it | Severity |
| --- | --- | --- |
| `/wp-json/wp/v2/users` lists users | An attacker knows which usernames to try passwords on | Medium |
| `/wp-login.php` open | Target of automated password attacks | Medium |
| `xmlrpc.php` returns 405 | Allows trying many passwords in a single request | Medium |
| Visible version (`generator`, `readme.html`, `?ver=`) | Makes it easier to look up known vulnerabilities for that version | Low |
| Many detectable plugins | Plugins are the source of most WordPress incidents | Medium |
| No HSTS / CSP / X-Frame-Options / X-Content-Type-Options | More exposure to impersonation and script injection | Low |
| Listing of `/wp-content/uploads/` | Anyone can see every uploaded file | Medium |

Always make clear that no vulnerability has been confirmed and that a full audit requires permission.

### Step 5 — Link crawl and technical SEO

1. On the home page, run `crawl.js` (takes 1–3 minutes for 250 pages).
2. Poll every 30 s with the summary at the end of the file until `done` is `true`.
3. Get: HTTP status codes, **broken links and which page links to them**, pages without meta description, without H1, duplicate titles, meaningless URLs (`/elementor-1234/`, `?p=123`) and response times.
4. External links: from the browser you can only tell whether the server responds; `http://` links always fail because of mixed content. Report them as "not checked".
5. If URLs were left unchecked (limit reached), say so and say what type they are.

### Step 6 — Design and conversion (review as a customer)

Take screenshots at 1400 px and 390 px wide of the home, listing and detail pages, and review them with this checklist depending on the type of site:

**All sites**
- Is it clear within 5 seconds what is sold and to whom? Is there a headline and a call-to-action button visible without scrolling?
- Menu: how many items? Is the main one (shop, services, book an appointment) first and named that way?
- A huge header pushing the content down on every page?
- Consistent fonts and button styles; does it look dated? (old default theme with a page builder on top).
- Mixed languages (buttons in English on a Spanish site), wrong price and date formats.
- Visible contact (phone, WhatsApp, form).

**Online shop**
- Home: products with prices and buy buttons? New arrivals, best sellers, search and cart visible?
- Listing: categories, filters, sorting, products per row, first product visible without scrolling.
- Product page: price, button visible without scrolling, shipping and delivery times, key product data (for books: ISBN, pages, binding), reviews, related products, express checkout.

**Services / local business**
- Value proposition, social proof (reviews, case studies), indicative or "from" prices, short form, service area.

With JS you can count what's on the home page:

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

### Step 7 — Proposal

Always **two options**, from smallest to largest:

- **A. Optimise what's there** (2–4 days): images, caching, removing scripts where they aren't needed, fixing broken links, texts and formats, hardening security. Cheap and quick.
- **B. Migrate to Astro + headless WordPress** (with a redesign if there's a page builder): 95–100 performance, WordPress hidden, same URLs. More expensive; the client keeps editing the same way.

If there is WooCommerce, in option B cart, checkout and orders **stay in WordPress** (see `MIGRATION-PLAYBOOK.md` §9); include the "what stays / what changes" table, plugin by plugin.

Indicative prices (reference rate: €500/day, excluding VAT):

| Work | Days | Price |
| --- | --- | --- |
| Audit as a service | 0.5–1 | €300–500 |
| Option A, corporate site | 2–4 | €900–1,800 |
| Option B, corporate site with Gutenberg | 5–7 | €2,500–3,500 |
| Option B, with page builder or multilingual | 10–15 | €5,000–7,500 |
| Option B, shop (storefront in Astro, checkout in WooCommerce) | 15–25 | €7,500–12,500 |
| Maintenance (hosting for both, updates, builds, small changes) | — | €90–250/month |

### Step 8 — Review before delivering

- [ ] Every figure matches its source (open the PageSpeed report and check).
- [ ] No unverified claim presented as fact (external links, invisible plugins, sales).
- [ ] No usernames or personal data.
- [ ] The summary makes sense without reading the rest.
- [ ] Close any browser tabs you opened.

---

## 3. Report structure

See the report template. Order: Summary → Performance → Technical analysis → Design and conversion → Links and pages → Key-page performance → Security → Proposal (with "what changes") → Methodology and limitations → Sources.

Style:

- The first sentence of each section is the conclusion, with its number ("The book page is the slowest page: 30/100 on mobile").
- Tables to compare; lists for parallel findings; short sentences.
- Business language: "the customer waits 3 s to see the product", not an unexplained "high LCP".
- No empty adjectives ("amazing", "disastrous"). Let the numbers speak.
