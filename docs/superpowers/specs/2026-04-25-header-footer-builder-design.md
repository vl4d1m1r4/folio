# Header/Footer WYSIWYG Builders + Theme Colorpicker — Design Spec

**Date:** 2026-04-25  
**Status:** Approved

---

## Summary

Replace the static `nav.njk` and `footer.njk` Nunjucks templates with block-based WYSIWYG builders — identical in architecture to the existing Home Builder. Two new admin pages ("Header Builder", "Footer Builder") store `header_sections` and `footer_sections` as `HomeBlock[]` in the settings DB. Five new navigation-aware block types pull link data from the existing `nav_links` / `footer_links` / `social_links` snapshots injected at page load. `ColorRow` gains theme color swatches that store CSS variable references for theme-awareness. Settings Navigation and Footer tabs remain for link data management only.

---

## Architecture

The system has three layers:

1. **Link data layer** — `nav_links`, `footer_links`, `social_links` stored in settings DB. Edited in Settings tabs (unchanged). Consumed by nav-aware blocks as a snapshot at build/preview time.
2. **Layout data layer** — `header_sections` and `footer_sections` stored in settings DB as `HomeBlock[]` (same format as `home_sections`). Edited via the new builder pages.
3. **Render layer** — Eleventy SSG reads both layers at build time. `nav.njk` and `footer.njk` become thin block-renderer loops; five new block partials render the nav-aware content.

### Canvas Preview Strategy

When the admin opens a builder page, the parent component fetches `nav_links` / `footer_links` / `social_links` once and passes them as a static snapshot into `WysiwygShell` → `Canvas` → `iframeRenderer`. The five new nav-aware blocks render real link labels in the canvas (not generic placeholders). No per-render API calls inside the iframe.

---

## New Block Types

All five are `HomeBlock` with type-specific `config` fields. Stored the same way as existing template blocks.

### `nav-links`
Renders the full `nav_links` list with dropdowns and mobile hamburger.

| Config field | Type | Description |
|---|---|---|
| `dropdown_style` | `"simple" \| "mega"` | Simple: vertical dropdown panel. Mega: wide full-width multi-column panel |
| `show_language_switcher` | boolean | Show/hide language toggle |
| `link_color` | string | CSS color or `var(--color-*)` |
| `bg_color` | string | Container background |
| `sticky` | boolean | `position: sticky; top: 0` |

### `subnav-links`
Renders the children of one specific top-level nav or footer link.

| Config field | Type | Description |
|---|---|---|
| `source` | `"nav" \| "footer"` | Which link list to read from |
| `parent_key` | string | `label` of the parent link whose children are rendered |
| `layout` | `"vertical" \| "horizontal" \| "grid"` | Child link layout |
| `link_color` | string | CSS color or `var(--color-*)` |

### `single-nav-item`
Renders one specific link from the nav or footer list.

| Config field | Type | Description |
|---|---|---|
| `source` | `"nav" \| "footer"` | Which link list to read from |
| `link_key` | string | `label` of the link to render |
| `render_as` | `"link" \| "button"` | Plain anchor or styled button |
| `link_color` | string | CSS color or `var(--color-*)` |

### `social-links`
Renders the full `social_links` list with optional inline SVG icons.

| Config field | Type | Description |
|---|---|---|
| `show_icons` | boolean | Show SVG icon per platform |
| `icon_style` | `"outline" \| "filled"` | Icon variant |
| `layout` | `"horizontal" \| "vertical"` | Link list direction |
| `link_color` | string | CSS color or `var(--color-*)` |

### `single-social-link`
Renders one specific social platform link.

| Config field | Type | Description |
|---|---|---|
| `platform` | string | Platform name to find in `social_links` |
| `show_icon` | boolean | Show SVG icon |
| `link_color` | string | CSS color or `var(--color-*)` |

---

## Components

### New Admin Pages

