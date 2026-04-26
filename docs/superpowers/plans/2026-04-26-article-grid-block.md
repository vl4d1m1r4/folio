# Article Grid Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded `featured-articles` / `latest-articles` blocks with a new `article-grid` block whose card layout is fully composable from WYSIWYG child blocks, while data is fetched from the real articles API at build time.

**Architecture:** A new `article-grid` block type stores its card template as `b.children` (a block tree of `article-image`, `article-title`, `article-excerpt`, `article-date`, `article-tag` plus any layout primitives). The WYSIWYG canvas renders 3 inline mock cards for live preview. At Eleventy build time, `article-grid.njk` loops real articles, sets `_articleCtx` in scope, and dispatches `b.children` to field partials — Nunjucks include-scope propagation makes `_articleCtx` available in nested `container.njk` includes automatically. Old `featured-articles` / `latest-articles` blocks remain untouched for backward compat.

**Tech Stack:** TypeScript/React (admin WYSIWYG), Nunjucks/Eleventy (site SSG), existing Tailwind CDN (canvas), inline styles (site partials for dynamic values)

---

## File Map

### New files
- `admin/src/components/admin/wysiwyg/ArticlesInspector.tsx` — inspector panel for `article-grid` config (source, count, cols, gap, padding, title)
- `admin/src/components/admin/wysiwyg/ArticleFieldInspector.tsx` — inspector panel for the 5 article-field block types
- `site/src/_includes/partials/blocks/article-grid.njk` — loops articles, dispatches card template children
- `site/src/_includes/partials/blocks/article-image.njk` — renders `_articleCtx.cover_image_path`
- `site/src/_includes/partials/blocks/article-title.njk` — renders `_articleCtx.title` as a link
- `site/src/_includes/partials/blocks/article-excerpt.njk` — renders `_articleCtx.excerpt`
- `site/src/_includes/partials/blocks/article-date.njk` — renders `_articleCtx.published_at`
- `site/src/_includes/partials/blocks/article-tag.njk` — renders `_articleCtx.tag` as badge or text

### Modified files
- `admin/src/api/types.ts` — extend `BlockType` union with 6 new values
- `admin/src/components/admin/blockShared.tsx` — add 6 labels + 6 default-applier functions
- `admin/src/components/admin/wysiwyg/blockUtils.ts` — add 6 imports, update `baseConfig()`, add `buildDefaultArticleCardTemplate()`, update `makeHomeBlock()`/`makePageBlock()`
- `admin/src/components/admin/wysiwyg/InspectorPanel.tsx` — route new block types to new inspectors
- `admin/src/components/admin/wysiwyg/LeftSidebar.tsx` — add palette group + icons
- `admin/src/components/admin/wysiwyg/iframeRenderer.ts` — add `MockArticleCtx`, `MOCK_ARTICLES`, `articleGridToHtml()`, 5 field renderers, thread `articleCtx` param through `blockToHtml`/`containerToHtml`
- `site/src/_includes/partials/blocks/container.njk` — add 6 new dispatch entries
- `site/src/index.njk` — add `article-grid` dispatch
- `site/src/page.njk` — add `article-grid` dispatch

---

## Task 1: Extend TypeScript type system

**Files:**
- Modify: `admin/src/api/types.ts`
- Modify: `admin/src/components/admin/blockShared.tsx`

- [ ] **Step 1: Add 6 new values to `BlockType` in `admin/src/api/types.ts`**

Find the line `| "preset-footer";` and replace the whole union with:

```typescript
  | "preset-nav"
  | "preset-footer"
  | "article-grid"
  | "article-image"
  | "article-title"
  | "article-excerpt"
  | "article-date"
  | "article-tag";
```

- [ ] **Step 2: Add 6 entries to `BLOCK_LABELS` in `admin/src/components/admin/blockShared.tsx`**

Find `"preset-footer": "Footer Preset",` and add after it:

```typescript
  "article-grid": "Article Grid",
  "article-image": "Article Image",
  "article-title": "Article Title",
  "article-excerpt": "Article Excerpt",
  "article-date": "Article Date",
  "article-tag": "Article Tag",
```

- [ ] **Step 3: Add 6 default-applier functions to `admin/src/components/admin/blockShared.tsx`**

Add these after `applySingleSocialLinkDefaults`:

```typescript
export function applyArticleGridDefaults(config: Record<string, unknown>): void {
  config.source = "latest";      // "latest" | "featured" | "tag"
  config.tag_filter = "";        // used when source="tag"
  config.max_count = 6;
  config.grid_cols = 3;
  config.gap = 6;
  config.section_title = "";
  config.show_view_all = true;
  config.padding_top = 10;
  config.padding_bottom = 10;
}

export function applyArticleImageDefaults(config: Record<string, unknown>): void {
  config.aspect_ratio = "16/9";  // "16/9" | "4/3" | "3/2" | "1/1"
  config.object_fit = "cover";
  config.border_radius = 0;
}

export function applyArticleTitleDefaults(config: Record<string, unknown>): void {
  config.tag = "h3";             // "h2" | "h3" | "h4"
  config.font_weight = "bold";
  config.font_size = null;
  config.color = null;           // null = var(--color-text)
  config.link_color = null;      // null = inherit
}

export function applyArticleExcerptDefaults(config: Record<string, unknown>): void {
  config.line_clamp = 3;         // 2 | 3 | 4 | 0 (none)
  config.font_size = null;
  config.color = null;           // null = var(--color-muted)
}

export function applyArticleDateDefaults(config: Record<string, unknown>): void {
  config.font_size = null;
  config.color = null;           // null = var(--color-muted)
}

export function applyArticleTagDefaults(config: Record<string, unknown>): void {
  config.style = "badge";        // "badge" | "text"
  config.color = null;           // null = var(--color-accent)
  config.bg_color = null;        // null = rgba(accent,0.1)
}
```

- [ ] **Step 4: Type-check**

```bash
cd c:/data/openblog/admin && npx tsc --noEmit 2>&1 | head -40
```

Expected: only errors in files not yet modified (zero errors in types.ts and blockShared.tsx).

- [ ] **Step 5: Commit**

```bash
cd c:/data/openblog && git add admin/src/api/types.ts admin/src/components/admin/blockShared.tsx
git commit -m "feat: add article-grid block types and defaults"
```

