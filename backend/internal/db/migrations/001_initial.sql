-- OpenBlog — initial schema (clean multilang design)
-- All article content lives in article_translations (one row per language).

-- ── Admin users ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Articles (shared / language-independent fields) ──────────────────────────
CREATE TABLE IF NOT EXISTS articles (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    is_featured      INTEGER NOT NULL DEFAULT 0,
    cover_image_path TEXT    NOT NULL DEFAULT '',
    published_at     DATETIME,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Article translations (one row per article × language) ────────────────────
CREATE TABLE IF NOT EXISTS article_translations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    article_id       INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    lang_code        TEXT    NOT NULL,
    slug             TEXT    NOT NULL,
    title            TEXT    NOT NULL DEFAULT '',
    excerpt          TEXT    NOT NULL DEFAULT '',
    body             TEXT    NOT NULL DEFAULT '',
    tag              TEXT    NOT NULL DEFAULT '',
    meta_title       TEXT    NOT NULL DEFAULT '',
    meta_description TEXT    NOT NULL DEFAULT '',
    UNIQUE(article_id, lang_code),
    UNIQUE(lang_code, slug)
);

-- ── Media files ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS media_files (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    filename      TEXT    NOT NULL,
    original_name TEXT    NOT NULL,
    mime_type     TEXT    NOT NULL,
    size_bytes    INTEGER NOT NULL DEFAULT 0,
    uploaded_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Contact form submissions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_submissions (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name     TEXT    NOT NULL,
    last_name      TEXT    NOT NULL DEFAULT '',
    company        TEXT    NOT NULL DEFAULT '',
    email          TEXT    NOT NULL,
    phone          TEXT    NOT NULL DEFAULT '',
    message        TEXT    NOT NULL,
    privacy_agreed INTEGER NOT NULL DEFAULT 0,
    ip_hash        TEXT    NOT NULL DEFAULT '',
    created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Newsletter subscribers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT NOT NULL UNIQUE,
    ip_hash         TEXT NOT NULL DEFAULT '',
    subscribed_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at DATETIME
);

-- ── Seed: two example articles (English only) ────────────────────────────────
INSERT INTO articles (is_featured, published_at) VALUES (1, CURRENT_TIMESTAMP);
INSERT INTO article_translations
    (article_id, lang_code, slug, title, excerpt, body, tag, meta_title, meta_description)
VALUES (
    1, 'en', 'welcome-to-openblog',
    'Welcome to OpenBlog',
    'This is your first blog post. Edit or delete it, then start writing!',
    '<p>Welcome to <strong>OpenBlog</strong> — your self-hosted, multilingual blog platform.</p>
<p>This post was created automatically as an example. You can edit it in the admin panel, or delete it and start fresh.</p>
<h2>What to do next</h2>
<ul>
  <li>Edit <code>config.yaml</code> to set your site name, languages, and tags.</li>
  <li>Edit <code>theme.json</code> to choose a colour palette.</li>
  <li>Add your own articles in the Admin panel.</li>
</ul>',
    'Getting Started',
    'Welcome to OpenBlog',
    'Get started with OpenBlog — your self-hosted, multilingual blog platform.'
);

INSERT INTO articles (is_featured, published_at) VALUES (0, CURRENT_TIMESTAMP);
INSERT INTO article_translations
    (article_id, lang_code, slug, title, excerpt, body, tag, meta_title, meta_description)
VALUES (
    2, 'en', 'getting-started-guide',
    'Getting Started Guide',
    'Everything you need to know to configure and customise your OpenBlog installation.',
    '<p>This guide walks you through the main configuration options.</p>
<h2>config.yaml</h2>
<p>Set your <code>site.name</code>, <code>site.url</code>, and configure as many languages as you need in the <code>languages</code> list.</p>
<h2>theme.json</h2>
<p>Pick a built-in preset (<code>default</code>, <code>minimal</code>, <code>dark</code>, <code>warm</code>) or customise individual colours directly.</p>
<h2>NJK overrides</h2>
<p>Drop any <code>.njk</code> file into <code>site/src/user-theme/</code> to override the matching core partial without touching the original files.</p>',
    'Getting Started',
    'Getting Started Guide | OpenBlog',
    'A complete guide to setting up and customising your OpenBlog installation.'
);
