# Header/Footer WYSIWYG Builders + Theme Colorpicker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static `nav.njk` / `footer.njk` with WYSIWYG block builders (Header Builder, Footer Builder) stored as `HomeBlock[]` in settings, backed by five new nav-aware block types and a theme-aware colorpicker.

**Architecture:** Two new admin pages (`HeaderBuilderPage`, `FooterBuilderPage`) reuse `WysiwygShell` with nav/social snapshots injected at page load. Five new block types (`nav-links`, `subnav-links`, `single-nav-item`, `social-links`, `single-social-link`) render real link labels from those snapshots in the canvas. Eleventy templates `nav.njk` / `footer.njk` become thin block-renderer loops. `ColorRow` gains theme color swatches that store CSS var references.

**Tech Stack:** Go (Echo), TypeScript/React, Eleventy/Nunjucks, SQLite

---

## File Map

### Created
- `admin/src/pages/admin/HeaderBuilderPage.tsx`
- `admin/src/pages/admin/FooterBuilderPage.tsx`
- `admin/src/components/admin/wysiwyg/NavBlockInspector.tsx`
- `site/src/_data/header.js`
- `site/src/_data/footer_sections.js`
- `site/src/_includes/partials/blocks/nav-links.njk`
- `site/src/_includes/partials/blocks/subnav-links.njk`
- `site/src/_includes/partials/blocks/single-nav-item.njk`
- `site/src/_includes/partials/blocks/social-links.njk`
- `site/src/_includes/partials/blocks/single-social-link.njk`

### Modified
- `backend/internal/api/handlers/settings.go` — add `header_sections`, `footer_sections` to allowlist
- `backend/internal/api/handlers/public.go` — add `GetHeaderSections`, `GetFooterSections` handlers
- `backend/cmd/server/main.go` — register two new routes
- `admin/src/api/types.ts` — extend `BlockType`, `AllSettings`
- `admin/src/App.tsx` — add two new lazy routes
- `admin/src/layouts/AdminLayout.tsx` — add two new sidebar links
- `admin/src/components/admin/blockShared.tsx` — add 5 new block labels + default configs
- `admin/src/components/admin/wysiwyg/blockUtils.ts` — add nav block config defaults to `baseConfig`
- `admin/src/components/admin/wysiwyg/LeftSidebar.tsx` — add Navigation palette group
- `admin/src/components/admin/wysiwyg/iframeRenderer.ts` — add snapshot params + nav block renderers
- `admin/src/components/admin/wysiwyg/Canvas.tsx` — pass snapshot props
- `admin/src/components/admin/wysiwyg/WysiwygShell.tsx` — add snapshot + themeColors props
- `admin/src/components/admin/wysiwyg/InspectorPanel.tsx` — pass snapshot + themeColors to inspectors
- `admin/src/components/admin/wysiwyg/TemplateInspector.tsx` — add 5 new block cases
- `admin/src/components/admin/wysiwyg/InspectorShared.tsx` — add theme swatches to `ColorRow`
- `admin/src/components/admin/wysiwyg/ContainerInspector.tsx` — accept + pass `themeColors`
- `admin/src/components/admin/wysiwyg/ButtonInspector.tsx` — accept + pass `themeColors`
- `admin/src/components/admin/wysiwyg/ImageInspector.tsx` — accept + pass `themeColors`
- `admin/src/components/admin/wysiwyg/TextInspector.tsx` — accept + pass `themeColors`
- `site/src/_includes/partials/nav.njk` — replaced with block renderer loop
- `site/src/_includes/partials/footer.njk` — replaced with block renderer loop (copyright stays)

---

## Task 1: Backend — Add New Settings Keys

**Files:**
- Modify: `backend/internal/api/handlers/settings.go`

- [ ] **Step 1: Add the two new keys to the allowlist**

In `settings.go`, change `settingsKeys`:

```go
var settingsKeys = []string{
	"site",
	"theme",
	"nav_links",
	"footer_links",
	"social_links",
	"home_sections",
	"header_sections",
	"footer_sections",
	"languages",
	"ui_strings",
}
```

- [ ] **Step 2: Verify the server still compiles**

```bash
cd backend && go build ./...
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add backend/internal/api/handlers/settings.go
git commit -m "feat(backend): add header_sections and footer_sections to settings allowlist"
```

---

## Task 2: Backend — Public Endpoints for Header/Footer Sections

**Files:**
- Modify: `backend/internal/api/handlers/public.go`
- Modify: `backend/cmd/server/main.go`

- [ ] **Step 1: Add two new handler methods to `public.go`**

After the `GetHomeSections` function (around line 215), add:

```go
// GetHeaderSections returns the header builder block config.
// GET /api/v1/config/header?lang=en
func (h *PublicHandler) GetHeaderSections(c echo.Context) error {
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = h.cfg.DefaultLanguage().Code
	}

	raw, err := h.repo.GetSetting(c.Request().Context(), "header_sections")
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load header sections")
	}
	if raw == "" || raw == "null" {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}

	var blocks []map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &blocks); err != nil {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}

	resolveBlockTranslations(blocks, lang)

	out, _ := json.Marshal(blocks)
	return c.JSONBlob(http.StatusOK, out)
}

// GetFooterSections returns the footer builder block config.
// GET /api/v1/config/footer-sections?lang=en
func (h *PublicHandler) GetFooterSections(c echo.Context) error {
	lang := c.QueryParam("lang")
	if lang == "" {
		lang = h.cfg.DefaultLanguage().Code
	}

	raw, err := h.repo.GetSetting(c.Request().Context(), "footer_sections")
	if err != nil {
		return respondError(c, http.StatusInternalServerError, "failed to load footer sections")
	}
	if raw == "" || raw == "null" {
		return c.JSONBlob(http.StatusOK, []byte("[]"))
	}

	var blocks []map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &blocks); err != nil {
		return c.JSONBlob(http.StatusOK, []byte(raw))
	}

	resolveBlockTranslations(blocks, lang)

	out, _ := json.Marshal(blocks)
	return c.JSONBlob(http.StatusOK, out)
}
```

- [ ] **Step 2: Register the routes in `main.go`**

In `backend/cmd/server/main.go`, after the `api.GET("/config/home", ...)` line:

```go
api.GET("/config/header", publicH.GetHeaderSections)
api.GET("/config/footer-sections", publicH.GetFooterSections)
```

- [ ] **Step 3: Build and verify**

```bash
cd backend && go build ./...
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/internal/api/handlers/public.go backend/cmd/server/main.go
git commit -m "feat(backend): add GET /config/header and /config/footer-sections public endpoints"
```

---

## Task 3: Frontend Types

**Files:**
- Modify: `admin/src/api/types.ts`

- [ ] **Step 1: Extend `BlockType` union**

Replace the existing `BlockType` export:

```ts
export type BlockType =
  | "hero"
  | "featured-articles"
  | "latest-articles"
  | "cta-band"
  | "rich-text"
  | "image-text"
  | "testimonials"
  | "newsletter"
  | "container"
  | "text"
  | "image"
  | "button"
  | "nav-links"
  | "subnav-links"
  | "single-nav-item"
  | "social-links"
  | "single-social-link";
```

- [ ] **Step 2: Extend `AllSettings`**

Add two fields to the `AllSettings` interface:

```ts
export interface AllSettings {
  site: SiteSettingsData | null;
  theme: ThemeSettings | null;
  nav_links: NavLink[] | null;
  footer_links: NavLink[] | null;
  social_links: SocialLink[] | null;
  home_sections: HomeBlock[] | null;
  header_sections: HomeBlock[] | null;
  footer_sections: HomeBlock[] | null;
  languages: Language[] | null;
  ui_strings: Record<string, Record<string, string>> | null;
  email_status: { provider: string; configured: boolean } | null;
}
```

- [ ] **Step 3: Check TypeScript compiles**

```bash
cd admin && npx tsc --noEmit
```

Expected: errors only for the new types being used in places they don't exist yet (that's fine — we'll add them next). Zero errors is also fine.

- [ ] **Step 4: Commit**

```bash
git add admin/src/api/types.ts
git commit -m "feat(types): add nav block types and header/footer_sections to AllSettings"
```

---

## Task 4: Block Defaults and Labels

**Files:**
- Modify: `admin/src/components/admin/blockShared.tsx`
- Modify: `admin/src/components/admin/wysiwyg/blockUtils.ts`

- [ ] **Step 1: Add labels to `BLOCK_LABELS` in `blockShared.tsx`**

Add to the `BLOCK_LABELS` object (after `button`):