---

## Task 2: Update block factory in blockUtils.ts

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/blockUtils.ts`

- [ ] **Step 1: Add 6 new imports in `blockUtils.ts`**

Find the import block at the top that ends with `applySingleSocialLinkDefaults,` and extend it:

```typescript
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
  applyArticleGridDefaults,
  applyArticleImageDefaults,
  applyArticleTitleDefaults,
  applyArticleExcerptDefaults,
  applyArticleDateDefaults,
  applyArticleTagDefaults,
} from "../blockShared";
```

- [ ] **Step 2: Add 6 new cases to `baseConfig()` in `blockUtils.ts`**

Find the end of `baseConfig()` (just before `return config;`) and add:

```typescript
  if (type === "article-grid") applyArticleGridDefaults(config);
  if (type === "article-image") applyArticleImageDefaults(config);
  if (type === "article-title") applyArticleTitleDefaults(config);
  if (type === "article-excerpt") applyArticleExcerptDefaults(config);
  if (type === "article-date") applyArticleDateDefaults(config);
  if (type === "article-tag") applyArticleTagDefaults(config);
```

- [ ] **Step 3: Add `buildDefaultArticleCardTemplate()` to `blockUtils.ts`**

Add this exported function before `makeHomeBlock`:

```typescript
/**
 * Returns the default card-template children for a new article-grid block.
 * Structure: card container → [article-image, content container → [article-tag, article-title, article-excerpt, article-date]]
 */
export function buildDefaultArticleCardTemplate(): HomeBlock[] {
  // Outer card container (col, no padding, slight radius)
  const card = makeHomeBlock("container", 0) as HomeBlock;
  card.config.direction = "col";
  card.config.wrap = "nowrap";
  card.config.width = "w-full";
  card.config.paddingTop = 0;
  card.config.paddingBottom = 0;
  card.config.paddingLeft = 0;
  card.config.paddingRight = 0;
  card.config.gapX = 0;
  card.config.gapY = 0;
  card.config.borderRadius = 8;

  // Article image
  const img = makeHomeBlock("article-image", 0) as HomeBlock;

  // Content container (col, padding, gap between fields)
  const content = makeHomeBlock("container", 1) as HomeBlock;
  content.config.direction = "col";
  content.config.wrap = "nowrap";
  content.config.width = "w-full";
  content.config.paddingTop = 4;
  content.config.paddingBottom = 4;
  content.config.paddingLeft = 4;
  content.config.paddingRight = 4;
  content.config.gapX = 0;
  content.config.gapY = 2;

  const tag = makeHomeBlock("article-tag", 0) as HomeBlock;
  const title = makeHomeBlock("article-title", 1) as HomeBlock;
  const excerpt = makeHomeBlock("article-excerpt", 2) as HomeBlock;
  const date = makeHomeBlock("article-date", 3) as HomeBlock;

  content.children = withNormalizedOrder([tag, title, excerpt, date]) as HomeBlock[];
  card.children = withNormalizedOrder([img, content]) as HomeBlock[];

  return withNormalizedOrder([card]) as HomeBlock[];
}
```

- [ ] **Step 4: Update `makeHomeBlock()` to initialize `children` for `article-grid`**

Find the `makeHomeBlock` function and change the `children` line:

```typescript
export function makeHomeBlock(type: BlockType, order: number): HomeBlock {
  return {
    id: uniqueId(type),
    type,
    visible: true,
    order,
    config: baseConfig(type),
    translations: {},
    children:
      type === "container"
        ? []
        : type === "article-grid"
          ? buildDefaultArticleCardTemplate()
          : undefined,
  };
}
```

- [ ] **Step 5: Update `makePageBlock()` the same way**

Find `makePageBlock` and change its `children` line similarly:

```typescript
export function makePageBlock(type: BlockType, order: number): PageBlock {
  return {
    id: uniqueId(type),
    type,
    visible: true,
    order,
    config: baseConfig(type),
    children:
      type === "container"
        ? []
        : type === "article-grid"
          ? (buildDefaultArticleCardTemplate() as unknown as PageBlock[])
          : undefined,
  };
}
```

- [ ] **Step 6: Type-check**

```bash
cd c:/data/openblog/admin && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors.

- [ ] **Step 7: Commit**

```bash
cd c:/data/openblog && git add admin/src/components/admin/wysiwyg/blockUtils.ts
git commit -m "feat: article-grid default card template factory"
```

---

## Task 3: Create ArticlesInspector and ArticleFieldInspector

**Files:**
- Create: `admin/src/components/admin/wysiwyg/ArticlesInspector.tsx`
- Create: `admin/src/components/admin/wysiwyg/ArticleFieldInspector.tsx`

- [ ] **Step 1: Create `ArticlesInspector.tsx`**

