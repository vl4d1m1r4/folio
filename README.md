# folio

A self-hostable, multilingual blog platform you can deploy in minutes.

## Features

### Content management
- **Articles** — create and publish posts with a rich-text editor (bold, italic, headings, links, images, lists, tables); per-language translations, custom slugs, tags, author, and publish date
- **Media library** — upload images and files; pick them directly inside the article editor or from any image field in Settings
- **Tags** — manage content tags in Settings → General; tags are reflected live in the article editor and public tag filter
- **Contact submissions** — view and manage enquiries submitted through the public contact form
- **Newsletter** — view subscriber list; subscribers added via the public unsubscribe page

### Multilingual
- **N languages** — add any number of languages (BCP-47 codes, LTR/RTL) in Settings → Languages
- **Per-article translations** — each article can have a full translation per language with its own title, body, and slug
- **Per-nav-link labels** — override navigation link labels for each language via the 🌐 popover in Settings → Navigation
- **UI string translations** — translate every built-in page label, button, and message in Settings → Translations; falls back to English when a string is not set

### Public site (Eleventy SSG)
- **Static output** — Eleventy generates a fast, SEO-friendly static site, rebuilt after every admin save
- **Built-in pages** — Home (with configurable hero, CTA band), Articles (with tag filter), Contact form, Unsubscribe page
- **Custom pages** — create additional free-form pages from the admin and link to them in the navigation
- **Hero background image** — set a cover image on the Home page hero block via the admin page builder
- **Favicon & logo** — configure a browser tab favicon and a header logo image that replaces the site name in the nav

### Theming
- **4 bundled presets** — `default`, `dark`, `minimal`, `warm`; swap instantly from Settings → Theme
- **Live preview** — colour and font changes are previewed in the admin UI before saving
- **Full customisation** — 15 colour tokens, body font + fallback stack, button / card / input border radii
- **Template overrides** — drop `.njk` files into `site/src/user-theme/` to shadow any built-in partial

### Infrastructure
- **Go backend** — Echo v4, SQLite (WAL mode via `modernc.org/sqlite`), JWT authentication
- **React admin UI** — Vite + React 18 + TanStack Query v5 + Tailwind v4
- **Docker-ready** — single `docker compose up` with Caddy reverse proxy and automatic HTTPS

---

## Quick start

### 1. Prerequisites

- Go 1.22+
- Node.js 20+
- Make

### 2. Configure

Copy the example env file and edit secrets:

```bash
cp .env.example .env
# Edit .env — set a strong JWT_SECRET at minimum
```

Edit `config.yaml` to set your site name and languages:

```yaml
site:
  name: "My Blog"
languages:
  - code: en
    label: English
    dir: ltr
    default: true
```

### 3. Install dependencies & create admin user

```bash
make setup
```

This runs `go mod tidy`, `npm install`, database migrations, and prompts you to create an admin account.

### 4. Start development servers

```bash
make dev
```

| Service | URL |
|---|---|
| Backend API | http://localhost:8080 |
| Admin UI | http://localhost:5173/admin |
| Public site (Eleventy) | http://localhost:8081 |

---

## Admin panel

Log in at `/admin`. The sidebar gives access to:

| Section | Description |
|---|---|
| **Dashboard** | Recent activity overview |
| **Articles** | Create, edit, and publish posts |
| **Media** | Upload and browse images/files |
| **Contacts** | View contact form submissions |
| **Newsletter** | View and export subscriber list |
| **Settings** | Site-wide configuration (see below) |

### Settings tabs

| Tab | Description |
|---|---|
| **General** | Site name, tagline, public URL, booking URL, contact email, content tags, favicon, and header logo |
| **Navigation** | Build the main navigation bar; choose built-in pages, custom pages, or external URLs; reorder with ▲▼; set per-language labels with 🌐 |
| **Footer & Social** | Footer links (same options as Navigation) and social media profile links shown in the footer |
| **Theme** | Choose a colour preset or fine-tune 15 colour tokens, body font, and border radii; changes preview live in the admin |
| **Languages** | Add or remove site languages; set the default locale; supports LTR and RTL scripts |
| **Translations** | Translate every built-in page label, button, and message for each configured language; blank fields fall back to English |

---

## Production (Docker)

```bash
# Set DOMAIN= in your .env or override on the command line
DOMAIN=myblog.example.com docker compose up -d
```

The `docker-compose.yml` wires together:

- **backend** — compiled Go binary
- **site-builder** — Eleventy build (runs once at startup, then on each rebuild trigger)
- **proxy** — Caddy reverse proxy (automatic HTTPS when `DOMAIN` is set)

---

## Deploy with the ONCE app server (recommended)

