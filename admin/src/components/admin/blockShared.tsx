/**
 * Shared block-editor primitives used by both PageBlockBuilder (custom pages)
 * and HomeBuilderPage (home page).
 *
 * Everything here is layout-only — no translatable text fields — so it works
 * regardless of whether the parent block uses PageBlock or HomeBlock.
 */
import {
  type ReactNode,
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import { ColorRow } from "./wysiwyg/InspectorShared";
import type { BlockType } from "../../api/types";

// ── Block labels ──────────────────────────────────────────────────────────────

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
  "preset-nav": "Header Preset",
  "preset-footer": "Footer Preset",
  "article-grid": "Article Grid",
  "article-card": "Article Card",
  "article-image": "Article Image",
  "article-title": "Article Title",
  "article-excerpt": "Article Excerpt",
  "article-date": "Article Date",
  "article-tag": "Article Tag",
};

// ── Default configs ───────────────────────────────────────────────────────────

export function applyTextDefaults(config: Record<string, unknown>): void {
  config.tag = "p";
  config.content = "";
  config.fontSize = null;
  config.fontWeight = "normal";
  config.textAlign = "left";
  config.color = null;
  config.italic = false;
  config.letterSpacing = 0; // 1/100 em units (0 = normal, 10 = 0.10em)
  config.lineHeight = null; // null = CSS default
  config.textTransform = "none";
  config.textDecoration = "none";
  config.bgColor = null;
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
  config.maxWidth = "";
  config.elementId = "";
  config.customStyle = "";
}

export function applyButtonDefaults(config: Record<string, unknown>): void {
  config.label = "Click Me";
  config.href = "";
  config.target = "_self";
  config.variant = "filled"; // "filled" | "outline" | "ghost"
  config.size = "md"; // "sm" | "md" | "lg"
  config.align = "left"; // "left" | "center" | "right"
  config.bgColor = null; // null = theme accent
  config.textColor = null; // null = auto
  config.borderColor = null; // null = auto
  config.borderRadius = 6;
  config.fontWeight = "semibold";
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
  config.elementId = "";
  config.customStyle = "";
}

export function applyImageDefaults(config: Record<string, unknown>): void {
  config.src = null;
  config.alt = "";
  config.width = "w-full";
  config.objectFit = "cover";
  config.aspectRatio = "auto";
  config.borderRadius = 0;
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
  config.elementId = "";
  config.customStyle = "";
}

export function applyContainerDefaults(config: Record<string, unknown>): void {
  config.direction = "row";
  config.wrap = "nowrap";
  config.justify = "start";
  config.align = "start";
  config.width = "w-full";
  config.height = "h-auto";
  config.gapX = 4;
  config.gapY = 4;
  config.paddingTop = 6;
  config.paddingBottom = 6;
  config.paddingLeft = 6;
  config.paddingRight = 6;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
  config.backgroundColor = null;
  config.backgroundImage = null;
  config.backgroundSize = "cover";
  config.backgroundPosition = "center";
  config.backgroundOverlay = null;
  config.borderRadius = 0;
  config.textColor = null;
  config.customStyle = null;
  config.elementId = null;
}

export function applyNavLinksDefaults(config: Record<string, unknown>): void {
  config.dropdown_style = "simple"; // "simple" | "mega"
  config.show_language_switcher = true;
  config.link_color = null;
  config.bg_color = null;
  config.sticky = true;
}

export function applySubnavLinksDefaults(
  config: Record<string, unknown>,
): void {
  config.source = "nav"; // "nav" | "footer"
  config.parent_key = "";
  config.layout = "vertical"; // "vertical" | "horizontal" | "grid"
  config.link_color = null;
}

export function applySingleNavItemDefaults(
  config: Record<string, unknown>,
): void {
  config.source = "nav"; // "nav" | "footer"
  config.link_key = "";
  config.render_as = "link"; // "link" | "button"
  config.link_color = null;
}

export function applySocialLinksDefaults(
  config: Record<string, unknown>,
): void {
  config.show_icons = true;
  config.icon_style = "outline"; // "outline" | "filled"
  config.layout = "horizontal"; // "horizontal" | "vertical"
  config.link_color = null;
}