```typescript
import { ColorRow } from "./InspectorShared";

interface ArticlesInspectorProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}

export function ArticlesInspector({
  config: c,
  onConfigChange,
}: ArticlesInspectorProps) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";
  const source = (c.source as string) ?? "latest";

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Article Grid Settings
        </span>
      </div>
      <div className="p-3 space-y-3">
        {/* Source */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Article Source
          </label>
          <select
            value={source}
            onChange={(e) => onConfigChange("source", e.target.value)}
            className={sel}
          >
            <option value="latest">Latest articles</option>
            <option value="featured">Featured articles</option>
            <option value="tag">By tag</option>
          </select>
        </div>
        {source === "tag" && (
          <div>
            <label className="block text-xs font-medium mb-1">
              Tag Filter
            </label>
            <input
              type="text"
              value={(c.tag_filter as string) ?? ""}
              onChange={(e) => onConfigChange("tag_filter", e.target.value)}
              placeholder="e.g. News"
              className={sel}
            />
          </div>
        )}
        {/* Max count */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Max articles
          </label>
          <input
            type="number"
            min={1}
            max={24}
            value={(c.max_count as number) ?? 6}
            onChange={(e) =>
              onConfigChange("max_count", parseInt(e.target.value, 10))
            }
            className={sel}
          />
        </div>
        {/* Section title */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Section Title
          </label>
          <input
            type="text"
            value={(c.section_title as string) ?? ""}
            onChange={(e) =>
              onConfigChange("section_title", e.target.value)
            }
            placeholder="Leave empty to hide"
            className={sel}
          />
        </div>
        {/* Show view all */}
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={!!(c.show_view_all ?? true)}
            onChange={(e) =>
              onConfigChange("show_view_all", e.target.checked)
            }
            className="w-4 h-4 accent-(--color-accent)"
          />
          Show &ldquo;View all →&rdquo; link
        </label>
        {/* Grid columns */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Grid columns
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onConfigChange("grid_cols", n)}
                className={`flex-1 py-1 text-xs rounded border transition-colors ${
                  ((c.grid_cols as number) ?? 3) === n
                    ? "bg-(--color-accent) text-white border-(--color-accent)"
                    : "border-(--color-border) text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        {/* Gap */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Card gap (Tailwind units, 1 = 4px)
          </label>
          <input
            type="number"
            min={0}
            max={16}
            value={(c.gap as number) ?? 6}
            onChange={(e) =>
              onConfigChange("gap", parseInt(e.target.value, 10))
            }
            className={sel}
          />
        </div>
        {/* Padding */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium mb-1">
              Padding Top
            </label>
            <input
              type="number"
              min={0}
              max={32}
              value={(c.padding_top as number) ?? 10}
              onChange={(e) =>
                onConfigChange("padding_top", parseInt(e.target.value, 10))
              }
              className={sel}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Padding Bottom
            </label>
            <input
              type="number"
              min={0}
              max={32}
              value={(c.padding_bottom as number) ?? 10}
              onChange={(e) =>
                onConfigChange(
                  "padding_bottom",
                  parseInt(e.target.value, 10),
                )
              }
              className={sel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `ArticleFieldInspector.tsx`**

```typescript
import { ColorRow } from "./InspectorShared";
import { BLOCK_LABELS } from "../blockShared";

type ArticleFieldType =
  | "article-image"
  | "article-title"
  | "article-excerpt"
  | "article-date"
  | "article-tag";

interface ArticleFieldInspectorProps {
  type: ArticleFieldType;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}

export function ArticleFieldInspector({
  type,
  config: c,
  onConfigChange,
  themeColors,
}: ArticleFieldInspectorProps) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          {BLOCK_LABELS[type]} Settings
        </span>
      </div>
      <div className="p-3 space-y-3">
        {type === "article-image" && (
          <>
            <div>
              <label className="block text-xs font-medium mb-1">
                Aspect Ratio
              </label>
              <select
                value={(c.aspect_ratio as string) ?? "16/9"}
                onChange={(e) =>
                  onConfigChange("aspect_ratio", e.target.value)
                }
                className={sel}
              >
                <option value="16/9">16:9 (Widescreen)</option>
                <option value="4/3">4:3 (Classic)</option>
                <option value="3/2">3:2 (Photo)</option>
                <option value="1/1">1:1 (Square)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Object Fit
              </label>
              <select
                value={(c.object_fit as string) ?? "cover"}
                onChange={(e) =>
                  onConfigChange("object_fit", e.target.value)
                }
                className={sel}
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Border Radius (px)
              </label>
              <input
                type="number"
                min={0}
                max={32}
                value={(c.border_radius as number) ?? 0}
                onChange={(e) =>
                  onConfigChange(
                    "border_radius",
                    parseInt(e.target.value, 10),
                  )
                }
                className={sel}
              />
            </div>
          </>
        )}

        {type === "article-title" && (
          <>
            <div>
              <label className="block text-xs font-medium mb-1">
                Heading Tag
              </label>
              <select
                value={(c.tag as string) ?? "h3"}
                onChange={(e) => onConfigChange("tag", e.target.value)}
                className={sel}
              >
                <option value="h2">H2</option>
                <option value="h3">H3</option>
                <option value="h4">H4</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Font Weight
              </label>
              <select
                value={(c.font_weight as string) ?? "bold"}
                onChange={(e) =>
                  onConfigChange("font_weight", e.target.value)
                }
                className={sel}
              >
                <option value="normal">Normal</option>
                <option value="medium">Medium</option>
                <option value="semibold">Semibold</option>
                <option value="bold">Bold</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Font Size (px, blank = auto)
              </label>
              <input
                type="number"
                min={0}
                max={72}
                value={(c.font_size as number) ?? ""}
                onChange={(e) =>
                  onConfigChange(
                    "font_size",
                    e.target.value ? parseInt(e.target.value, 10) : null,
                  )
                }
                placeholder="Auto"
                className={sel}
              />
            </div>
            <ColorRow
              label="Text Color"
              value={c.color as string | null}
              placeholder="var(--color-text)"
              onChange={(v) => onConfigChange("color", v)}
              themeColors={themeColors}
            />
          </>
        )}

        {type === "article-excerpt" && (
          <>
            <div>
              <label className="block text-xs font-medium mb-1">
                Line Clamp
              </label>
              <select
                value={(c.line_clamp as number) ?? 3}
                onChange={(e) =>
                  onConfigChange("line_clamp", parseInt(e.target.value, 10))
                }
                className={sel}
              >
                <option value="2">2 lines</option>
                <option value="3">3 lines</option>
                <option value="4">4 lines</option>
                <option value="0">No limit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Font Size (px, blank = auto)
              </label>
              <input
                type="number"
                min={0}
                max={32}
                value={(c.font_size as number) ?? ""}
                onChange={(e) =>
                  onConfigChange(
                    "font_size",
                    e.target.value ? parseInt(e.target.value, 10) : null,
                  )
                }
                placeholder="Auto"
                className={sel}
              />
            </div>
            <ColorRow
              label="Text Color"
              value={c.color as string | null}
              placeholder="var(--color-muted)"
              onChange={(v) => onConfigChange("color", v)}
              themeColors={themeColors}
            />
          </>
        )}

        {type === "article-date" && (
          <>
            <div>
              <label className="block text-xs font-medium mb-1">
                Font Size (px, blank = auto)
              </label>
              <input
                type="number"
                min={0}
                max={32}
                value={(c.font_size as number) ?? ""}
                onChange={(e) =>
                  onConfigChange(
                    "font_size",
                    e.target.value ? parseInt(e.target.value, 10) : null,
                  )
                }
                placeholder="Auto"
                className={sel}
              />
            </div>
            <ColorRow
              label="Text Color"
              value={c.color as string | null}
              placeholder="var(--color-muted)"
              onChange={(v) => onConfigChange("color", v)}
              themeColors={themeColors}
            />
          </>
        )}

        {type === "article-tag" && (
          <>
            <div>
              <label className="block text-xs font-medium mb-1">Style</label>
              <select
                value={(c.style as string) ?? "badge"}
                onChange={(e) => onConfigChange("style", e.target.value)}
                className={sel}
              >
                <option value="badge">Badge (colored background)</option>
                <option value="text">Text only</option>
              </select>
            </div>
            <ColorRow
              label="Text Color"
              value={c.color as string | null}
              placeholder="var(--color-accent)"
              onChange={(v) => onConfigChange("color", v)}
              themeColors={themeColors}
            />
            <ColorRow
              label="Background Color"
              value={c.bg_color as string | null}
              placeholder="rgba(accent, 0.1)"
              onChange={(v) => onConfigChange("bg_color", v)}
              themeColors={themeColors}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
cd c:/data/openblog/admin && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors in the two new files.

- [ ] **Step 4: Commit**

```bash
cd c:/data/openblog && git add admin/src/components/admin/wysiwyg/ArticlesInspector.tsx admin/src/components/admin/wysiwyg/ArticleFieldInspector.tsx
git commit -m "feat: ArticlesInspector and ArticleFieldInspector components"
```

---

## Task 4: Wire new inspectors into InspectorPanel

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/InspectorPanel.tsx`

- [ ] **Step 1: Add two imports at the top of `InspectorPanel.tsx`**

After the existing imports, add:

```typescript
import { ArticlesInspector } from "./ArticlesInspector";
import { ArticleFieldInspector } from "./ArticleFieldInspector";
```

- [ ] **Step 2: Add routing before the TemplateInspector catch-all**

The current `InspectorPanel.tsx` renders inside `<div className="flex-1 overflow-y-auto">`. Find this block and replace the content:

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

        {block.type === "article-grid" && (
          <ArticlesInspector
            config={block.config}
            onConfigChange={cfgChange}
            themeColors={themeColors}
          />
        )}

        {(
          ["article-image", "article-title", "article-excerpt", "article-date", "article-tag"] as string[]
        ).includes(block.type) && (
          <ArticleFieldInspector
            type={
              block.type as
                | "article-image"
                | "article-title"
                | "article-excerpt"
                | "article-date"
                | "article-tag"
            }
            config={block.config}
            onConfigChange={cfgChange}
            themeColors={themeColors}
          />
        )}

        {![
          "container",
          "text",
          "image",
          "button",
          "article-grid",
          "article-image",
          "article-title",
          "article-excerpt",
          "article-date",
          "article-tag",
        ].includes(block.type) && (
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

- [ ] **Step 3: Type-check**

```bash
cd c:/data/openblog/admin && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
cd c:/data/openblog && git add admin/src/components/admin/wysiwyg/InspectorPanel.tsx
git commit -m "feat: route article block types to new inspectors"
```

---

## Task 5: Add article blocks to the WYSIWYG palette

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/LeftSidebar.tsx`

- [ ] **Step 1: Add icon SVG components to `LeftSidebar.tsx`**

Add these function components near the end of the file (before or after the existing icon functions):

```tsx
function ArticleGridIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="3" width="6" height="8" rx="1" />
      <rect x="9" y="3" width="6" height="8" rx="1" />
      <rect x="16" y="3" width="6" height="8" rx="1" />
      <path d="M2 14h6M2 17h4M9 14h6M9 17h4M16 14h6M16 17h4" />
    </svg>
  );
}

function ArticleImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <circle cx="8" cy="8" r="1.5" />
      <path d="M21 13l-5-5L5 17" />
    </svg>
  );
}

function ArticleTitleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16M4 10h12" strokeWidth="2.5" />
      <path d="M4 15h16M4 19h10" />
    </svg>
  );
}

function ArticleExcerptIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 6h16M4 10h16M4 14h16M4 18h10" />
    </svg>
  );
}

function ArticleDateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M8 14h2v2H8z" />
    </svg>
  );
}

function ArticleTagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
```

- [ ] **Step 2: Add `article-grid` to the "Templates" palette group**

Find the Templates group in the `PALETTE` array:

```tsx
  {
    label: "Templates",
    types: [
      "hero",
      "featured-articles",
      "latest-articles",
      "cta-band",
      "rich-text",
      "image-text",
      "testimonials",
      "newsletter",
    ],
    icons: {
      hero: <HeroIcon />,
      "featured-articles": <ArticlesIcon />,
      "latest-articles": <ArticlesIcon />,
      ...
    },
  },
```

Replace with:

```tsx
  {
    label: "Templates",
    types: [
      "hero",
      "article-grid",
      "featured-articles",
      "latest-articles",
      "cta-band",
      "rich-text",
      "image-text",
      "testimonials",
      "newsletter",
    ],
    icons: {
      hero: <HeroIcon />,
      "article-grid": <ArticleGridIcon />,
      "featured-articles": <ArticlesIcon />,
      "latest-articles": <ArticlesIcon />,
      "cta-band": <CtaIcon />,
      "rich-text": <RichTextIcon />,
      "image-text": <ImageTextIcon />,
      testimonials: <TestimonialsIcon />,
      newsletter: <NewsletterIcon />,
    },
  },
```

- [ ] **Step 3: Add "Article Fields" palette group**

After the "Presets" group entry (last entry in the PALETTE array), append:

```tsx
  {
    label: "Article Fields",
    types: [
      "article-image",
      "article-title",
      "article-excerpt",
      "article-date",
      "article-tag",
    ] as BlockType[],
    icons: {
      "article-image": <ArticleImageIcon />,
      "article-title": <ArticleTitleIcon />,
      "article-excerpt": <ArticleExcerptIcon />,
      "article-date": <ArticleDateIcon />,
      "article-tag": <ArticleTagIcon />,
    },
  },
```

- [ ] **Step 4: Type-check and verify build**

```bash
cd c:/data/openblog/admin && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
cd c:/data/openblog && git add admin/src/components/admin/wysiwyg/LeftSidebar.tsx
git commit -m "feat: add article-grid and article-field blocks to WYSIWYG palette"
```

---

## Task 6: Update iframeRenderer for canvas preview

**Files:**
- Modify: `admin/src/components/admin/wysiwyg/iframeRenderer.ts`

This is the largest change. Work through it in sub-steps.

- [ ] **Step 1: Add `MockArticleCtx` interface and `MOCK_ARTICLES` constant**

Add near the top of `iframeRenderer.ts` (after the imports but before the exported functions):

```typescript
// ── Mock article data for WYSIWYG preview ─────────────────────────────────────