**`HeaderBuilderPage.tsx`** — modeled on `HomeBuilderPage.tsx`:
- Loads `AllSettings` on mount
- Extracts `header_sections`, `themeVars`, `languages`, `nav_links`, `social_links`
- Passes `navSnapshot` and `socialSnapshot` to `WysiwygShell`
- Save: `PUT /api/v1/admin/settings` with `{ header_sections: [...] }` + trigger rebuild

**`FooterBuilderPage.tsx`** — same pattern:
- Loads `footer_sections`, `footer_links`, `social_links`
- Includes "Load default template" button that pre-populates `footer_sections` with a `container` block wrapping the standard 3-column layout (site-info + footer-links + social-links)
- Save: same PUT pattern with `footer_sections`

### WysiwygShell / Canvas / iframeRenderer Changes

`WysiwygShell` gains optional props:
```ts
navSnapshot?: NavLink[]
footerSnapshot?: NavLink[]
socialSnapshot?: SocialLink[]
```

These flow: `WysiwygShell` → `Canvas` → `buildSrcdoc()` → `navBlockHtml()`.

In `iframeRenderer.ts`, a new `navBlockHtml()` function handles all five nav-aware types. These render **real styled HTML** with actual link labels from the snapshot — not dashed-border placeholders. The rendered HTML matches the real Eleventy output closely so the WYSIWYG preview is accurate.

### Inspector Changes

`InspectorPanel` gains `navSnapshot`, `footerSnapshot`, `socialSnapshot`, and `themeVars` props. These flow to `TemplateInspector` which adds `switch` cases for the five new types. Inspector fields that show dropdowns (parent_key, link_key, platform) are populated from the relevant snapshot array.

### ColorRow Theme Swatches

`ColorRow` in `InspectorShared.tsx` gains an optional `themeColors?: Record<string, string>` prop (the resolved `--color-*` values from `themeVars`).

When provided, a row of 10 small circular swatches appears above the color picker input — one per semantic color token: `accent`, `cta`, `bg`, `bg-surface`, `text`, `muted`, `border`, `success`, `warning`, `destructive`.

**Behavior:**
- Clicking a swatch stores `var(--color-accent)` (the CSS var string) in the block config — not the resolved hex. This keeps blocks theme-aware: changing the theme preset automatically updates rendered colors without re-editing every block.
- When the stored value starts with `var(`, the preview swatch resolves the display color from `themeColors`; the hex input is hidden (showing `var(--color-accent)` as label text instead).
- Manual hex entry still works as before, storing a literal hex value.

`themeVars` flows from `WysiwygShell` → `InspectorPanel` → each per-type inspector → each `ColorRow`.

---

## Data Model Changes

### Backend (`settings.go`)
Add to `settingsKeys`:
```go
"header_sections"
"footer_sections"
```

### Backend (`public.go`)
Two new public endpoints:
- `GET /api/v1/config/header?lang=<code>` — reads `header_sections`, returns filtered+sorted `HomeBlock[]`
- `GET /api/v1/config/footer-sections?lang=<code>` — same for `footer_sections`

Pattern identical to existing `/api/v1/config/home`.

### Frontend (`types.ts`)
```ts
// BlockType union — add:
| "nav-links" | "subnav-links" | "single-nav-item" | "social-links" | "single-social-link"

// AllSettings — add:
header_sections: HomeBlock[] | null
footer_sections: HomeBlock[] | null
```

---

## Eleventy Template Changes

### New data files
- `site/src/_data/header.js` — fetches `/api/v1/config/header?lang=<code>` per language → `{ byLang: { en: HomeBlock[], … } }`
- `site/src/_data/footer_sections.js` — fetches `/api/v1/config/footer-sections?lang=<code>` → `{ byLang: { … } }`

Existing `nav.js` and `footer.js` remain (used by `subnav-links` / `single-nav-item` block partials at build time, same as the snapshots in admin).