```ts
export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: "Hero",
  "featured-articles": "Featured Articles",
  "latest-articles": "Latest Articles",
  "cta-band": "CTA Band",
  "rich-text": "Rich Text",
  "image-text": "Image + Text",
  testimonials: "Testimonials",
  newsletter: "Newsletter Subscribe",
  container: "Container",
  text: "Text",
  image: "Image",
  button: "Button",
  "nav-links": "Navigation",
  "subnav-links": "Sub-navigation",
  "single-nav-item": "Nav Item",
  "social-links": "Social Links",
  "single-social-link": "Social Link",
};
```

- [ ] **Step 2: Add default config functions in `blockShared.tsx`**

After `applyContainerDefaults`, add:

```ts
export function applyNavLinksDefaults(config: Record<string, unknown>): void {
  config.dropdown_style = "simple"; // "simple" | "mega"
  config.show_language_switcher = true;
  config.link_color = null;
  config.bg_color = null;
  config.sticky = true;
}

export function applySubnavLinksDefaults(config: Record<string, unknown>): void {
  config.source = "nav"; // "nav" | "footer"
  config.parent_key = "";
  config.layout = "vertical"; // "vertical" | "horizontal" | "grid"
  config.link_color = null;
}

export function applySingleNavItemDefaults(config: Record<string, unknown>): void {
  config.source = "nav"; // "nav" | "footer"
  config.link_key = "";
  config.render_as = "link"; // "link" | "button"
  config.link_color = null;
}

export function applySocialLinksDefaults(config: Record<string, unknown>): void {
  config.show_icons = true;
  config.icon_style = "outline"; // "outline" | "filled"
  config.layout = "horizontal"; // "horizontal" | "vertical"
  config.link_color = null;
}

export function applySingleSocialLinkDefaults(config: Record<string, unknown>): void {
  config.platform = "";
  config.show_icon = true;
  config.link_color = null;
}
```

- [ ] **Step 3: Wire defaults into `baseConfig` in `blockUtils.ts`**

Add the import at top of `blockUtils.ts`:

```ts
import {
  applyContainerDefaults,
  applyTextDefaults,
  applyImageDefaults,
  applyButtonDefaults,
  applyNavLinksDefaults,
  applySubnavLinksDefaults,
  applySingleNavItemDefaults,
  applySocialLinksDefaults,
  applySingleSocialLinkDefaults,
} from "../blockShared";
```

Then extend `baseConfig`:

```ts
function baseConfig(type: BlockType): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (type === "featured-articles" || type === "latest-articles")
    config.max_count = 6;
  if (type === "image-text") config.image_position = "left";
  if (type === "container") applyContainerDefaults(config);
  if (type === "text") applyTextDefaults(config);
  if (type === "image") applyImageDefaults(config);
  if (type === "button") applyButtonDefaults(config);
  if (type === "nav-links") applyNavLinksDefaults(config);
  if (type === "subnav-links") applySubnavLinksDefaults(config);
  if (type === "single-nav-item") applySingleNavItemDefaults(config);
  if (type === "social-links") applySocialLinksDefaults(config);
  if (type === "single-social-link") applySingleSocialLinkDefaults(config);
  return config;
}
```

- [ ] **Step 4: Commit**

```bash
git add admin/src/components/admin/blockShared.tsx admin/src/components/admin/wysiwyg/blockUtils.ts
git commit -m "feat(blocks): add nav/social block labels and default configs"
```

---

## Task 5: Theme Colorpicker Swatches

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/InspectorShared.tsx`

- [ ] **Step 1: Update `ColorRow` to accept `themeColors` and render swatches**

Replace the entire `ColorRow` function with:

```tsx
// Semantic theme color tokens shown as swatches
const THEME_SWATCH_KEYS = [
  "accent",
  "cta",
  "bg",
  "bg-surface",
  "text",
  "muted",
  "border",
  "success",
  "warning",
  "destructive",
] as const;