interface MockArticleCtx {
  title: string;
  excerpt: string;
  tag: string;
  published_at: string;
  cover_image_path: string | null;
  slug: string;
}

const MOCK_ARTICLES: MockArticleCtx[] = [
  {
    title: "Getting started with modern web development",
    excerpt:
      "An introduction to building fast, accessible websites using the latest tools and best practices in the industry today.",
    tag: "Development",
    published_at: "2026-03-15T00:00:00Z",
    cover_image_path: null,
    slug: "getting-started",
  },
  {
    title: "Design systems that scale with your team",
    excerpt:
      "How to build a component library that grows with your product without creating technical debt or slowing down delivery.",
    tag: "Design",
    published_at: "2026-02-28T00:00:00Z",
    cover_image_path: null,
    slug: "design-systems",
  },
  {
    title: "The future of content management",
    excerpt:
      "Headless CMS platforms are changing how developers and editors collaborate to ship content faster than ever before.",
    tag: "CMS",
    published_at: "2026-01-10T00:00:00Z",
    cover_image_path: null,
    slug: "future-of-cms",
  },
];
```

- [ ] **Step 2: Add `articleCtx` parameter to `blockToHtml`**

Find the `blockToHtml` function signature:

```typescript
function blockToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
  navSnapshot: NavSnapshot = {},
): string {
```

Replace with:

```typescript
function blockToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
  navSnapshot: NavSnapshot = {},
  articleCtx?: MockArticleCtx,
): string {
```

- [ ] **Step 3: Add 6 new dispatch cases in `blockToHtml`**

Find the `switch (block.type)` inside `blockToHtml`. Add these cases after the `"button"` case and before the nav cases:

```typescript
    case "article-grid":
      return articleGridToHtml(block, activeLang, mode, navSnapshot);
    case "article-image":
      return articleImageHtml(block, articleCtx);
    case "article-title":
      return articleTitleHtml(block, articleCtx);
    case "article-excerpt":
      return articleExcerptHtml(block, articleCtx);
    case "article-date":
      return articleDateHtml(block, articleCtx);
    case "article-tag":
      return articleTagHtml(block, articleCtx);
```

Also update the `container` case to forward `articleCtx`:

```typescript
    case "container":
      return containerToHtml(block, activeLang, mode, navSnapshot, articleCtx);
```

- [ ] **Step 4: Add `articleCtx` parameter to `containerToHtml`**

Find the `containerToHtml` function signature:

```typescript
function containerToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
  navSnapshot: NavSnapshot = {},
): string {
```

Replace with:

```typescript
function containerToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
  navSnapshot: NavSnapshot = {},
  articleCtx?: MockArticleCtx,
): string {
```

And update the children map inside `containerToHtml` to forward `articleCtx`:

```typescript
  let inner = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((ch) => blockToHtml(ch, activeLang, mode, navSnapshot, articleCtx))
    .join("\n");
```

- [ ] **Step 5: Add `articleGridToHtml` function**

Add this function before the `navBlockHtml` function:

```typescript
function articleGridToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
  navSnapshot: NavSnapshot,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const gridCols = (c.grid_cols as number) ?? 3;
  const gap = (c.gap as number) ?? 6;
  const paddingTop = (c.padding_top as number) ?? 10;
  const paddingBottom = (c.padding_bottom as number) ?? 10;
  const sectionTitle = (c.section_title as string) ?? "";
  const showViewAll = c.show_view_all !== false;
  const source = (c.source as string) ?? "latest";
  const tagFilter = (c.tag_filter as string) ?? "";

  const sourceLabel =
    source === "featured"
      ? "Featured"
      : source === "tag"
        ? `Tag: ${tagFilter || "—"}`
        : "Latest";

  const headerHtml =
    sectionTitle || showViewAll
      ? `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          ${sectionTitle ? `<h2 style="font-size:1.5rem;font-weight:700;color:var(--color-text,#111);margin:0;">${escHtml(sectionTitle)}</h2>` : "<span></span>"}
          ${showViewAll ? `<a href="#" style="font-size:13px;font-weight:500;color:var(--color-accent,#3b82f6);text-decoration:none;">View all →</a>` : ""}
        </div>`
      : "";

  const gridStyle = `display:grid;grid-template-columns:repeat(${gridCols},1fr);gap:${gap * 4}px;`;

  const cardTemplate = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const cardsHtml = MOCK_ARTICLES.map((article, idx) => {
    const cardHtml = cardTemplate
      .map((ch) => blockToHtml(ch, activeLang, mode, navSnapshot, article))
      .join("\n");
    // Only first card is fully interactive; cards 2 and 3 are visual-only clones
    const style =
      idx === 0
        ? "overflow:hidden;min-width:0;"
        : "overflow:hidden;min-width:0;opacity:0.5;pointer-events:none;";
    return `<div style="${style}">${cardHtml}</div>`;
  }).join("\n");

  const sourceBadge = `<span style="position:absolute;top:8px;right:8px;background:#3b82f6;color:#fff;font-size:10px;font-weight:600;padding:2px 8px;border-radius:4px;z-index:2;">${escHtml(sourceLabel)}</span>`;

  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-grid" style="position:relative;padding-top:${paddingTop * 4}px;padding-bottom:${paddingBottom * 4}px;padding-left:24px;padding-right:24px;">
  <span class="wysiwyg-label">◈ Article Grid</span>
  ${sourceBadge}
  ${headerHtml}
  <div style="${gridStyle}">
    ${cardsHtml}
  </div>
</div>`;
}
```

- [ ] **Step 6: Add 5 article-field renderer functions**

Add these after `articleGridToHtml`:

```typescript
function articleImageHtml(
  block: RenderBlock,
  ctx?: MockArticleCtx,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const aspectRatio = (c.aspect_ratio as string) ?? "16/9";
  const objectFit = (c.object_fit as string) ?? "cover";
  const borderRadius = (c.border_radius as number) ?? 0;
  const label = `<span class="wysiwyg-label">◈ Article Image</span>`;
  const [aw, ah] = aspectRatio.split("/").map(Number);
  const paddingBottom = `${((ah / aw) * 100).toFixed(2)}%`;
  const radStyle = borderRadius ? `border-radius:${borderRadius}px;` : "";

  if (ctx?.cover_image_path) {
    return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-image" style="position:relative;width:100%;padding-bottom:${paddingBottom};overflow:hidden;${radStyle}">${label}<img src="/uploads/${escAttr(ctx.cover_image_path)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${objectFit};" /></div>`;
  }
  // Placeholder when no cover image
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-image" style="position:relative;width:100%;padding-bottom:${paddingBottom};overflow:hidden;background:#e5e7eb;${radStyle}">${label}<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;"><svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#9ca3af" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div></div>`;
}