### Replaced templates
**`nav.njk`** — replaced with a block renderer loop:
```nunjucks
{% for b in header.byLang[lang] | sort(false, false, 'order') %}
  {% if b.visible !== false %}
    {% set block = b %}
    {% include "partials/blocks/" + b.type + ".njk" %}
  {% endif %}
{% endfor %}
```

**`footer.njk`** — same loop over `footer_sections.byLang[lang]`. The copyright line stays hardcoded **outside** and below the loop:
```nunjucks
<div style="border-top: 1px solid var(--color-border);">
  <p class="text-xs text-center py-4" style="color: var(--color-muted);">
    © {{ site.name }} · Powered by <a href="https://github.com/vl4d1m1r4/folio" ...>Folio</a>
  </p>
</div>
```

### New block partials
Five new files in `site/src/_includes/partials/blocks/`:

- **`nav-links.njk`** — full nav with simple/mega dropdown, mobile hamburger, language switcher. Reads all style config from `block.config`. Uses existing `nav.byLang[lang]` data.
- **`subnav-links.njk`** — finds the parent link in `nav.byLang[lang]` or `footer.byLang[lang]` by `block.config.parent_key`, iterates its children, applies layout config.
- **`single-nav-item.njk`** — finds one link by `block.config.link_key` from specified source.
- **`social-links.njk`** — iterates `social` data, renders platform name + optional inline SVG icon from an icon map defined in the partial. Supports: GitHub, Twitter/X, LinkedIn, Instagram, Facebook, YouTube, Mastodon, Bluesky.
- **`single-social-link.njk`** — finds one social link by `block.config.platform`.

---

## Admin Navigation

Add to `AdminLayout.tsx` `links` array under "Customization", after "Home Builder":
```ts
{ label: "Header Builder", to: "/admin/header-builder", section: false },
{ label: "Footer Builder", to: "/admin/footer-builder", section: false },
```

---

## Scope Boundaries

- Link data editing (add/remove/reorder nav links) stays in Settings — not moved or removed
- Mega menu = `dropdown_style: "mega"` config on `nav-links` block. No nested block canvas inside dropdowns.
- The `© site.name · Powered by Folio` copyright line is always hardcoded at the bottom of `footer.njk`, outside the block loop
- No changes to `HomeBuilderPage` or `PageEditPage` behavior. The 5 new block types appear in their palette too but are intended for header/footer use.
- `header_sections` and `footer_sections` use the `HomeBlock` format with `translations` per language (same as `home_sections`) — no new type needed

---

## Error Handling

- If `header_sections` or `footer_sections` is null/empty in the DB, the builder shows an empty canvas with a prompt to add blocks or load the default template
- If the Eleventy build-time fetch for `/api/v1/config/header` fails, `header.js` falls back to an empty array (consistent with other data files' fallback pattern)
- If a `subnav-links` block's `parent_key` no longer exists in the nav (e.g. link was deleted), the block renders nothing at build time and shows an "invalid parent" warning label in the canvas preview

---

## Testing Checklist

1. Header Builder page loads; canvas is empty; Navigation block group visible in palette
2. Add `nav-links` block → canvas shows real link labels from `nav_links` snapshot
3. Add `subnav-links` block → inspector parent_key dropdown populated from snapshot
4. `dropdown_style: "mega"` renders a wide panel in canvas and in live site
5. Save Header Builder → triggers rebuild → live site renders `header_sections` blocks via `nav.njk`
6. Footer Builder "Load default template" seeds correct 3-column layout
7. Save Footer Builder → live site footer renders from `footer_sections`; copyright line always present
8. ColorRow theme swatches visible in all inspectors with `themeColors` prop
9. Clicking accent swatch stores `var(--color-accent)`; preview swatch shows resolved color
10. Changing theme preset → inspector swatch colors update without re-editing blocks
11. Settings Navigation tab still works for editing `nav_links` data
12. `subnav-links` block with deleted parent_key shows graceful fallback