export function ColorRow({
  label,
  value,
  placeholder,
  onChange,
  themeColors,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onChange: (v: string | null) => void;
  themeColors?: Record<string, string>;
}) {
  // Resolve the display color when value is a CSS var reference
  const resolveColor = (v: string | null): string | undefined => {
    if (!v) return undefined;
    if (v.startsWith("var(--color-")) {
      const key = v.slice(12, -1); // strip "var(--color-" and ")"
      return themeColors?.[`--color-${key}`] ?? undefined;
    }
    return v;
  };

  const displayColor = resolveColor(value);
  const isCssVar = !!value?.startsWith("var(");

  return (
    <div>
      <p className="text-[11px] text-(--color-muted) mb-1.5">{label}</p>

      {/* Theme swatches row */}
      {themeColors && (
        <div className="flex flex-wrap gap-1 mb-2">
          {THEME_SWATCH_KEYS.map((key) => {
            const cssVar = `--color-${key}`;
            const hex = themeColors[cssVar];
            if (!hex) return null;
            const varRef = `var(--color-${key})`;
            const isActive = value === varRef;
            return (
              <button
                key={key}
                type="button"
                title={key}
                onClick={() => onChange(varRef)}
                className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                  isActive ? "border-(--color-accent) scale-110" : "border-transparent"
                }`}
                style={{ background: hex }}
              />
            );
          })}
        </div>
      )}

      <div className="flex items-center border border-(--color-border) rounded bg-(--color-bg) px-2 h-9 gap-2">
        <div
          className="relative w-5 h-5 rounded shrink-0 overflow-hidden"
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            background: displayColor ?? undefined,
            backgroundImage: !displayColor
              ? "linear-gradient(45deg,#aaa 25%,transparent 25%),linear-gradient(-45deg,#aaa 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#aaa 75%),linear-gradient(-45deg,transparent 75%,#aaa 75%)"
              : undefined,
            backgroundSize: "8px 8px",
            backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
          }}
        >
          {!isCssVar && (
            <input
              type="color"
              value={value ?? "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
            />
          )}
        </div>
        {isCssVar ? (
          <span className="flex-1 min-w-0 text-sm font-mono text-(--color-muted) truncate">
            {value}
          </span>
        ) : (
          <input
            type="text"
            value={value ? value.toUpperCase() : ""}
            placeholder={placeholder}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v === "" ? null : v);
            }}
            className="flex-1 min-w-0 bg-transparent border-none text-sm font-mono outline-none"
          />
        )}
        {!!value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-(--color-muted) hover:text-red-400 shrink-0"
          >
            <XIcon />
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/components/admin/wysiwyg/InspectorShared.tsx
git commit -m "feat(inspector): add theme color swatches to ColorRow"
```

---

## Task 6: Pass themeColors Through the Inspector Stack

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/InspectorPanel.tsx`
- Modify: `admin/src/components/admin/wysiwyg/ContainerInspector.tsx`
- Modify: `admin/src/components/admin/wysiwyg/ButtonInspector.tsx`
- Modify: `admin/src/components/admin/wysiwyg/ImageInspector.tsx`
- Modify: `admin/src/components/admin/wysiwyg/TextInspector.tsx`

- [ ] **Step 1: Update `InspectorPanel` to accept and forward `themeColors`**

In `InspectorPanel.tsx`, update the interface and component:

```tsx
interface InspectorPanelProps {
  block: HomeBlock | PageBlock | null;
  mode: "home" | "page";
  activeLang: string;
  onConfigChange: (id: string, key: string, value: unknown) => void;
  onTransChange: (id: string, key: string, value: string) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}
```

Add `themeColors`, `navSnapshot`, `footerSnapshot`, `socialSnapshot` to the destructured props. Pass `themeColors` to each inspector:

```tsx
{block.type === "container" && (
  <ContainerInspector
    config={block.config}
    onConfigChange={cfgChange}
    themeColors={themeColors}
  />
)}

{block.type === "text" && (
  <TextInspector
    config={block.config}
    content={textContent}
    onConfigChange={cfgChange}
    onContentChange={handleTextContentChange}
    themeColors={themeColors}
  />
)}

{block.type === "image" && (
  <ImageInspector config={block.config} onConfigChange={cfgChange} themeColors={themeColors} />
)}

{block.type === "button" && (
  <ButtonInspector config={block.config} onConfigChange={cfgChange} themeColors={themeColors} />
)}

{!["container", "text", "image", "button"].includes(block.type) && (
  <TemplateInspector
    block={block}
    mode={mode}
    activeLang={activeLang}
    onConfigChange={cfgChange}
    onTransChange={transChange}
    themeColors={themeColors}
    navSnapshot={navSnapshot}
    footerSnapshot={footerSnapshot}
    socialSnapshot={socialSnapshot}
  />
)}
```

Also add the import for `NavLink` and `SocialLink` at the top:

```tsx
import type { HomeBlock, PageBlock, NavLink, SocialLink } from "../../../api/types";
```

- [ ] **Step 2: Add `themeColors` prop to `ContainerInspector.tsx`**

Find every `ColorRow` usage in `ContainerInspector.tsx` and add `themeColors={themeColors}`. First add `themeColors?: Record<string, string>` to the props interface. Example:

```tsx
interface ContainerInspectorProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}
```

Then pass it to each `ColorRow`:
```tsx
<ColorRow
  label="Background Color"
  value={config.backgroundColor as string | null}
  placeholder="transparent"
  onChange={(v) => onConfigChange("backgroundColor", v)}
  themeColors={themeColors}
/>
```

(Apply to all ColorRow usages in the file.)

- [ ] **Step 3: Add `themeColors` prop to `ButtonInspector.tsx`**

Same pattern — add `themeColors?: Record<string, string>` to props, pass to every `ColorRow` call.

- [ ] **Step 4: Add `themeColors` prop to `ImageInspector.tsx`**

Same pattern.

- [ ] **Step 5: Add `themeColors` prop to `TextInspector.tsx`**

Same pattern.

- [ ] **Step 6: Commit**

```bash
git add admin/src/components/admin/wysiwyg/InspectorPanel.tsx \
        admin/src/components/admin/wysiwyg/ContainerInspector.tsx \
        admin/src/components/admin/wysiwyg/ButtonInspector.tsx \
        admin/src/components/admin/wysiwyg/ImageInspector.tsx \
        admin/src/components/admin/wysiwyg/TextInspector.tsx
git commit -m "feat(inspector): thread themeColors prop to all ColorRow usages"
```

---

## Task 7: Nav Block Inspector

**Files:**
- Create: `admin/src/components/admin/wysiwyg/NavBlockInspector.tsx`
- Modify: `admin/src/components/admin/wysiwyg/TemplateInspector.tsx`

- [ ] **Step 1: Create `NavBlockInspector.tsx`**

```tsx
/**
 * Inspector fields for the five navigation-aware block types.
 * Receives nav/footer/social snapshots so dropdowns show real link labels.
 */
import type { NavLink, SocialLink } from "../../../api/types";
import { ColorRow } from "./InspectorShared";

interface NavBlockInspectorProps {
  type:
    | "nav-links"
    | "subnav-links"
    | "single-nav-item"
    | "social-links"
    | "single-social-link";
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}

export function NavBlockInspector({
  type,
  config: c,
  onConfigChange,
  themeColors,
  navSnapshot = [],
  footerSnapshot = [],
  socialSnapshot = [],
}: NavBlockInspectorProps) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";

  switch (type) {
    case "nav-links":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Dropdown Style
            </label>
            <select
              value={(c.dropdown_style as string) ?? "simple"}
              onChange={(e) => onConfigChange("dropdown_style", e.target.value)}
              className={sel}
            >
              <option value="simple">Simple dropdown</option>
              <option value="mega">Mega menu (wide panel)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.show_language_switcher ?? true)}
              onChange={(e) =>
                onConfigChange("show_language_switcher", e.target.checked)
              }
              className="w-4 h-4 accent-(--color-accent)"
            />
            Show language switcher
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.sticky ?? true)}
              onChange={(e) => onConfigChange("sticky", e.target.checked)}
              className="w-4 h-4 accent-(--color-accent)"
            />
            Sticky (fixed to top)
          </label>
          <ColorRow
            label="Link Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
          <ColorRow
            label="Background Color"
            value={c.bg_color as string | null}
            placeholder="var(--color-bg-surface)"
            onChange={(v) => onConfigChange("bg_color", v)}
            themeColors={themeColors}
          />
        </div>
      );

    case "subnav-links": {
      const source = (c.source as string) ?? "nav";
      const links = source === "footer" ? footerSnapshot : navSnapshot;
      const parents = links.filter((l) => l.children && l.children.length > 0);

      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Link Source
            </label>
            <select
              value={source}
              onChange={(e) => {
                onConfigChange("source", e.target.value);
                onConfigChange("parent_key", "");
              }}
              className={sel}
            >
              <option value="nav">Navigation (nav_links)</option>
              <option value="footer">Footer (footer_links)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Parent Link (renders its children)
            </label>
            <select
              value={(c.parent_key as string) ?? ""}
              onChange={(e) => onConfigChange("parent_key", e.target.value)}
              className={sel}
            >
              <option value="">— Select a parent link —</option>
              {parents.map((l) => (
                <option key={l.label} value={l.label}>
                  {l.label}
                </option>
              ))}
            </select>
            {parents.length === 0 && (
              <p className="text-xs text-(--color-muted) mt-1">
                No links with children found in the selected source. Add
                dropdown children in Settings → Navigation.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Layout</label>
            <select
              value={(c.layout as string) ?? "vertical"}
              onChange={(e) => onConfigChange("layout", e.target.value)}
              className={sel}
            >
              <option value="vertical">Vertical list</option>
              <option value="horizontal">Horizontal row</option>
              <option value="grid">Grid (2 columns)</option>
            </select>
          </div>
          <ColorRow
            label="Link Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
        </div>
      );
    }

    case "single-nav-item": {
      const source = (c.source as string) ?? "nav";
      const links = source === "footer" ? footerSnapshot : navSnapshot;
      const flatLinks = links.flatMap((l) => [
        l,
        ...(l.children?.filter((ch) => ch.type !== "divider") ?? []),
      ]);

      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Link Source
            </label>
            <select
              value={source}
              onChange={(e) => {
                onConfigChange("source", e.target.value);
                onConfigChange("link_key", "");
              }}
              className={sel}
            >
              <option value="nav">Navigation (nav_links)</option>
              <option value="footer">Footer (footer_links)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Link</label>
            <select
              value={(c.link_key as string) ?? ""}
              onChange={(e) => onConfigChange("link_key", e.target.value)}
              className={sel}
            >
              <option value="">— Select a link —</option>
              {flatLinks.map((l) => (
                <option key={l.label} value={l.label}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Render as</label>
            <select
              value={(c.render_as as string) ?? "link"}
              onChange={(e) => onConfigChange("render_as", e.target.value)}
              className={sel}
            >
              <option value="link">Plain link</option>
              <option value="button">Styled button</option>
            </select>
          </div>
          <ColorRow
            label="Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
        </div>
      );
    }

    case "social-links":
      return (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.show_icons ?? true)}
              onChange={(e) => onConfigChange("show_icons", e.target.checked)}
              className="w-4 h-4 accent-(--color-accent)"
            />
            Show platform icons
          </label>
          <div>
            <label className="block text-xs font-medium mb-1">Icon Style</label>
            <select
              value={(c.icon_style as string) ?? "outline"}
              onChange={(e) => onConfigChange("icon_style", e.target.value)}
              className={sel}
            >
              <option value="outline">Outline</option>
              <option value="filled">Filled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Layout</label>
            <select
              value={(c.layout as string) ?? "horizontal"}
              onChange={(e) => onConfigChange("layout", e.target.value)}
              className={sel}
            >
              <option value="horizontal">Horizontal row</option>
              <option value="vertical">Vertical list</option>
            </select>
          </div>
          <ColorRow
            label="Link Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
          {socialSnapshot.length === 0 && (
            <p className="text-xs text-(--color-muted)">
              No social links configured. Add them in Settings → Footer & Social.
            </p>
          )}
        </div>
      );

    case "single-social-link":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Platform</label>
            <select
              value={(c.platform as string) ?? ""}
              onChange={(e) => onConfigChange("platform", e.target.value)}
              className={sel}
            >
              <option value="">— Select a platform —</option>
              {socialSnapshot.map((s) => (
                <option key={s.platform} value={s.platform}>
                  {s.platform}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.show_icon ?? true)}
              onChange={(e) => onConfigChange("show_icon", e.target.checked)}
              className="w-4 h-4 accent-(--color-accent)"
            />
            Show icon
          </label>
          <ColorRow
            label="Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
        </div>
      );

    default:
      return null;
  }
}
```

- [ ] **Step 2: Wire `NavBlockInspector` into `TemplateInspector.tsx`**

Add the import at top:

```tsx
import { NavBlockInspector } from "./NavBlockInspector";
```

Update `TemplateInspectorProps` to include:

```tsx
interface TemplateInspectorProps {
  block: HomeBlock | PageBlock;
  mode: "home" | "page";
  activeLang: string;
  onConfigChange: (key: string, value: unknown) => void;
  onTransChange: (key: string, value: string) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}
```

Add import for `NavLink` and `SocialLink`:

```tsx
import type { HomeBlock, PageBlock, BlockType, NavLink, SocialLink } from "../../../api/types";
```

In the `TemplateInspector` function, pass them to `BlockTypeFields`:

```tsx
<BlockTypeFields
  block={block}
  type={type}
  t={t}
  setT={setT}
  onConfigChange={onConfigChange}
  themeColors={themeColors}
  navSnapshot={navSnapshot}
  footerSnapshot={footerSnapshot}
  socialSnapshot={socialSnapshot}
/>
```

Update `BlockTypeFields` signature:

```tsx
function BlockTypeFields({
  block,
  type,
  t,
  setT,
  onConfigChange,
  themeColors,
  navSnapshot,
  footerSnapshot,
  socialSnapshot,
}: {
  block: HomeBlock | PageBlock;
  type: BlockType;
  t: (key: string) => string;
  setT: (key: string, value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}) {
```

Add new cases in the `switch` before the `default`:

```tsx
case "nav-links":
case "subnav-links":
case "single-nav-item":
case "social-links":
case "single-social-link":
  return (
    <NavBlockInspector
      type={type as any}
      config={block.config}
      onConfigChange={onConfigChange}
      themeColors={themeColors}
      navSnapshot={navSnapshot}
      footerSnapshot={footerSnapshot}
      socialSnapshot={socialSnapshot}
    />
  );
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/admin/wysiwyg/NavBlockInspector.tsx \
        admin/src/components/admin/wysiwyg/TemplateInspector.tsx
git commit -m "feat(inspector): add NavBlockInspector for 5 new nav block types"
```

---

## Task 8: iframeRenderer — Nav Block Canvas Rendering

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/iframeRenderer.ts`

- [ ] **Step 1: Update `buildSrcdoc` and `RenderBlock` signatures**

Add optional snapshot types to the `buildSrcdoc` signature:

```ts
export interface NavSnapshot {
  navLinks?: Array<{ label: string; url: string; children?: Array<{ label: string; url: string }> }>;
  footerLinks?: Array<{ label: string; url: string }>;
  socialLinks?: Array<{ platform: string; url: string }>;
}

export function buildSrcdoc(
  blocks: RenderBlock[],
  themeVars: Record<string, string>,
  activeLang = "en",
  mode: "home" | "page" = "page",
  navSnapshot: NavSnapshot = {},
): string {
  const themeStyle = buildThemeStyle(themeVars);
  const blocksHtml = renderBlocksHtml(blocks, activeLang, mode, navSnapshot);
  // ... rest unchanged
}
```

Also update `renderBlocksHtml`:

```ts
export function renderBlocksHtml(
  blocks: RenderBlock[],
  activeLang = "en",
  mode: "home" | "page" = "page",
  navSnapshot: NavSnapshot = {},
): string {
  return [...blocks]
    .filter((b) => b.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((b) => blockToHtml(b, activeLang, mode, navSnapshot))
    .join("\n");
}
```

Update `blockToHtml`:

```ts
function blockToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
  navSnapshot: NavSnapshot = {},
): string {
  if (block.visible === false) return "";
  switch (block.type) {
    case "container":
      return containerToHtml(block, activeLang, mode, navSnapshot);
    case "text":
      return textToHtml(block, activeLang, mode);
    case "image":
      return imageToHtml(block);
    case "button":
      return buttonToHtml(block);
    case "nav-links":
    case "subnav-links":
    case "single-nav-item":
    case "social-links":
    case "single-social-link":
      return navBlockHtml(block, navSnapshot);
    default:
      return templatePlaceholderHtml(block);
  }
}
```

Update `containerToHtml` to forward `navSnapshot` into child rendering:

```ts
function containerToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
  navSnapshot: NavSnapshot = {},
): string {
  // ... existing code, but change the inner map to:
  let inner = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((ch) => blockToHtml(ch, activeLang, mode, navSnapshot))
    .join("\n");
  // rest unchanged
}
```

- [ ] **Step 2: Add `navBlockHtml` function**

Add this function after `buttonToHtml`:

```ts
// ── Nav-aware blocks ──────────────────────────────────────────────────────────

function navBlockHtml(block: RenderBlock, snap: NavSnapshot): string {
  const c = block.config;
  const id = escAttr(block.id);
  const label = `<span class="wysiwyg-label">⬡ ${escHtml(navBlockLabel(block.type))}</span>`;

  switch (block.type) {
    case "nav-links": {
      const links = snap.navLinks ?? [];
      const bgColor = (c.bg_color as string) || "var(--color-bg-surface)";
      const linkColor = (c.link_color as string) || "var(--color-muted)";
      const linksHtml = links
        .map(
          (l) =>
            `<a href="#" style="color:${escAttr(linkColor)};text-decoration:none;">${escHtml(l.label)}</a>`,
        )
        .join("\n");
      return `<nav data-wysiwyg-id="${id}" data-wysiwyg-type="nav-links"
        style="background:${escAttr(bgColor)};border-bottom:1px solid var(--color-border);padding:0 24px;"
        class="flex items-center justify-between h-16 gap-6 text-sm">
        ${label}
        <a href="#" style="color:var(--color-accent);font-weight:700;text-decoration:none;">Site Name</a>
        <div class="flex items-center gap-6">${linksHtml}</div>
      </nav>`;
    }

    case "subnav-links": {
      const source = (c.source as string) ?? "nav";
      const parentKey = (c.parent_key as string) ?? "";
      const links = source === "footer" ? snap.footerLinks ?? [] : snap.navLinks ?? [];
      const parent = links.find((l) => l.label === parentKey);
      const children = parent?.children ?? [];
      const layout = (c.layout as string) ?? "vertical";
      const linkColor = (c.link_color as string) || "var(--color-muted)";
      const flexDir = layout === "vertical" ? "column" : layout === "grid" ? "row" : "row";
      const flexWrap = layout === "grid" ? "wrap" : "nowrap";
      const childHtml = children.length
        ? children
            .map(
              (ch) =>
                `<a href="#" style="color:${escAttr(linkColor)};text-decoration:none;${layout === "grid" ? "width:50%;" : ""}">${escHtml(ch.label)}</a>`,
            )
            .join("")
        : `<span style="color:#9ca3af;font-size:12px;">No children — select a parent link with dropdown children</span>`;
      return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="subnav-links"
        style="display:flex;flex-direction:${flexDir};flex-wrap:${flexWrap};gap:8px;padding:12px;">
        ${label}${childHtml}
      </div>`;
    }

    case "single-nav-item": {
      const source = (c.source as string) ?? "nav";
      const linkKey = (c.link_key as string) ?? "";
      const renderAs = (c.render_as as string) ?? "link";
      const links = source === "footer" ? snap.footerLinks ?? [] : snap.navLinks ?? [];
      const allLinks = links.flatMap((l) => [l, ...(l.children ?? [])]);
      const found = allLinks.find((l) => l.label === linkKey);
      const linkColor = (c.link_color as string) || "var(--color-accent)";
      const label2 = found?.label ?? (linkKey || "— select a link —");
      const style =
        renderAs === "button"
          ? `background:${escAttr(linkColor)};color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:14px;`
          : `color:${escAttr(linkColor)};text-decoration:none;font-size:14px;`;
      return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="single-nav-item" style="display:inline-block;padding:8px;">
        ${label}
        <a href="#" style="${escAttr(style)}">${escHtml(label2)}</a>
      </div>`;
    }

    case "social-links": {
      const socials = snap.socialLinks ?? [];
      const layout = (c.layout as string) ?? "horizontal";
      const linkColor = (c.link_color as string) || "var(--color-muted)";
      const showIcons = c.show_icons !== false;
      const flexDir = layout === "vertical" ? "column" : "row";
      const items = socials.length
        ? socials
            .map(
              (s) =>
                `<a href="#" style="color:${escAttr(linkColor)};text-decoration:none;display:flex;align-items:center;gap:4px;">
                ${showIcons ? socialIconSvg(s.platform) : ""}${escHtml(s.platform)}</a>`,
            )
            .join("")
        : `<span style="color:#9ca3af;font-size:12px;">No social links configured</span>`;
      return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="social-links"
        style="display:flex;flex-direction:${flexDir};gap:12px;padding:8px;flex-wrap:wrap;">
        ${label}${items}
      </div>`;
    }

    case "single-social-link": {
      const platform = (c.platform as string) ?? "";
      const found = snap.socialLinks?.find((s) => s.platform === platform);
      const linkColor = (c.link_color as string) || "var(--color-muted)";
      const showIcon = c.show_icon !== false;
      const displayName = found?.platform ?? (platform || "— select a platform —");
      return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="single-social-link" style="display:inline-block;padding:8px;">
        ${label}
        <a href="#" style="color:${escAttr(linkColor)};text-decoration:none;display:flex;align-items:center;gap:4px;">
          ${showIcon ? socialIconSvg(displayName) : ""}${escHtml(displayName)}
        </a>
      </div>`;
    }

    default:
      return templatePlaceholderHtml(block);
  }
}

function navBlockLabel(type: string): string {
  const map: Record<string, string> = {
    "nav-links": "Navigation",
    "subnav-links": "Sub-navigation",
    "single-nav-item": "Nav Item",
    "social-links": "Social Links",
    "single-social-link": "Social Link",
  };
  return map[type] ?? type;
}

// Minimal inline SVG icons for common social platforms
function socialIconSvg(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "github")
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`;
  if (p === "twitter" || p === "x")
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;
  if (p === "linkedin")
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;
  if (p === "instagram")
    return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`;
  // Generic circle icon as fallback
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
}
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/admin/wysiwyg/iframeRenderer.ts
git commit -m "feat(renderer): add nav/social block canvas rendering with snapshot data"
```

---

## Task 9: Canvas and WysiwygShell — Snapshot Props

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/Canvas.tsx`
- Modify: `admin/src/components/admin/wysiwyg/WysiwygShell.tsx`

- [ ] **Step 1: Update `Canvas.tsx` to accept and forward snapshot**

Add `navSnapshot` to `CanvasProps`:

```tsx
import type { BlockType, NavLink, SocialLink } from "../../../api/types";
import {
  buildSrcdoc,
  renderBlocksHtml,
  type RenderBlock,
  type NavSnapshot,
} from "./iframeRenderer";

interface CanvasProps {
  blocks: RenderBlock[];
  selectedBlockId: string | null;
  activeLang: string;
  mode: "home" | "page";
  themeVars: Record<string, string>;
  viewportMode: ViewportMode;
  onSelect: (id: string | null) => void;
  onReorder: (fromId: string, toId: string) => void;
  onContentChange: (id: string, html: string) => void;
  onPaletteDrop: (type: BlockType, targetId: string | null) => void;
  paletteDragType: BlockType | null;
  onDelete: () => void;
  onMoveToContainer: (fromId: string, containerId: string) => void;
  navSnapshot?: NavSnapshot;
}
```

In the Canvas function, accept `navSnapshot = {}` and forward it:

```tsx
// Build srcdoc once on first render
if (!initialSrcdocRef.current) {
  initialSrcdocRef.current = buildSrcdoc(blocks, themeVars, activeLang, mode, navSnapshot);
}

// In the useEffect for block updates:
const html = renderBlocksHtml(blocks, activeLang, mode, navSnapshot);
```

- [ ] **Step 2: Update `WysiwygShell.tsx` to accept and forward snapshot**

Add to `WysiwygShellProps`:

```tsx
import type { NavLink, SocialLink } from "../../../api/types";
import type { NavSnapshot } from "./iframeRenderer";

export interface WysiwygShellProps {
  // ... existing props ...
  navSnapshot?: NavSnapshot;
  themeColors?: Record<string, string>;
}
```

Accept the new props and pass them down:

```tsx
// In Canvas:
<Canvas
  // ... existing props ...
  navSnapshot={navSnapshot}
/>

// In InspectorPanel:
<InspectorPanel
  block={selectedBlock}
  mode={mode}
  activeLang={activeLang}
  onConfigChange={updateBlockConfig}
  onTransChange={updateBlockTranslation}
  themeColors={themeColors}
  navSnapshot={navSnapshot?.navLinks}
  footerSnapshot={navSnapshot?.footerLinks}
  socialSnapshot={navSnapshot?.socialLinks}
/>
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/admin/wysiwyg/Canvas.tsx \
        admin/src/components/admin/wysiwyg/WysiwygShell.tsx
git commit -m "feat(shell): thread navSnapshot and themeColors props through Canvas and WysiwygShell"
```

---

## Task 10: LeftSidebar — Navigation Palette Group

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/LeftSidebar.tsx`

- [ ] **Step 1: Add the Navigation group to `PALETTE`**

In `LeftSidebar.tsx`, add a new group after the "Templates" entry in the `PALETTE` array:

```tsx
{
  label: "Navigation",
  types: [
    "nav-links",
    "subnav-links",
    "single-nav-item",
    "social-links",
    "single-social-link",
  ] as BlockType[],
  icons: {
    "nav-links": <NavLinksIcon />,
    "subnav-links": <SubnavIcon />,
    "single-nav-item": <SingleNavIcon />,
    "social-links": <SocialLinksIcon />,
    "single-social-link": <SingleSocialIcon />,
  },
},
```

- [ ] **Step 2: Add the five icon components at the bottom of `LeftSidebar.tsx`**

After the existing icon components (e.g. `NewsletterIcon`), add:

```tsx
function NavLinksIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M4 8h2M7 8h5M4 11h3" />
    </svg>
  );
}
function SubnavIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 4h10M3 8h7M3 12h4" />
    </svg>
  );
}
function SingleNavIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 8h10M10 5l3 3-3 3" />
    </svg>
  );
}
function SocialLinksIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 7l4-2M6 9l4 2" />
    </svg>
  );
}
function SingleSocialIcon() {
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5v6M5 8h6" />
    </svg>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/components/admin/wysiwyg/LeftSidebar.tsx
git commit -m "feat(sidebar): add Navigation block group to palette"
```

---

## Task 11: HeaderBuilderPage

**Files:**
- Create: `admin/src/pages/admin/HeaderBuilderPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { HomeBlock, Language, NavLink, SocialLink } from "../../api/types";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";
import type { NavSnapshot } from "../../components/admin/wysiwyg/iframeRenderer";

export default function HeaderBuilderPage() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en");
  const [themeVars, setThemeVars] = useState<Record<string, string>>({});
  const [navSnapshot, setNavSnapshot] = useState<NavSnapshot>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  useEffect(() => {
    if (settings?.header_sections) setBlocks(settings.header_sections);
  }, [settings]);

  useEffect(() => {
    if (languages.length > 0)
      setActiveLang(
        languages.find((l) => l.default)?.code ?? languages[0].code,
      );
  }, [languages]);

  // Build theme CSS vars for the iframe canvas
  useEffect(() => {
    const theme = settings?.theme;
    if (!theme?.colors) return;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(theme.colors)) {
      vars[`--color-${k}`] = v;
    }
    if (theme.fonts?.body) vars["--font-body"] = theme.fonts.body;
    if (theme.fonts?.fallback) vars["--font-fallback"] = theme.fonts.fallback;
    setThemeVars(vars);
  }, [settings]);

  // Build nav snapshot from settings
  useEffect(() => {
    if (!settings) return;
    setNavSnapshot({
      navLinks: (settings.nav_links ?? []) as NavLink[],
      footerLinks: (settings.footer_links ?? []) as NavLink[],
      socialLinks: (settings.social_links ?? []) as SocialLink[],
    });
  }, [settings]);

  // Derive themeColors (resolved values) from themeVars for ColorRow swatches
  const themeColors = themeVars;

  const saveMutation = useMutation({
    mutationFn: (header_sections: HomeBlock[]) =>
      adminApi.saveSettings({ header_sections } as any),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <WysiwygShell
      mode="home"
      title="Header Builder"
      subtitle="Compose the site header with blocks"
      themeVars={themeVars}
      themeColors={themeColors}
      languages={languages}
      activeLang={activeLang}
      onActiveLangChange={setActiveLang}
      blocks={blocks}
      onBlocksChange={(updated) => setBlocks(updated as HomeBlock[])}
      onSave={() => saveMutation.mutate(blocks)}
      saving={saveMutation.isPending}
      saved={saved}
      serverError={serverError}
      navSnapshot={navSnapshot}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/admin/HeaderBuilderPage.tsx
git commit -m "feat(admin): add HeaderBuilderPage"
```

---

## Task 12: FooterBuilderPage

**Files:**
- Create: `admin/src/pages/admin/FooterBuilderPage.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { HomeBlock, Language, NavLink, SocialLink } from "../../api/types";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";
import type { NavSnapshot } from "../../components/admin/wysiwyg/iframeRenderer";
import { makeHomeBlock } from "../../components/admin/wysiwyg/blockUtils";
import { withNormalizedOrder } from "../../components/admin/wysiwyg/blockUtils";

function buildDefaultFooterTemplate(lang: string): HomeBlock[] {
  // Outer container: horizontal 3-column layout
  const outer = makeHomeBlock("container", 0) as HomeBlock;
  outer.config.direction = "row";
  outer.config.wrap = "wrap";
  outer.config.justify = "between";
  outer.config.align = "start";
  outer.config.paddingTop = 12;
  outer.config.paddingBottom = 12;
  outer.config.width = "w-page";

  // Col 1: site name text block
  const siteInfo = makeHomeBlock("text", 0) as HomeBlock;
  siteInfo.config.tag = "p";
  siteInfo.config.fontWeight = "semibold";
  siteInfo.translations = { [lang]: { content: "Site Name" } };

  // Col 2: footer-links block
  const footerLinks = makeHomeBlock("subnav-links", 1) as HomeBlock;
  footerLinks.config.source = "footer";
  footerLinks.config.parent_key = "";
  footerLinks.config.layout = "vertical";

  // Col 3: social-links block
  const socialLinks = makeHomeBlock("social-links", 2) as HomeBlock;
  socialLinks.config.show_icons = true;
  socialLinks.config.layout = "vertical";

  outer.children = [siteInfo, footerLinks, socialLinks];

  return withNormalizedOrder([outer]) as HomeBlock[];
}

export default function FooterBuilderPage() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en");
  const [themeVars, setThemeVars] = useState<Record<string, string>>({});
  const [navSnapshot, setNavSnapshot] = useState<NavSnapshot>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  useEffect(() => {
    if (settings?.footer_sections) setBlocks(settings.footer_sections);
  }, [settings]);

  useEffect(() => {
    if (languages.length > 0)
      setActiveLang(
        languages.find((l) => l.default)?.code ?? languages[0].code,
      );
  }, [languages]);

  useEffect(() => {
    const theme = settings?.theme;
    if (!theme?.colors) return;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(theme.colors)) {
      vars[`--color-${k}`] = v;
    }
    if (theme.fonts?.body) vars["--font-body"] = theme.fonts.body;
    if (theme.fonts?.fallback) vars["--font-fallback"] = theme.fonts.fallback;
    setThemeVars(vars);
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    setNavSnapshot({
      navLinks: (settings.nav_links ?? []) as NavLink[],
      footerLinks: (settings.footer_links ?? []) as NavLink[],
      socialLinks: (settings.social_links ?? []) as SocialLink[],
    });
  }, [settings]);

  const themeColors = themeVars;

  const saveMutation = useMutation({
    mutationFn: (footer_sections: HomeBlock[]) =>
      adminApi.saveSettings({ footer_sections } as any),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  function loadDefaultTemplate() {
    setBlocks(buildDefaultFooterTemplate(activeLang));
  }

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <WysiwygShell
      mode="home"
      title="Footer Builder"
      subtitle={
        blocks.length === 0 ? "Canvas is empty — load the default template to start" : "Compose the site footer with blocks"
      }
      themeVars={themeVars}
      themeColors={themeColors}
      languages={languages}
      activeLang={activeLang}
      onActiveLangChange={setActiveLang}
      blocks={blocks}
      onBlocksChange={(updated) => setBlocks(updated as HomeBlock[])}
      onSave={() => saveMutation.mutate(blocks)}
      saving={saveMutation.isPending}
      saved={saved}
      serverError={serverError}
      navSnapshot={navSnapshot}
      onLoadDefaultTemplate={blocks.length === 0 ? loadDefaultTemplate : undefined}
    />
  );
}
```

- [ ] **Step 2: Add `onLoadDefaultTemplate` prop to `WysiwygShell`**

In `WysiwygShell.tsx`, add to `WysiwygShellProps`:

```tsx
onLoadDefaultTemplate?: () => void;
```

In the top bar's right side, after the save button, add:

```tsx
{onLoadDefaultTemplate && (
  <button
    onClick={onLoadDefaultTemplate}
    className="px-3 py-1.5 text-sm border border-(--color-border) rounded text-(--color-muted) hover:text-(--color-text)"
  >
    Load default template
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/pages/admin/FooterBuilderPage.tsx \
        admin/src/components/admin/wysiwyg/WysiwygShell.tsx
git commit -m "feat(admin): add FooterBuilderPage with default template loader"
```

---

## Task 13: Admin Routing and Sidebar

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/layouts/AdminLayout.tsx`

- [ ] **Step 1: Add lazy imports and routes in `App.tsx`**

Add after the `HomeBuilderPage` import:

```tsx
const HeaderBuilderPage = lazy(() => import("./pages/admin/HeaderBuilderPage"));
const FooterBuilderPage = lazy(() => import("./pages/admin/FooterBuilderPage"));
```

Add after the `home-builder` route (inside the `/admin` children array):

```tsx
{
  path: "header-builder",
  element: (
    <Suspense fallback={<Loading />}>
      <HeaderBuilderPage />
    </Suspense>
  ),
},
{
  path: "footer-builder",
  element: (
    <Suspense fallback={<Loading />}>
      <FooterBuilderPage />
    </Suspense>
  ),
},
```

- [ ] **Step 2: Add sidebar links in `AdminLayout.tsx`**

In the `links` array, after `{ label: "Home Builder", to: "/admin/home-builder", section: false }`, add:

```ts
{ label: "Header Builder", to: "/admin/header-builder", section: false },
{ label: "Footer Builder", to: "/admin/footer-builder", section: false },
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/App.tsx admin/src/layouts/AdminLayout.tsx
git commit -m "feat(routing): add Header Builder and Footer Builder admin routes"
```

---

## Task 14: Build and Smoke Test Admin

- [ ] **Step 1: Build admin**

```bash
cd admin && npm run build
```

Expected: no TypeScript errors, build succeeds.

- [ ] **Step 2: Start backend and open admin**

```bash
cd backend && go run cmd/server/main.go
```

Open `http://localhost:8080/admin` → navigate to Header Builder. Verify:
- Page loads with empty canvas
- "Navigation" group visible in Add palette with 5 new tiles
- Adding a `nav-links` block shows a styled nav preview in the canvas (not a placeholder)
- Selecting the block shows the inspector with dropdown_style, sticky, colors
- ColorRow shows circular swatches for theme colors
- Clicking a swatch sets the value to `var(--color-accent)` etc.

Navigate to Footer Builder:
- Empty canvas shows "Load default template" button in top bar
- Clicking it populates a 3-column container layout
- Adding `social-links` block shows platforms from social_links snapshot

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: smoke test admin builds and nav blocks render"
```

---

## Task 15: Eleventy Data Files

**Files:**
- Create: `site/src/_data/header.js`
- Create: `site/src/_data/footer_sections.js`

- [ ] **Step 1: Create `header.js`**

```js
/**
 * Fetches header builder block data from the backend.
 * Returns a per-language map: header.byLang[langCode] = HomeBlock[]
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn("[folio] Could not fetch language config for header data");
  }

  const byLang = {};

  for (const lang of languages) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/v1/config/header?lang=${lang.code}`,
      );
      if (res.ok) {
        const blocks = await res.json();
        byLang[lang.code] = Array.isArray(blocks)
          ? blocks
              .filter((b) => b.visible !== false)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [];
      } else {
        byLang[lang.code] = [];
      }
    } catch {
      console.warn(`[folio] Could not fetch header data for lang ${lang.code}`);
      byLang[lang.code] = [];
    }
  }

  return { byLang };
}
```

- [ ] **Step 2: Create `footer_sections.js`**

```js
/**
 * Fetches footer builder block data from the backend.
 * Returns a per-language map: footer_sections.byLang[langCode] = HomeBlock[]
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn("[folio] Could not fetch language config for footer_sections data");
  }

  const byLang = {};

  for (const lang of languages) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/v1/config/footer-sections?lang=${lang.code}`,
      );
      if (res.ok) {
        const blocks = await res.json();
        byLang[lang.code] = Array.isArray(blocks)
          ? blocks
              .filter((b) => b.visible !== false)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [];
      } else {
        byLang[lang.code] = [];
      }
    } catch {
      console.warn(`[folio] Could not fetch footer_sections for lang ${lang.code}`);
      byLang[lang.code] = [];
    }
  }

  return { byLang };
}
```

- [ ] **Step 3: Commit**

```bash
git add site/src/_data/header.js site/src/_data/footer_sections.js
git commit -m "feat(site): add header.js and footer_sections.js Eleventy data files"
```

---

## Task 16: New Block Partials

**Files:**
- Create: `site/src/_includes/partials/blocks/nav-links.njk`
- Create: `site/src/_includes/partials/blocks/subnav-links.njk`
- Create: `site/src/_includes/partials/blocks/single-nav-item.njk`
- Create: `site/src/_includes/partials/blocks/social-links.njk`
- Create: `site/src/_includes/partials/blocks/single-social-link.njk`

- [ ] **Step 1: Create `nav-links.njk`**

```nunjucks
{%- set cfg = block.config -%}
{%- set isSticky = cfg.sticky !== false -%}
{%- set bgColor = cfg.bg_color or "var(--color-bg-surface)" -%}
{%- set linkColor = cfg.link_color or "var(--color-muted)" -%}
{%- set dropdownStyle = cfg.dropdown_style or "simple" -%}
<nav style="background:{{ bgColor }};border-bottom:1px solid var(--color-border);"
     class="{% if isSticky %}sticky top-0 z-30{% endif %}">
  <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
    <a href="/{{ lang }}/" class="flex items-center" style="color:var(--color-accent);">
      {% if site.logo %}
        <img src="{{ site.logo }}" alt="{{ site.name }}" class="h-9 max-w-40 object-contain" />
      {% else %}
        <span class="font-bold text-lg tracking-tight">{{ site.name }}</span>
      {% endif %}
    </a>

    <div class="hidden md:flex items-center gap-6 text-sm">
      {% for link in nav.byLang[lang] %}
        {% if link.children and link.children.length %}
          {% if dropdownStyle === "mega" %}
            <div class="relative" data-dropdown>
              <button data-dropdown-toggle style="color:{{ linkColor }};" class="flex items-center gap-1 transition-colors">
                {{ link.labels[lang] if (link.labels and link.labels[lang]) else link.label }}
                <svg class="w-3 h-3" data-chevron fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
              <div class="absolute left-0 top-full mt-2 hidden z-40 rounded-lg shadow-xl"
                   style="background:var(--color-bg-surface);border:1px solid var(--color-border);width:100vw;max-width:640px;left:50%;transform:translateX(-50%);"
                   data-dropdown-menu>
                <div class="grid grid-cols-2 gap-1 p-4">
                  {% for child in link.children %}
                    {% if child.type !== "divider" %}
                      {% if child.type === "builtin" or child.type === "page" %}
                        <a href="/{{ lang }}{{ child.url }}" class="block px-4 py-2 text-sm rounded transition-colors"
                           style="color:var(--color-text);"
                           onmouseover="this.style.background='var(--color-border)'" onmouseout="this.style.background=''">
                          {{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}
                        </a>
                      {% else %}
                        <a href="{{ child.url }}" target="_blank" rel="noopener noreferrer"
                           class="block px-4 py-2 text-sm rounded transition-colors"
                           style="color:var(--color-text);"
                           onmouseover="this.style.background='var(--color-border)'" onmouseout="this.style.background=''">
                          {{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}
                        </a>
                      {% endif %}
                    {% endif %}
                  {% endfor %}
                </div>
              </div>
            </div>
          {% else %}
            <div class="relative" data-dropdown>
              <div class="flex items-center gap-0.5">
                {% if link.type === "builtin" or link.type === "page" %}
                  <a href="/{{ lang }}{{ link.url }}" style="color:{{ linkColor }};" class="transition-colors">{{ link.labels[lang] if (link.labels and link.labels[lang]) else link.label }}</a>
                {% else %}
                  <span style="color:{{ linkColor }};">{{ link.labels[lang] if (link.labels and link.labels[lang]) else link.label }}</span>
                {% endif %}
                <button data-dropdown-toggle style="color:{{ linkColor }};" class="flex items-center px-1 py-1 cursor-pointer" aria-label="Open menu">
                  <svg class="w-3 h-3 transition-transform duration-150" data-chevron fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
              </div>
              <div class="absolute left-0 top-full mt-1.5 min-w-44 rounded-lg shadow-lg hidden z-40 py-1"
                   style="background:var(--color-bg-surface);border:1px solid var(--color-border);" data-dropdown-menu>
                {% for child in link.children %}
                  {% if child.type === "divider" %}
                    <div style="border-top:1px solid var(--color-border);margin:4px 8px;"></div>
                  {% else %}
                    {% if child.type === "builtin" or child.type === "page" %}
                      <a href="/{{ lang }}{{ child.url }}" class="block px-4 py-2 text-sm transition-colors" style="color:var(--color-text);" onmouseover="this.style.background='var(--color-border)'" onmouseout="this.style.background=''">{{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}</a>
                    {% else %}
                      <a href="{{ child.url }}" target="_blank" rel="noopener noreferrer" class="block px-4 py-2 text-sm transition-colors" style="color:var(--color-text);" onmouseover="this.style.background='var(--color-border)'" onmouseout="this.style.background=''">{{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}</a>
                    {% endif %}
                  {% endif %}
                {% endfor %}
              </div>
            </div>
          {% endif %}
        {% else %}
          {% if link.type === "builtin" or link.type === "page" %}
            <a href="/{{ lang }}{{ link.url }}" style="color:{{ linkColor }};" class="transition-colors">{{ link.labels[lang] if (link.labels and link.labels[lang]) else link.label }}</a>
          {% else %}
            <a href="{{ link.url }}" style="color:{{ linkColor }};" class="transition-colors" target="_blank" rel="noopener noreferrer">{{ link.labels[lang] if (link.labels and link.labels[lang]) else link.label }}</a>
          {% endif %}
        {% endif %}
      {% endfor %}

      {% if cfg.show_language_switcher !== false and config.languages | length > 1 %}
        <div class="relative" data-lang-switcher>
          <button class="flex items-center gap-1 text-xs uppercase tracking-wider" style="color:{{ linkColor }};" data-lang-toggle>
            {{ lang }}
            <svg class="w-3 h-3" data-chevron fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div class="absolute right-0 top-full mt-1 rounded shadow-md min-w-20 hidden" style="background:var(--color-bg-surface);border:1px solid var(--color-border);" data-lang-menu>
            {% for l in config.languages %}
              {% if l.code !== lang %}
                <a href="/{{ l.code }}/" class="block px-4 py-2 text-sm uppercase" style="color:var(--color-text);" onmouseover="this.style.background='var(--color-border)'" onmouseout="this.style.background=''">{{ l.code }}</a>
              {% endif %}
            {% endfor %}
          </div>
        </div>
      {% endif %}
    </div>

    <button class="md:hidden p-2" style="color:{{ linkColor }};" data-nav-toggle aria-label="Open menu">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
    </button>
  </div>

  <div class="md:hidden hidden" style="border-top:1px solid var(--color-border);" data-mobile-menu>
    <div class="px-6 py-4 space-y-3 text-sm">
      {% for link in nav.byLang[lang] %}
        {% if link.children and link.children.length %}
          <div data-mobile-dropdown>
            <div class="flex items-center justify-between gap-2 py-0.5">
              {% if link.type === "builtin" or link.type === "page" %}
                <a href="/{{ lang }}{{ link.url }}" class="flex-1" style="color:var(--color-text);">{{ link.labels[lang] if (link.labels and link.labels[lang]) else link.label }}</a>
              {% else %}
                <span class="flex-1" style="color:var(--color-text);">{{ link.labels[lang] if (link.labels and link.labels[lang]) else link.label }}</span>
              {% endif %}
              <button data-mobile-dropdown-toggle class="p-1 shrink-0" style="color:{{ linkColor }};" aria-label="Toggle submenu">
                <svg class="w-3.5 h-3.5 transition-transform duration-150" data-chevron fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
              </button>
            </div>
            <div class="hidden pl-3 mt-2 space-y-2" data-mobile-dropdown-menu style="border-left:2px solid var(--color-border);">
              {% for child in link.children %}
                {% if child.type === "divider" %}
                  <div style="border-top:1px solid var(--color-border);"></div>
                {% elif child.type === "builtin" or child.type === "page" %}
                  <a href="/{{ lang }}{{ child.url }}" class="block py-0.5" style="color:{{ linkColor }};">{{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}</a>
                {% else %}
                  <a href="{{ child.url }}" class="block py-0.5" style="color:{{ linkColor }};" target="_blank" rel="noopener noreferrer">{{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}</a>
                {% endif %}
              {% endfor %}
            </div>
          </div>
        {% elif link.type === "builtin" or link.type === "page" %}
          <a href="/{{ lang }}{{ link.url }}" class="block" style="color:var(--color-text);">{{ link.label }}</a>
        {% else %}
          <a href="{{ link.url }}" class="block" style="color:var(--color-text);" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
        {% endif %}
      {% endfor %}
    </div>
  </div>
</nav>
```

- [ ] **Step 2: Create `subnav-links.njk`**

```nunjucks
{%- set cfg = block.config -%}
{%- set source = cfg.source or "nav" -%}
{%- set parentKey = cfg.parent_key or "" -%}
{%- set layout = cfg.layout or "vertical" -%}
{%- set linkColor = cfg.link_color or "var(--color-muted)" -%}
{%- set links = footer.byLang[lang] if source === "footer" else nav.byLang[lang] -%}
{%- set parent = null -%}
{% for l in links %}
  {% if l.label === parentKey %}
    {%- set parent = l -%}
  {% endif %}
{% endfor %}
{% if parent and parent.children %}
  <ul class="{% if layout === 'horizontal' %}flex flex-wrap gap-4{% elif layout === 'grid' %}grid grid-cols-2 gap-2{% else %}space-y-2{% endif %} text-sm">
    {% for child in parent.children %}
      {% if child.type !== "divider" %}
        <li>
          {% if child.type === "builtin" or child.type === "page" %}
            <a href="/{{ lang }}{{ child.url }}" style="color:{{ linkColor }};" onmouseover="this.style.color='var(--color-text)'" onmouseout="this.style.color='{{ linkColor }}'">{{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}</a>
          {% else %}
            <a href="{{ child.url }}" target="_blank" rel="noopener noreferrer" style="color:{{ linkColor }};" onmouseover="this.style.color='var(--color-text)'" onmouseout="this.style.color='{{ linkColor }}'">{{ child.labels[lang] if (child.labels and child.labels[lang]) else child.label }}</a>
          {% endif %}
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endif %}
```

- [ ] **Step 3: Create `single-nav-item.njk`**

```nunjucks
{%- set cfg = block.config -%}
{%- set source = cfg.source or "nav" -%}
{%- set linkKey = cfg.link_key or "" -%}
{%- set renderAs = cfg.render_as or "link" -%}
{%- set linkColor = cfg.link_color or "var(--color-accent)" -%}
{%- set links = footer.byLang[lang] if source === "footer" else nav.byLang[lang] -%}
{%- set found = null -%}
{% for l in links %}
  {% if l.label === linkKey %}
    {%- set found = l -%}
  {% endif %}
  {% if found === null and l.children %}
    {% for ch in l.children %}
      {% if ch.label === linkKey %}
        {%- set found = ch -%}
      {% endif %}
    {% endfor %}
  {% endif %}
{% endfor %}
{% if found %}
  {% set href = ("/"+lang+found.url) if (found.type === "builtin" or found.type === "page") else found.url %}
  {% set isExternal = found.type === "external" %}
  {% if renderAs === "button" %}
    <a href="{{ href }}"{% if isExternal %} target="_blank" rel="noopener noreferrer"{% endif %}
       class="inline-block px-4 py-2 text-sm rounded font-medium"
       style="background:{{ linkColor }};color:#fff;text-decoration:none;">
      {{ found.labels[lang] if (found.labels and found.labels[lang]) else found.label }}
    </a>
  {% else %}
    <a href="{{ href }}"{% if isExternal %} target="_blank" rel="noopener noreferrer"{% endif %}
       style="color:{{ linkColor }};text-decoration:none;">
      {{ found.labels[lang] if (found.labels and found.labels[lang]) else found.label }}
    </a>
  {% endif %}
{% endif %}
```

- [ ] **Step 4: Create `social-links.njk`**

```nunjucks
{%- set cfg = block.config -%}
{%- set showIcons = cfg.show_icons !== false -%}
{%- set layout = cfg.layout or "horizontal" -%}
{%- set linkColor = cfg.link_color or "var(--color-muted)" -%}
{% if social | length %}
  <ul class="{% if layout === 'horizontal' %}flex flex-wrap gap-4{% else %}space-y-2{% endif %} text-sm">
    {% for s in social %}
      {% if s.url %}
        <li>
          <a href="{{ s.url }}" target="_blank" rel="noopener noreferrer"
             style="color:{{ linkColor }};text-decoration:none;display:inline-flex;align-items:center;gap:6px;"
             onmouseover="this.style.color='var(--color-text)'" onmouseout="this.style.color='{{ linkColor }}'">
            {% if showIcons %}
              {{ s.platform | socialIcon | safe }}
            {% endif %}
            {{ s.platform }}
          </a>
        </li>
      {% endif %}
    {% endfor %}
  </ul>
{% endif %}
```

Note: The `socialIcon` filter needs to be added to `eleventy.config.js`. Add this step below.

- [ ] **Step 5: Create `single-social-link.njk`**

```nunjucks
{%- set cfg = block.config -%}
{%- set platform = cfg.platform or "" -%}
{%- set showIcon = cfg.show_icon !== false -%}
{%- set linkColor = cfg.link_color or "var(--color-muted)" -%}
{% for s in social %}
  {% if s.platform === platform and s.url %}
    <a href="{{ s.url }}" target="_blank" rel="noopener noreferrer"
       style="color:{{ linkColor }};text-decoration:none;display:inline-flex;align-items:center;gap:6px;"
       onmouseover="this.style.color='var(--color-text)'" onmouseout="this.style.color='{{ linkColor }}'">
      {% if showIcon %}{{ s.platform | socialIcon | safe }}{% endif %}
      {{ s.platform }}
    </a>
  {% endif %}
{% endfor %}
```

- [ ] **Step 6: Add `socialIcon` filter to `eleventy.config.js`**

Open `site/eleventy.config.js` and add this filter inside the config function (before `return eleventyConfig`):

```js
eleventyConfig.addFilter("socialIcon", function(platform) {
  const p = (platform || "").toLowerCase();
  const icons = {
    github: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
    twitter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    linkedin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
    facebook: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
    youtube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    mastodon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/></svg>`,
    bluesky: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.812 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>`,
  };
  return icons[p] || `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`;
});
```

- [ ] **Step 7: Commit all new partials**

```bash
git add site/src/_includes/partials/blocks/nav-links.njk \
        site/src/_includes/partials/blocks/subnav-links.njk \
        site/src/_includes/partials/blocks/single-nav-item.njk \
        site/src/_includes/partials/blocks/social-links.njk \
        site/src/_includes/partials/blocks/single-social-link.njk \
        site/eleventy.config.js
git commit -m "feat(site): add nav/social block partials and socialIcon filter"
```

---

## Task 17: Replace nav.njk and footer.njk

**Files:**
- Modify: `site/src/_includes/partials/nav.njk`
- Modify: `site/src/_includes/partials/footer.njk`

- [ ] **Step 1: Replace `nav.njk`**

Replace the entire file content with:

```nunjucks
{% for b in header.byLang[lang] %}
  {% if b.visible !== false %}
    {% set block = b %}
    {% include "partials/blocks/" + b.type + ".njk" %}
  {% endif %}
{% endfor %}
```

- [ ] **Step 2: Replace `footer.njk`**

Replace the entire file content with:

```nunjucks
{% for b in footer_sections.byLang[lang] %}
  {% if b.visible !== false %}
    {% set block = b %}
    {% include "partials/blocks/" + b.type + ".njk" %}
  {% endif %}
{% endfor %}
<div style="border-top: 1px solid var(--color-border);">
  <p class="text-xs text-center py-4" style="color: var(--color-muted);">© {{ site.name }} · Powered by <a href="https://github.com/vl4d1m1r4/folio" class="hover:underline" style="color: var(--color-muted);">Folio</a></p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add site/src/_includes/partials/nav.njk site/src/_includes/partials/footer.njk
git commit -m "feat(site): replace nav.njk and footer.njk with block renderer loops"
```

---

## Task 18: End-to-End Test

- [ ] **Step 1: Start backend**

```bash
cd backend && go run cmd/server/main.go
```

- [ ] **Step 2: Build admin and verify no errors**

```bash
cd admin && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Configure header via Header Builder**

1. Open `http://localhost:8080/admin/header-builder`
2. Add a `nav-links` block — canvas should show real link labels
3. Set `dropdown_style: mega` on the block
4. Click a theme color swatch in the inspector — value should change to `var(--color-accent)`
5. Save

- [ ] **Step 4: Configure footer via Footer Builder**

1. Open `http://localhost:8080/admin/footer-builder`
2. Click "Load default template" — canvas should show a 3-column layout
3. Save

- [ ] **Step 5: Build site and verify**

```bash
cd site && npm run build
```

Expected: build succeeds.

- [ ] **Step 6: Check rendered output**

Inspect `site/dist` — find any built HTML file and verify:
- The nav section contains `<nav` from `nav-links.njk` (not the old hardcoded nav)
- The footer section contains the block-rendered content
- The copyright `© site.name · Powered by Folio` line is present at the bottom

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: end-to-end verification — header/footer builders working"
```

---

## Known Limitation

`subnav-links` and `single-nav-item` use the link's `label` string as identifier (`parent_key` / `link_key`). Renaming a nav link label will cause the block to silently render nothing at build time. Future fix: use a stable `id` field on `NavLink`.