function articleTitleHtml(
  block: RenderBlock,
  ctx?: MockArticleCtx,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const tag = (c.tag as string) ?? "h3";
  const safeTag = ["h2", "h3", "h4"].includes(tag) ? tag : "h3";
  const fontWeight = (c.font_weight as string) ?? "bold";
  const fontSize = c.font_size as number | null;
  const color = (c.color as string) || "var(--color-text,#111)";
  const label = `<span class="wysiwyg-label">◈ Article Title</span>`;
  const title = ctx?.title ?? "Article title";
  const twWeight: Record<string, string> = {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
  };
  const sizeClass = fontSize
    ? `text-[${fontSize}px]`
    : safeTag === "h2"
      ? "text-2xl"
      : safeTag === "h4"
        ? "text-lg"
        : "text-xl";
  const cls = `${sizeClass} ${twWeight[fontWeight] ?? "font-bold"}`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-title" style="position:relative;">${label}<${safeTag} class="${cls}" style="color:${escAttr(color)};margin:0;"><a href="#" style="color:inherit;text-decoration:none;">${escHtml(title)}</a></${safeTag}></div>`;
}

function articleExcerptHtml(
  block: RenderBlock,
  ctx?: MockArticleCtx,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const lineClamp = (c.line_clamp as number) ?? 3;
  const fontSize = c.font_size as number | null;
  const color = (c.color as string) || "var(--color-muted,#6b7280)";
  const label = `<span class="wysiwyg-label">◈ Article Excerpt</span>`;
  const excerpt = ctx?.excerpt ?? "Article excerpt text goes here…";
  const clampStyle =
    lineClamp > 0
      ? `-webkit-line-clamp:${lineClamp};display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;`
      : "";
  const style = `color:${escAttr(color)};${fontSize ? `font-size:${fontSize}px;` : "font-size:14px;"}${clampStyle}margin:0;`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-excerpt" style="position:relative;">${label}<p style="${style}">${escHtml(excerpt)}</p></div>`;
}

function articleDateHtml(
  block: RenderBlock,
  ctx?: MockArticleCtx,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const fontSize = c.font_size as number | null;
  const color = (c.color as string) || "var(--color-muted,#6b7280)";
  const label = `<span class="wysiwyg-label">◈ Article Date</span>`;
  const dateStr = ctx?.published_at ?? "2026-01-01T00:00:00Z";
  const formatted = new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const style = `color:${escAttr(color)};${fontSize ? `font-size:${fontSize}px;` : "font-size:12px;"}margin:0;`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-date" style="position:relative;">${label}<p style="${style}">${escHtml(formatted)}</p></div>`;
}

function articleTagHtml(
  block: RenderBlock,
  ctx?: MockArticleCtx,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const style = (c.style as string) ?? "badge";
  const color = (c.color as string) || "var(--color-accent,#3b82f6)";
  const bgColor = (c.bg_color as string) || null;
  const label = `<span class="wysiwyg-label">◈ Article Tag</span>`;
  const tag = ctx?.tag ?? "Tag";
  let spanStyle: string;
  if (style === "badge") {
    const bg = bgColor || "rgba(59,130,246,0.1)";
    spanStyle = `color:${escAttr(color)};background:${escAttr(bg)};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;display:inline-block;`;
  } else {
    spanStyle = `color:${escAttr(color)};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;`;
  }
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-tag" style="position:relative;">${label}<span style="${spanStyle}">${escHtml(tag)}</span></div>`;
}
```

- [ ] **Step 7: Type-check**

```bash
cd c:/data/openblog/admin && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

- [ ] **Step 8: Start dev server and visually verify**

```bash
cd c:/data/openblog/admin && npm run dev
```

Open the admin, go to Home Builder, add an "Article Grid" block from the Templates palette. Expected: 3 mock cards appear in the canvas with article image placeholder, tag badge, title, excerpt, date. Selecting each element shows the correct inspector.

- [ ] **Step 9: Commit**

```bash
cd c:/data/openblog && git add admin/src/components/admin/wysiwyg/iframeRenderer.ts
git commit -m "feat: article-grid canvas renderer with mock card preview"
```

---

## Task 7: Create Nunjucks site partials

**Files:**
- Create: `site/src/_includes/partials/blocks/article-grid.njk`
- Create: `site/src/_includes/partials/blocks/article-image.njk`
- Create: `site/src/_includes/partials/blocks/article-title.njk`
- Create: `site/src/_includes/partials/blocks/article-excerpt.njk`
- Create: `site/src/_includes/partials/blocks/article-date.njk`
- Create: `site/src/_includes/partials/blocks/article-tag.njk`

- [ ] **Step 1: Create `article-grid.njk`**