[ONCE](https://github.com/basecamp/once) is an open-source app server by 37signals that lets you run multiple
self-hosted web apps on a single machine via a simple terminal UI — no DevOps
knowledge required. folio is built to run on it out of the box.

### How it works

Install the ONCE CLI on any Linux server with one command, then point it at the
folio Docker image. ONCE handles:

- Automatic TLS certificates (via Kamal Proxy)
- Zero-downtime updates
- Daily backups to a local directory (30-day retention)
- A dashboard showing CPU, memory, traffic, and unique visitors
- Running multiple apps side-by-side on the same machine

### Server requirements

Any Linux VPS works (Ubuntu 22.04+ or Debian 12 recommended).

| Scale | RAM | CPU |
|---|---|---|
| Personal / small team | 1 GB | 1 vCPU |
| Medium traffic | 2 GB | 2 vCPU |
| High traffic | 4 GB+ | 4+ vCPU |

Providers: Hetzner, DigitalOcean, Linode, AWS, Vultr — anything works.

### Prerequisites

1. **A domain name** pointed at your server's IP address (DNS A record).
2. **Docker** installed on the server:

```bash
curl -fsSL https://get.docker.com | sh
```

3. **ONCE CLI** installed:

```bash
curl https://get.once.com | sh
```

### 1. Push the folio image

Build and push to any public Docker registry (Docker Hub, GitHub Container Registry, etc.):

```bash
docker build -t youruser/folio:latest .
docker push youruser/folio:latest
```

### 2. Install via ONCE

Run `once` on your server, choose **Custom Docker image**, and enter:

```
Image URL:  youruser/folio:latest
Hostname:   blog.example.com
```

ONCE will pull the image, configure the proxy, and provision a TLS certificate automatically.

### 3. Set environment variables

From the ONCE dashboard, open your app's **Settings → Environment** and add:

```env
JWT_SECRET=<at-least-32-random-characters>
DB_PATH=/storage/blog.db
UPLOAD_DIR=/storage/uploads
```

> ONCE mounts `/storage` as a persistent volume. Keeping all data there means
> backups and restores work automatically.

### 4. Create an admin account

SSH into the server and run:

```bash
docker exec -it <container-name> ./create-admin
```

The container name is shown in the ONCE dashboard.

### 5. Configure your site

Log in at `https://blog.example.com/admin` and use **Settings** to set your
site name, languages, navigation, and theme.

### Updating

ONCE checks for a new image once every 24 hours and redeploys with zero downtime
automatically. You can also trigger an immediate update from the dashboard.

### Backups

Enable automatic backups in **ONCE dashboard → Settings → Backups** by specifying
a local path. ONCE saves a daily snapshot of `/storage` and keeps the last 30 days.

---

## Deploy with Docker Compose (manual)

For full control or if you're not using ONCE:

```bash
# Set DOMAIN= in your .env or override on the command line
DOMAIN=myblog.example.com docker compose up -d
```

The `docker-compose.yml` wires together:

- **backend** — compiled Go binary
- **site-builder** — Eleventy build (runs once at startup, then on each rebuild trigger)
- **proxy** — Caddy reverse proxy (automatic HTTPS when `DOMAIN` is set)

---

## Configuration reference

### `config.yaml`

| Key | Description |
|---|---|
| `site.name` | Blog name shown in nav and `<title>` |
| `site.tagline` | Short descriptor shown in the header |
| `site.url` | Canonical public URL (used for sitemaps and og:url) |
| `site.headline` | Hero headline on the home page |
| `site.bookingUrl` | Optional call-to-action URL |
| `site.contactEmail` | Email shown in CTA band and footer |
| `languages` | Ordered array of `{code, label, dir, default}` objects |
| `tags` | Seed list of content tags (overridden by DB value once saved) |

> All values in `config.yaml` are the **initial seed**. After the first save in Settings → General, the database value takes precedence.

### `theme.json`

CSS custom properties applied to every public page. Pick a preset from `themes/`:

```bash
cp themes/dark.json theme.json
```

Or edit `theme.json` directly, or use Settings → Theme in the admin. Key tokens:

| Token | Description |
|---|---|
| `colors.accent` | Primary action colour (buttons, links) |
| `colors.bg` | Page background |
| `colors.text` | Body text |
| `colors.nav-from/to` | Navigation bar gradient |
| `fonts.body` | Body font family name |
| `radius.button/card/input` | Border radius for each element type |

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | *(required)* | Secret for signing admin tokens (min 32 chars) |
| `DB_PATH` | `./blog.db` | SQLite database path |
| `PORT` | `8080` | Backend listen port |
| `UPLOAD_DIR` | `./uploads` | Uploaded media directory |
| `MS_GRAPH_*` | — | Email via Microsoft Graph (contact form delivery) |
| `GOATCOUNTER_URL` | — | GoatCounter analytics endpoint injected into pages |

---

## Customizing templates

Drop `.njk` files into `site/src/user-theme/` to shadow the corresponding built-in partial:

```
site/src/user-theme/
  nav.njk          ← overrides _includes/partials/nav.njk
  footer.njk       ← overrides _includes/partials/footer.njk
  cta-band.njk
  article-card.njk
```

These files are gitignored so your customizations survive updates.

---

## License

MIT