export function applySingleSocialLinkDefaults(
  config: Record<string, unknown>,
): void {
  config.platform = "";
  config.show_icon = true;
  config.link_color = null;
}

export function applyArticleGridDefaults(
  config: Record<string, unknown>,
): void {
  config.source = "latest"; // "latest" | "featured" | "tag"
  config.tag_filter = ""; // used when source="tag"
  config.max_count = 6;
  config.grid_cols = 3;
  config.gap = 6;
  config.show_view_all = true;
  config.padding_top = 10;
  config.padding_bottom = 10;
}

export function applyArticleCardDefaults(
  config: Record<string, unknown>,
): void {
  // Layout — same keys as ContainerInspector (camelCase)
  config.direction = "col";
  config.wrap = "nowrap";
  config.justify = "start";
  config.align = "start";
  config.width = "w-full";
  config.height = "h-auto";
  config.gapX = 0;
  config.gapY = 2;
  config.paddingTop = 2;
  config.paddingBottom = 2;
  config.paddingLeft = 2;
  config.paddingRight = 2;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
  config.backgroundColor = null;
  config.borderRadius = 8;
  config.textColor = null;
  config.customStyle = null;
  config.elementId = null;
  // Standalone article binding — slug of the article to show when not inside a grid
  config.articleSlug = null;
}

export function applyArticleImageDefaults(
  config: Record<string, unknown>,
): void {
  // Extends image block config — same camelCase keys as ImageInspector
  config.aspectRatio = "16/9"; // "16/9" | "4/3" | "3/2" | "1/1"
  config.objectFit = "cover";
  config.borderRadius = 0;
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
}

export function applyArticleTitleDefaults(
  config: Record<string, unknown>,
): void {
  // Extends text block config — same camelCase keys as TextInspector
  config.tag = "h3";
  config.fontWeight = "bold";
  config.fontSize = null;
  config.textAlign = "left";
  config.color = null; // null = var(--color-text)
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
}

export function applyArticleExcerptDefaults(
  config: Record<string, unknown>,
): void {
  // Extends text block config + lineClamp
  config.tag = "p";
  config.fontWeight = "normal";
  config.fontSize = null;
  config.textAlign = "left";
  config.color = null; // null = var(--color-muted)
  config.lineClamp = 3; // 0 = no clamp
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
}

export function applyArticleDateDefaults(
  config: Record<string, unknown>,
): void {
  // Extends text block config
  config.tag = "p";
  config.fontWeight = "normal";
  config.fontSize = 12;
  config.textAlign = "left";
  config.color = null; // null = var(--color-muted)
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
}

export function applyArticleTagDefaults(config: Record<string, unknown>): void {
  // Extends text block config + tag display style
  config.tag = "p";
  config.fontWeight = "semibold";
  config.fontSize = null;
  config.textAlign = "left";
  config.color = null; // null = var(--color-accent)
  config.bgColor = null; // null = color-mix(accent 10%, transparent)
  config.paddingTop = 0;
  config.paddingBottom = 0;
  config.paddingLeft = 0;
  config.paddingRight = 0;
  config.marginTop = 0;
  config.marginBottom = 0;
  config.marginLeft = 0;
  config.marginRight = 0;
}

// ── Icon toggle button (used inside ContainerBlockEditor) ───────────────────

function IconToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex-1 flex items-center justify-center p-2 transition-colors ${
        active
          ? "bg-(--color-accent) text-white"
          : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface) hover:text-(--color-text)"
      }`}
    >
      {children}
    </button>
  );
}

// ── Container config popover ──────────────────────────────────────────────────

export function ContainerConfigPopover({
  config,
  setConfig,
  themeColors,
}: {
  config: Record<string, unknown>;
  setConfig: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320, maxH: 480 });

  const place = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = 400;
    const panelMaxH = Math.min(900, window.innerHeight - 80);
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right - panelW;
    if (left < 8) left = 8;
    if (left + panelW > vw - 8) left = vw - panelW - 8;
    // Flip above the button when there isn't enough space below
    const spaceBelow = vh - r.bottom - 8;
    const top =
      spaceBelow >= panelMaxH
        ? r.bottom + 6
        : Math.max(8, r.top - panelMaxH - 6);
    setPos({ top, left, width: panelW, maxH: panelMaxH });
  }, []);

  useEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        btnRef.current &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`text-xs hover:underline ${open ? "text-(--color-accent)" : "text-(--color-muted)"}`}
        title="Layout settings"
      >
        ⚙ Layout
      </button>
      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
              maxHeight: pos.maxH,
            }}
            className="rounded-lg border border-(--color-border) bg-(--color-bg-surface) shadow-xl overflow-y-auto"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-(--color-border)">
              <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
                Container Layout
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-(--color-muted) hover:text-(--color-text) text-base leading-none"
              >
                ✕
              </button>
            </div>
            <div
              className="p-3 overflow-y-auto"
              style={{ maxHeight: pos.maxH - 48 }}
            >
              <ContainerBlockEditor
                config={config}
                setConfig={setConfig}
                themeColors={themeColors}
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ── Container block editor ────────────────────────────────────────────────────

export function ContainerBlockEditor({
  config: c,
  setConfig,
  themeColors,
}: {
  config: Record<string, unknown>;
  setConfig: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}) {
  // Stored as Tailwind integer unit OR "[Npx]" string; shown/entered as pixels.
  const toPx = (val: unknown, def: number): number => {
    if (typeof val === "number") return val * 4;
    if (typeof val === "string") {
      const m = val.match(/^\[(\d+(?:\.\d+)?)px\]$/);
      if (m) return parseFloat(m[1]);
    }
    return def * 4;
  };
  const fromPx = (px: number): number | string => {
    const n = Math.max(0, px);
    if (n === 0) return 0;
    if (Number.isInteger(n) && n % 4 === 0) return n / 4;
    return `[${n}px]`;
  };

  const sLabel =
    "text-[10px] font-semibold uppercase tracking-wider text-(--color-muted) mb-2";
  const subLabel = "text-[11px] text-(--color-muted) mb-1.5";
  const numInput =
    "flex items-center gap-1.5 border border-(--color-border) rounded bg-(--color-bg) px-2 h-8";
  const btnGroup =
    "flex rounded border border-(--color-border) overflow-hidden divide-x divide-(--color-border)";

  return (
    <div className="divide-y divide-(--color-border)">
      {/* ── SIZING ── */}
      <div className="py-3">
        <p className={sLabel}>Sizing</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11px] text-(--color-muted) mb-1">
              Width (Fill)
            </label>
            <select
              value={(c.width as string) ?? "w-full"}
              onChange={(e) => setConfig("width", e.target.value)}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="w-full">Fill Container (100%)</option>
              <option value="w-1/2">Half Width (50%)</option>
              <option value="w-1/3">Third Width (33%)</option>
              <option value="w-1/4">Quarter Width (25%)</option>
              <option value="w-page">Page width (max-w-5xl)</option>
              <option value="w-auto">Hug Contents (Auto)</option>
              <option value="w-screen">Full Screen (100vw)</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] text-(--color-muted) mb-1">
              Height
            </label>
            <select
              value={(c.height as string) ?? "h-auto"}
              onChange={(e) => setConfig("height", e.target.value)}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="h-auto">Hug Contents (Auto)</option>
              <option value="h-full">Fill Container (100%)</option>
              <option value="h-screen">Full Screen (100vh)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── LAYOUT (FLEX) ── */}
      <div className="py-3 space-y-3">
        <p className={sLabel}>Layout (Flex)</p>

        {/* Direction & Wrap — 4 icon buttons in one row */}
        <div>
          <p className={subLabel}>Direction & Wrap</p>
          <div className={btnGroup}>
            <IconToggle
              active={c.direction === "col"}
              onClick={() => setConfig("direction", "col")}
              title="Column (Vertical)"
            >
              <svg
                viewBox="0 0 16 16"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M8 2v12M5 11l3 3 3-3" />
              </svg>
            </IconToggle>
            <IconToggle
              active={(c.direction ?? "row") === "row"}
              onClick={() => setConfig("direction", "row")}
              title="Row (Horizontal)"
            >
              <svg
                viewBox="0 0 16 16"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 8h12M11 5l3 3-3 3" />
              </svg>
            </IconToggle>
            <IconToggle
              active={(c.wrap ?? "nowrap") === "nowrap"}
              onClick={() => setConfig("wrap", "nowrap")}
              title="Don't Wrap"
            >
              <svg
                viewBox="0 0 16 16"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 8h12" />
              </svg>
            </IconToggle>
            <IconToggle
              active={c.wrap === "wrap"}
              onClick={() => setConfig("wrap", "wrap")}
              title="Wrap Children"
            >
              <svg
                viewBox="0 0 16 16"
                width={16}
                height={16}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M2 5h10a3 3 0 010 6H8m2-2l-2 2 2 2" />
              </svg>
            </IconToggle>
          </div>
        </div>

        {/* Justify + Align side by side */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={subLabel}>Justify (Distribution)</p>
            <div className={btnGroup}>
              {(["start", "center", "end", "between"] as const).map((val) => (
                <IconToggle
                  key={val}
                  active={(c.justify ?? "start") === val}
                  onClick={() => setConfig("justify", val)}
                  title={`Justify ${val}`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    width={16}
                    height={16}
                    fill="currentColor"
                  >
                    {val === "start" && (
                      <>
                        <rect x="2" y="4" width="4" height="8" rx="1" />
                        <rect x="7" y="4" width="4" height="8" rx="1" />
                      </>
                    )}
                    {val === "center" && (
                      <>
                        <rect x="3.5" y="4" width="4" height="8" rx="1" />
                        <rect x="8.5" y="4" width="4" height="8" rx="1" />
                      </>
                    )}
                    {val === "end" && (
                      <>
                        <rect x="5" y="4" width="4" height="8" rx="1" />
                        <rect x="10" y="4" width="4" height="8" rx="1" />
                      </>
                    )}
                    {val === "between" && (
                      <>
                        <rect x="1" y="4" width="4" height="8" rx="1" />
                        <rect x="11" y="4" width="4" height="8" rx="1" />
                      </>
                    )}
                  </svg>
                </IconToggle>
              ))}
            </div>
          </div>
          <div>
            <p className={subLabel}>Align (Cross-axis)</p>
            <div className={btnGroup}>
              {(["start", "center", "end", "stretch"] as const).map((val) => (
                <IconToggle
                  key={val}
                  active={(c.align ?? "start") === val}
                  onClick={() => setConfig("align", val)}
                  title={`Align ${val}`}
                >
                  <svg
                    viewBox="0 0 16 16"
                    width={16}
                    height={16}
                    fill="currentColor"
                  >
                    {val === "start" && (
                      <>
                        <rect x="4" y="2" width="8" height="3" rx="1" />
                        <rect x="4" y="6" width="8" height="3" rx="1" />
                      </>
                    )}
                    {val === "center" && (
                      <>
                        <rect x="4" y="4.5" width="8" height="3" rx="1" />
                        <rect x="4" y="8.5" width="8" height="3" rx="1" />
                      </>
                    )}
                    {val === "end" && (
                      <>
                        <rect x="4" y="7" width="8" height="3" rx="1" />
                        <rect x="4" y="11" width="8" height="3" rx="1" />
                      </>
                    )}
                    {val === "stretch" && (
                      <>
                        <rect x="4" y="2" width="8" height="5" rx="1" />
                        <rect x="4" y="9" width="8" height="5" rx="1" />
                      </>
                    )}
                  </svg>
                </IconToggle>
              ))}
            </div>
          </div>
        </div>

        {/* Gap between children */}
        <div>
          <p className={subLabel}>Gap between children</p>
          <div className="grid grid-cols-2 gap-2">
            <div className={numInput}>
              <svg
                viewBox="0 0 16 16"
                width={14}
                height={14}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="shrink-0 text-(--color-muted)"
              >
                <path d="M2 8h12M5 5v6m6-6v6" />
              </svg>
              <input
                type="number"
                min={0}
                max={384}
                value={toPx(c.gapX, 4)}
                onChange={(e) =>
                  setConfig("gapX", fromPx(Number(e.target.value)))
                }
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
              <span className="text-xs text-(--color-muted) shrink-0">px</span>
            </div>
            <div className={numInput}>
              <svg
                viewBox="0 0 16 16"
                width={14}
                height={14}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="shrink-0 text-(--color-muted)"
              >
                <path d="M8 2v12M5 5h6m-6 6h6" />
              </svg>
              <input
                type="number"
                min={0}
                max={384}
                value={toPx(c.gapY, 4)}
                onChange={(e) =>
                  setConfig("gapY", fromPx(Number(e.target.value)))
                }
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
              <span className="text-xs text-(--color-muted) shrink-0">px</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── INNER SPACING (PADDING) ── */}
      <div className="py-3">
        <p className={sLabel}>Inner Spacing (Padding)</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {(["paddingTop", "paddingBottom"] as const).map((key) => (
            <div key={key} className={numInput}>
              <span className="text-xs text-(--color-muted) shrink-0 w-6">
                {key === "paddingTop" ? "Top" : "Btm"}
              </span>
              <input
                type="number"
                min={0}
                max={384}
                value={toPx(c[key], 6)}
                onChange={(e) => setConfig(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["paddingLeft", "paddingRight"] as const).map((key) => (
            <div key={key} className={numInput}>
              <span className="text-xs text-(--color-muted) shrink-0 w-6">
                {key === "paddingLeft" ? "Left" : "Rgt"}
              </span>
              <input
                type="number"
                min={0}
                max={384}
                value={toPx(c[key], 6)}
                onChange={(e) => setConfig(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── OUTER SPACING (MARGIN) ── */}
      <div className="py-3">
        <p className={sLabel}>Outer Spacing (Margin)</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {(["marginTop", "marginBottom"] as const).map((key) => (
            <div key={key} className={numInput}>
              <span className="text-xs text-(--color-muted) shrink-0 w-6">
                {key === "marginTop" ? "Top" : "Btm"}
              </span>
              <input
                type="number"
                min={0}
                max={384}
                value={toPx(c[key], 0)}
                onChange={(e) => setConfig(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(["marginLeft", "marginRight"] as const).map((key) => (
            <div key={key} className={numInput}>
              <span className="text-xs text-(--color-muted) shrink-0 w-6">
                {key === "marginLeft" ? "Left" : "Rgt"}
              </span>
              <input
                type="number"
                min={0}
                max={384}
                value={toPx(c[key], 0)}
                onChange={(e) => setConfig(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── BACKGROUND ── */}
      <div className="py-3 space-y-3">
        <p className={sLabel}>Background</p>

        {/* Color row */}
        <div>
          <ColorRow
            label="Background / Fill"
            value={(c.backgroundColor as string) ?? null}
            placeholder="None"
            onChange={(v) => setConfig("backgroundColor", v)}
            themeColors={themeColors}
          />
        </div>

        {/* Background image URL */}
        <div>
          <p className={subLabel}>Image URL</p>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={(c.backgroundImage as string) ?? ""}
              placeholder="/uploads/photo.jpg or https://…"
              onChange={(e) =>
                setConfig(
                  "backgroundImage",
                  e.target.value === "" ? null : e.target.value,
                )
              }
              className="flex-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) outline-none focus:ring-2 focus:ring-(--color-accent)"
            />
            {!!(c.backgroundImage as string) && (
              <button
                type="button"
                onClick={() => setConfig("backgroundImage", null)}
                className="text-(--color-muted) hover:text-red-400 transition-colors shrink-0 px-1"
                title="Remove image"
              >
                <svg
                  viewBox="0 0 16 16"
                  width={14}
                  height={14}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                >
                  <path d="M4 4l8 8m0-8l-8 8" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Size + Position (only shown when an image is set) */}
        {!!(c.backgroundImage as string) && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className={subLabel}>Size</p>
              <select
                value={(c.backgroundSize as string) ?? "cover"}
                onChange={(e) => setConfig("backgroundSize", e.target.value)}
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              >
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="auto">Auto</option>
                <option value="100% 100%">Stretch (100%)</option>
              </select>
            </div>
            <div>
              <p className={subLabel}>Position</p>
              <select
                value={(c.backgroundPosition as string) ?? "center"}
                onChange={(e) =>
                  setConfig("backgroundPosition", e.target.value)
                }
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              >
                <option value="center">Center</option>
                <option value="top">Top</option>
                <option value="bottom">Bottom</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="top left">Top Left</option>
                <option value="top right">Top Right</option>
                <option value="bottom left">Bottom Left</option>
                <option value="bottom right">Bottom Right</option>
              </select>
            </div>
          </div>
        )}

        {/* Overlay colour (only shown when an image is set) */}
        {!!(c.backgroundImage as string) && (
          <div>
            <ColorRow
              label="Overlay (tint / scrim)"
              value={(c.backgroundOverlay as string) ?? null}
              placeholder="None  e.g. #00000080"
              onChange={(v) => setConfig("backgroundOverlay", v)}
              themeColors={themeColors}
            />
            <p className="text-[10px] text-(--color-muted) mt-1">
              Use 8-digit hex for opacity, e.g. <code>#00000080</code> = 50%
              black
            </p>
          </div>
        )}

        {/* Border radius */}
        <div>
          <p className={subLabel}>Border Radius (px)</p>
          <div className={numInput}>
            <input
              type="number"
              min={0}
              max={999}
              value={(c.borderRadius as number) ?? 0}
              onChange={(e) =>
                setConfig("borderRadius", Number(e.target.value))
              }
              className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
            />
            <span className="text-xs text-(--color-muted) shrink-0">px</span>
          </div>
        </div>

        {/* Text color */}
        <div>
          <ColorRow
            label="Text Color"
            value={(c.textColor as string) ?? null}
            placeholder="Inherit"
            onChange={(v) => setConfig("textColor", v)}
            themeColors={themeColors}
          />
        </div>
      </div>

      {/* ── ADVANCED ── */}
      <div className="py-3 space-y-3">
        <p className={sLabel}>Advanced</p>

        {/* Element ID */}
        <div>
          <label className="block text-[11px] text-(--color-muted) mb-1">
            Element ID
          </label>
          <input
            type="text"
            placeholder="e.g. features, hero-section"
            value={(c.elementId as string) ?? ""}
            onChange={(e) => setConfig("elementId", e.target.value || null)}
            className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono"
          />
          <p className="text-[10px] text-(--color-muted) mt-1">
            Allows linking with <code>#id</code> anchors
          </p>
        </div>

        {/* Custom style */}
        <div>
          <label className="block text-[11px] text-(--color-muted) mb-1">
            Custom CSS (inline style)
          </label>
          <textarea
            rows={3}
            placeholder="e.g. box-shadow: 0 4px 24px #0004; min-height: 400px"
            value={(c.customStyle as string) ?? ""}
            onChange={(e) => setConfig("customStyle", e.target.value || null)}
            className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono resize-y"
          />
        </div>
      </div>
    </div>
  );
}

// ── Add-block modal ───────────────────────────────────────────────────────────

const PALETTE_GROUPS: { label: string; types: BlockType[] }[] = [
  { label: "Layout", types: ["container"] },
  { label: "Content", types: ["text", "image"] },
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
  },
];

export function AddBlockModal({
  onSelect,
  onClose,
}: {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-(--color-bg) rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-4">Add block</h2>
        <div className="space-y-4">
          {PALETTE_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-(--color-muted) mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.types.map((t) => (
                  <button
                    key={t}
                    onClick={() => onSelect(t)}
                    className="px-3 py-2 rounded border border-(--color-border) text-sm text-left hover:bg-(--color-bg-surface) transition-colors"
                  >
                    {BLOCK_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 text-sm text-(--color-muted) hover:text-(--color-text)"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ── Simple text field ─────────────────────────────────────────────────────────

export function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
      />
    </div>
  );
}