```nunjucks
{%- set cc = b.config -%}
{%- set _source = cc.source | default("latest") -%}
{%- set _maxCount = cc.max_count | default(6) -%}
{%- set _gridCols = cc.grid_cols | default(3) -%}
{%- set _gap = cc.gap | default(6) -%}
{%- set _pt = cc.padding_top | default(10) -%}
{%- set _pb = cc.padding_bottom | default(10) -%}
{%- set _sectionTitle = cc.section_title | default("") -%}
{%- set _showViewAll = cc.show_view_all !== false -%}

{# Filter articles by source #}
{%- if _source === "featured" -%}
  {%- set _filteredArticles = articles.byLang[lang] | selectattr("is_featured") | list -%}
{%- elif _source === "tag" and cc.tag_filter -%}
  {%- set _filteredArticles = articles.byLang[lang] | selectattr("tag", "equalto", cc.tag_filter) | list -%}
{%- else -%}
  {%- set _filteredArticles = articles.byLang[lang] | list -%}
{%- endif -%}

{# Capture card template before any inner loops override b #}
{%- set _cardTemplate = b.children -%}

{%- if _filteredArticles | length -%}
<section class="pt-{{ _pt }} pb-{{ _pb }} px-6">
  {%- if _sectionTitle or _showViewAll -%}
  <div class="max-w-5xl mx-auto flex justify-between items-center mb-6">
    {%- if _sectionTitle -%}
    <h2 class="text-2xl font-bold" style="color:var(--color-text);">{{ _sectionTitle }}</h2>
    {%- else -%}<span></span>{%- endif -%}
    {%- if _showViewAll -%}
    <a href="/{{ lang }}/articles/" class="text-sm font-medium" style="color:var(--color-accent);">View all →</a>
    {%- endif -%}
  </div>
  {%- endif -%}
  <div class="max-w-5xl mx-auto" style="display:grid;grid-template-columns:repeat({{ _gridCols }},1fr);gap:{{ _gap * 4 }}px;">
    {%- for article in _filteredArticles | limit(_maxCount) -%}
      {%- set _articleCtx = article -%}
      <div>
        {%- for child in _cardTemplate -%}
          {%- if child.visible !== false -%}
            {%- set b = child -%}
            {%- set block = b -%}
            {%- if child.type === "container" -%}{%- include "partials/blocks/container.njk" -%}
            {%- elif child.type === "text" -%}{%- include "partials/blocks/text.njk" -%}
            {%- elif child.type === "image" -%}{%- include "partials/blocks/image.njk" -%}
            {%- elif child.type === "button" -%}{%- include "partials/blocks/button.njk" -%}
            {%- elif child.type === "article-image" -%}{%- include "partials/blocks/article-image.njk" -%}
            {%- elif child.type === "article-title" -%}{%- include "partials/blocks/article-title.njk" -%}
            {%- elif child.type === "article-excerpt" -%}{%- include "partials/blocks/article-excerpt.njk" -%}
            {%- elif child.type === "article-date" -%}{%- include "partials/blocks/article-date.njk" -%}
            {%- elif child.type === "article-tag" -%}{%- include "partials/blocks/article-tag.njk" -%}
            {%- endif -%}
          {%- endif -%}
        {%- endfor -%}
      </div>
    {%- endfor -%}
  </div>
</section>
{%- endif -%}
```

- [ ] **Step 2: Create `article-image.njk`**

Aspect ratio padding is pre-computed per known value rather than using `.split()` (Nunjucks string method availability varies across Eleventy versions):

```nunjucks
{%- set cc = b.config -%}
{%- set _ar = cc.aspect_ratio | default("16/9") -%}
{%- set _fit = cc.object_fit | default("cover") -%}
{%- set _radius = cc.border_radius | default(0) -%}
{%- set _radStyle = ("border-radius:" + _radius + "px;") if _radius else "" -%}

{%- set _pad = "56.25" -%}
{%- if _ar === "4/3" -%}{%- set _pad = "75" -%}
{%- elif _ar === "3/2" -%}{%- set _pad = "66.67" -%}
{%- elif _ar === "1/1" -%}{%- set _pad = "100" -%}
{%- endif -%}

{%- if _articleCtx and _articleCtx.cover_image_path -%}
<div style="position:relative;width:100%;padding-bottom:{{ _pad }}%;overflow:hidden;{{ _radStyle }}">
  <img src="/uploads/{{ _articleCtx.cover_image_path }}" alt="{{ _articleCtx.title }}" loading="lazy"
       style="position:absolute;inset:0;width:100%;height:100%;object-fit:{{ _fit }};" />
</div>
{%- endif -%}
```

- [ ] **Step 3: Create `article-title.njk`**

```nunjucks
{%- set cc = b.config -%}
{%- set _color = cc.color if cc.color else "var(--color-text)" -%}
{%- set _fw = "font-bold" -%}
{%- if cc.font_weight === "semibold" -%}{%- set _fw = "font-semibold" -%}
{%- elif cc.font_weight === "medium" -%}{%- set _fw = "font-medium" -%}
{%- elif cc.font_weight === "normal" -%}{%- set _fw = "font-normal" -%}
{%- endif -%}
{%- set _tag = cc.tag | default("h3") -%}
{%- set _fs = "" -%}
{%- if cc.font_size -%}{%- set _fs = "text-[" + cc.font_size + "px]" -%}
{%- elif _tag === "h2" -%}{%- set _fs = "text-2xl" -%}
{%- elif _tag === "h4" -%}{%- set _fs = "text-lg" -%}
{%- else -%}{%- set _fs = "text-xl" -%}
{%- endif -%}

{%- if _articleCtx -%}
  {%- if _tag === "h2" -%}
<h2 class="{{ _fs }} {{ _fw }}" style="color:{{ _color }};margin:0;"><a href="/{{ lang }}/articles/{{ _articleCtx.slug }}.html" style="color:inherit;text-decoration:none;">{{ _articleCtx.title }}</a></h2>
  {%- elif _tag === "h4" -%}
<h4 class="{{ _fs }} {{ _fw }}" style="color:{{ _color }};margin:0;"><a href="/{{ lang }}/articles/{{ _articleCtx.slug }}.html" style="color:inherit;text-decoration:none;">{{ _articleCtx.title }}</a></h4>
  {%- else -%}
<h3 class="{{ _fs }} {{ _fw }}" style="color:{{ _color }};margin:0;"><a href="/{{ lang }}/articles/{{ _articleCtx.slug }}.html" style="color:inherit;text-decoration:none;">{{ _articleCtx.title }}</a></h3>
  {%- endif -%}
{%- endif -%}
```

- [ ] **Step 4: Create `article-excerpt.njk`**

```nunjucks
{%- set cc = b.config -%}
{%- set _clamp = cc.line_clamp | default(3) -%}
{%- set _color = cc.color if cc.color else "var(--color-muted)" -%}
{%- set _fsStyle = ("font-size:" + cc.font_size + "px;") if cc.font_size else "font-size:14px;" -%}
{%- set _clampStyle = ("-webkit-line-clamp:" + _clamp + ";display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;") if _clamp > 0 else "" -%}

{%- if _articleCtx -%}
<p style="color:{{ _color }};{{ _fsStyle }}{{ _clampStyle }}margin:0;">{{ _articleCtx.excerpt }}</p>
{%- endif -%}
```

