-- Migration 002: site settings key-value store + custom pages

-- ── Site settings (key → JSON blob) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
    key        TEXT NOT NULL PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Custom pages (language-independent metadata) ─────────────────────────────
CREATE TABLE IF NOT EXISTS pages (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    is_published INTEGER NOT NULL DEFAULT 0,
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── Page translations (one row per page × language) ──────────────────────────
CREATE TABLE IF NOT EXISTS page_translations (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id          INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    lang_code        TEXT    NOT NULL,
    slug             TEXT    NOT NULL,
    title            TEXT    NOT NULL DEFAULT '',
    body             TEXT    NOT NULL DEFAULT '',
    meta_title       TEXT    NOT NULL DEFAULT '',
    meta_description TEXT    NOT NULL DEFAULT '',
    UNIQUE(page_id, lang_code),
    UNIQUE(lang_code, slug)
);
