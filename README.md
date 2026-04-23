# openblog

A self-hostable, multilingual blog platform you can deploy in minutes.

- **N-language support** — add as many languages as you need in `config.yaml`
- **Go backend** — fast SQLite-backed API (Echo v4)
- **React admin UI** — rich-text editor, media library, article management
- **Eleventy static site** — fast, SEO-friendly public pages
- **Theme system** — swap colors/fonts via `theme.json` (4 bundled presets)
- **Docker-ready** — single `docker compose up` for a full stack

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

Edit `config.yaml` to set your site name, languages and tags:

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

## Production (Docker)

```bash
# Set DOMAIN= in your .env or override on the command line
DOMAIN=myblog.example.com docker compose up -d
```

The `docker-compose.yml` wires together:

- **backend** — compiled Go binary
- **site-builder** — Eleventy build (runs once at startup)
- **proxy** — Caddy reverse proxy (automatic HTTPS when `DOMAIN` is set)

---

## Configuration reference

### `config.yaml`

| Key | Description |
|---|---|
| `site.name` | Blog name shown in nav and `<title>` |
| `site.description` | Default meta description |
| `site.headline` | Hero headline on the home page |
| `site.bookingUrl` | Optional call-to-action URL |
| `site.contactEmail` | Email shown in CTA band and footer |
| `site.social.*` | Social links (twitter, linkedin, github) |
| `languages` | Ordered array of language objects |
| `tags` | List of content tags shown in the editor |

### `theme.json`

CSS custom properties applied to every page. Pick a preset from `themes/`:

```bash
cp themes/dark.json theme.json
```

Or edit `theme.json` directly. Available tokens:

| Token | Default |
|---|---|
| `color-accent` | `#1a56db` |
| `color-accent-dark` | `#1345b7` |
| `color-bg` | `#ffffff` |
| `color-text` | `#111827` |
| `font-sans` | system-ui |
| `radius` | `0.75rem` |

---

## Customizing templates

Place `.njk` files in `site/src/user-theme/` to shadow the corresponding partial:

```
site/src/user-theme/
  nav.njk       ← overrides _includes/partials/nav.njk
  footer.njk    ← overrides _includes/partials/footer.njk
  cta-band.njk
  article-card.njk
```

These files are gitignored so your customizations stay local.

---

## Environment variables

See `.env.example` for the full list. Required:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret for signing admin tokens (min 32 chars) |

Optional:

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `./blog.db` | SQLite database path |
| `PORT` | `8080` | Backend listen port |
| `UPLOAD_DIR` | `./uploads` | Uploaded media directory |
| `MS_GRAPH_*` | — | Email via Microsoft Graph (contact form) |
| `GOATCOUNTER_URL` | — | GoatCounter analytics endpoint |

---

## License

MIT