- [ ] **Step 5: Create `article-date.njk`**

```nunjucks
{%- set cc = b.config -%}
{%- set _color = cc.color if cc.color else "var(--color-muted)" -%}
{%- set _fsStyle = ("font-size:" + cc.font_size + "px;") if cc.font_size else "font-size:12px;" -%}

{%- if _articleCtx -%}
<p style="color:{{ _color }};{{ _fsStyle }}margin:0;">{{ _articleCtx.published_at | localizedDate(lang) }}</p>
{%- endif -%}
```

- [ ] **Step 6: Create `article-tag.njk`**

```nunjucks
{%- set cc = b.config -%}
{%- set _style = cc.style | default("badge") -%}
{%- set _color = cc.color if cc.color else "var(--color-accent)" -%}
{%- set _bgColor = cc.bg_color if cc.bg_color else ("transparent" if _style === "text" else "rgba(59,130,246,0.1)") -%}

{%- if _articleCtx and _articleCtx.tag -%}
  {%- if _style === "badge" -%}
<span style="color:{{ _color }};background:{{ _bgColor }};padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;display:inline-block;">{{ _articleCtx.tag }}</span>
  {%- else -%}
<span style="color:{{ _color }};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;">{{ _articleCtx.tag }}</span>
  {%- endif -%}
{%- endif -%}
```

- [ ] **Step 7: Commit**

```bash
cd c:/data/openblog && git add site/src/_includes/partials/blocks/article-grid.njk site/src/_includes/partials/blocks/article-image.njk site/src/_includes/partials/blocks/article-title.njk site/src/_includes/partials/blocks/article-excerpt.njk site/src/_includes/partials/blocks/article-date.njk site/src/_includes/partials/blocks/article-tag.njk
git commit -m "feat: article-grid and article-field Nunjucks partials"
```

---

## Task 8: Update Nunjucks dispatch chains

**Files:**
- Modify: `site/src/_includes/partials/blocks/container.njk`
- Modify: `site/src/index.njk`
- Modify: `site/src/page.njk`

- [ ] **Step 1: Add 6 new cases to `container.njk` dispatch chain**

Find the last `{%- elif child.type === "single-social-link" %}...{%- endif %}` line in `container.njk` and add before the `{%- endif %}`:

```nunjucks
      {%- elif child.type === "article-grid" %}{%- include "partials/blocks/article-grid.njk" %}
      {%- elif child.type === "article-image" %}{%- include "partials/blocks/article-image.njk" %}
      {%- elif child.type === "article-title" %}{%- include "partials/blocks/article-title.njk" %}
      {%- elif child.type === "article-excerpt" %}{%- include "partials/blocks/article-excerpt.njk" %}
      {%- elif child.type === "article-date" %}{%- include "partials/blocks/article-date.njk" %}
      {%- elif child.type === "article-tag" %}{%- include "partials/blocks/article-tag.njk" %}
```

- [ ] **Step 2: Add `article-grid` to `index.njk` dispatch**

Find the `{% elif block.type === "button" %}` block in `index.njk` (last entry in the for loop) and add after it:

```nunjucks
  {% elif block.type === "article-grid" %}
    {% set b = block %}
    {% include "partials/blocks/article-grid.njk" %}
```

- [ ] **Step 3: Add `article-grid` to `page.njk` dispatch**

Find the `{% elif block.type === "button" %}` block in `page.njk` (last entry in the for loop) and add after it:

```nunjucks
      {% elif block.type === "article-grid" %}
        {% include "partials/blocks/article-grid.njk" %}
```

Note: `page.njk` already does `{% set b = block %}` before the dispatch chain, so no additional `set b` is needed.

- [ ] **Step 4: Test Eleventy build**

Make sure the backend is running (`go run cmd/server/main.go` in `backend/`), then:

```bash
cd c:/data/openblog/site && npm run build 2>&1 | tail -30
```

Expected: build succeeds with no Nunjucks template errors.

- [ ] **Step 5: Verify article-grid renders on home page**

Open a browser at `http://localhost:8080` (or whatever the Eleventy output is served on). Create a test: in the admin HomeBuilderPage, save an `article-grid` block. Rebuild. Check that real articles appear in a grid with the expected layout.

- [ ] **Step 6: Commit**

```bash
cd c:/data/openblog && git add site/src/_includes/partials/blocks/container.njk site/src/index.njk site/src/page.njk
git commit -m "feat: add article-grid dispatch to container, index, and page templates"
```

---

## Verification checklist

Run through these after all tasks are complete:

- [ ] **Admin palette**: Open HomeBuilder. "Templates" group shows "Article Grid". "Article Fields" group shows Image/Title/Excerpt/Date/Tag tiles. Dragging "Article Grid" onto canvas shows 3 mock cards with the default template.
- [ ] **Default card template**: New article-grid block has outer card container → [article-image placeholder, inner container → [article-tag, article-title, article-excerpt, article-date]].
- [ ] **Inspector routing**: Clicking the article-grid's outer `article-grid` block shows `ArticlesInspector`. Clicking `article-title` shows `ArticleFieldInspector` with heading tag, weight, size, color options.
- [ ] **Config changes propagate**: Change grid_cols to 2 → canvas updates to 2-column grid. Change section_title → header text appears above grid.
- [ ] **Add container to card**: Drag a Container block into the card template. Drag article-tag inside that container. Canvas shows tag inside the container in all 3 cards. Second/third cards are faded (opacity:0.5).
- [ ] **Site build with real data**: Run `npm run build` in site/. Output HTML for `/en/index.html` contains the article grid with real article titles, links, and dates.
- [ ] **Tag filtering**: Set source=tag, tag_filter=some-existing-tag. Rebuild site. Only articles with that tag appear.
- [ ] **Featured filtering**: Set source=featured. Rebuild. Only `is_featured=true` articles appear.
- [ ] **Backward compat**: Existing `featured-articles` or `latest-articles` blocks on the home page still render correctly (no regression).
- [ ] **Type safety**: `npx tsc --noEmit` passes with zero errors.
