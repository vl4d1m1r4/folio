/**
 * Converts block data into iframe-ready HTML strings.
 * Pure functions — no React imports.
 */
import type { BlockType } from "../../../api/types";
import { videoEmbedUrl } from "./videoEmbed";

// ── Spacing class helper ──────────────────────────────────────────────────────
// Converts a stored spacing value to a Tailwind class string.
// Integer → "pt-4", "[10px]" string → "pt-[10px]"
function spClass(
  val: unknown,
  prefix: string,
  def: number | string = 0,
): string {
  if (typeof val === "number") return `${prefix}-${val}`;
  if (typeof val === "string" && /^\[\d+(?:\.\d+)?px\]$/.test(val))
    return `${prefix}-${val}`;
  return `${prefix}-${def}`;
}

// ── Loose block interface for rendering (both HomeBlock + PageBlock) ────────────

export interface RenderBlock {
  id: string;
  type: string;
  visible?: boolean;
  order?: number;
  config: Record<string, unknown>;
  children?: RenderBlock[];
  /** Only present on HomeBlock */
  translations?: Record<string, Record<string, unknown>>;
}

export interface NavSnapshot {
  navLinks?: Array<{
    label: string;
    url: string;
    children?: Array<{ label: string; url: string }>;
  }>;
  footerLinks?: Array<{ label: string; url: string }>;
  socialLinks?: Array<{ platform: string; url: string }>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Build the full srcdoc HTML for the WYSIWYG iframe. */
export function buildSrcdoc(
  blocks: RenderBlock[],
  themeVars: Record<string, string>,
  activeLang = "en",
  mode: "home" | "page" | "article" = "page",
  navSnapshot: NavSnapshot = {},
  articleCtx?: ArticleCtx,
): string {
  const themeStyle = buildThemeStyle(themeVars);
  const blocksHtml = renderBlocksHtml(
    blocks,
    activeLang,
    mode,
    navSnapshot,
    articleCtx,
  );

  return `<!DOCTYPE html>
<html lang="${esc(activeLang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${location.origin}/site-assets/tailwind.css">
  <script src="${location.origin}/site-assets/animations.js" defer></script>
  <script src="${location.origin}/site-assets/slideshow.js" defer></script>
  <style>
    ${themeStyle}
    body { margin: 0; padding: 0; font-family: var(--font-body, system-ui, sans-serif); color: var(--color-text, #111); background-color: var(--color-bg, #fff); }
    [data-wysiwyg-id] { position: relative; cursor: pointer; transition: outline 80ms; }
    [data-wysiwyg-id]:hover:not(.wysiwyg-selected) { outline: 1px dashed rgba(59,130,246,0.45); outline-offset: 1px; }
    .wysiwyg-selected { outline: 2px solid #3b82f6 !important; outline-offset: 1px; }
    .wysiwyg-selected > .wysiwyg-label { display: flex; }
    .wysiwyg-label { display: none; position: absolute; top: -22px; left: -2px; background: #3b82f6; color: #fff; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px 4px 0 0; white-space: nowrap; z-index: 9; pointer-events: none; align-items: center; gap: 4px; }
    .wysiwyg-drop-before { border-top: 3px solid #3b82f6 !important; }
    .wysiwyg-drop-after  { border-bottom: 3px solid #3b82f6 !important; }
    .wysiwyg-drop-left   { border-left: 3px solid #3b82f6 !important; }
    .wysiwyg-drop-right  { border-right: 3px solid #3b82f6 !important; }
    .wysiwyg-drop-inside { outline: 2px dashed #3b82f6 !important; background: rgba(59,130,246,0.04) !important; }
    [contenteditable="false"] { cursor: inherit; user-select: none; }
    [contenteditable="true"] { outline: none; cursor: text; }
    [contenteditable="true"]:focus { outline: 2px solid #3b82f6; outline-offset: 1px; }
    [data-wysiwyg-content-id]:empty::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
    #wysiwyg-root-dropzone { display:none; min-height:52px; margin:6px; border-radius:8px; border:2px dashed #d1d5db; align-items:center; justify-content:center; font-size:12px; color:#9ca3af; gap:6px; }
    #wysiwyg-root-dropzone.dz-visible { display:flex; }
    #wysiwyg-root-dropzone.dz-active { border-color:#3b82f6; background:rgba(59,130,246,0.05); color:#3b82f6; }
    .block-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; border: 2px dashed #d1d5db; border-radius: 8px; gap: 8px; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 13px; text-align: center; }
    .block-placeholder .bp-label { font-weight: 600; color: #374151; font-size: 12px; letter-spacing: 0.03em; text-transform: uppercase; }
    .prose p { margin-bottom: .875em; line-height: 1.75; }
    .prose h1,.prose h2,.prose h3,.prose h4 { font-weight: 700; line-height: 1.25; margin-bottom: .5em; margin-top: 1em; }
    .prose h1 { font-size: 2em; } .prose h2 { font-size: 1.5em; } .prose h3 { font-size: 1.25em; }
    .prose ul { padding-left: 1.5em; margin-bottom: .875em; list-style-type: disc; }
    .prose ol { padding-left: 1.5em; margin-bottom: .875em; list-style-type: decimal; }
    .prose li { margin-bottom: .25em; }
    .prose blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; color: #6b7280; font-style: italic; margin: 1em 0; }
    .prose code { background: #f3f4f6; padding: .1em .3em; border-radius: 4px; font-size: .875em; }
    .prose pre { background: #1f2937; color: #f9fafb; padding: 1em; border-radius: 8px; overflow-x: auto; }
    .prose a { color: var(--color-accent, #3b82f6); text-decoration: underline; }
    a:not([data-wysiwyg-id]), button:not([data-wysiwyg-id]) { pointer-events: none; }
    .slideshow-arrow, .slideshow-dot { pointer-events: auto !important; }
    /* Editor mode: keep animation children fully visible; only hide them during preview */
    body:not([data-anim-preview]) .anim-child { opacity: 1 !important; animation: none !important; }
    /* In editor preview h-screen would expand the iframe unboundedly; cap it */
    .h-screen { height: 1080px !important; max-height: 1080px !important; }
    /* Slideshow — embedded so the admin never depends on tailwind.css being rebuilt */
    .slideshow-slide { position:absolute; inset:0; width:100%; height:100%; opacity:0; transition-property:opacity,transform; transition-duration:500ms; transition-timing-function:ease-in-out; }
    .slideshow-slide.slide-active { opacity:1; transform:none; }
    .slideshow-slide.slide-enter-right  { transform:translateX(100%);  opacity:0; }
    .slideshow-slide.slide-enter-left   { transform:translateX(-100%); opacity:0; }
    .slideshow-slide.slide-enter-bottom { transform:translateY(100%);  opacity:0; }
    .slideshow-slide.slide-enter-top    { transform:translateY(-100%); opacity:0; }
    .slideshow-slide.slide-enter-fade   { opacity:0; transform:none; }
    .slideshow-slide.slide-enter-scale  { opacity:0; transform:scale(0.85); }
    .slideshow-slide.slide-exit-right   { transform:translateX(100%);  opacity:0; }
    .slideshow-slide.slide-exit-left    { transform:translateX(-100%); opacity:0; }
    .slideshow-slide.slide-exit-bottom  { transform:translateY(100%);  opacity:0; }
    .slideshow-slide.slide-exit-top     { transform:translateY(-100%); opacity:0; }
    .slideshow-slide.slide-exit-fade    { opacity:0; transform:none; }
    .slideshow-slide.slide-exit-scale   { opacity:0; transform:scale(1.15); }
    .slideshow-arrow { position:absolute; z-index:10; background:rgba(0,0,0,.35); color:#fff; border:none; border-radius:50%; width:2.5rem; height:2.5rem; cursor:pointer; font-size:1.25rem; display:flex; align-items:center; justify-content:center; line-height:1; }
    .slideshow-arrow:hover { background:rgba(0,0,0,.6); }
    .slideshow-prev { left:.75rem;  top:50%; transform:translateY(-50%); }
    .slideshow-next { right:.75rem; top:50%; transform:translateY(-50%); }
    [data-slideshow-direction="vertical"] .slideshow-prev { left:50%; top:.75rem;    right:auto; transform:translateX(-50%); }
    [data-slideshow-direction="vertical"] .slideshow-next { left:50%; bottom:.75rem; top:auto;  right:auto; transform:translateX(-50%); }
    .slideshow-dots { position:absolute; bottom:.75rem; left:50%; transform:translateX(-50%); display:flex; gap:.4rem; z-index:10; }
    .slideshow-dots--vertical { flex-direction:column; bottom:auto; left:auto; right:.75rem; top:50%; transform:translateY(-50%); }
    .slideshow-dot { width:.5rem; height:.5rem; border-radius:50%; background:rgba(255,255,255,.5); border:none; cursor:pointer; padding:0; }
    .slideshow-dot.active { background:#fff; }
  </style>
</head>
<body>
  <div id="wysiwyg-root">${blocksHtml}</div>
  <script>${buildInteractionScript()}</script>
</body>
</html>`;
}

/** Render only the block HTML (used for postMessage updateBlocks). */
export function renderBlocksHtml(
  blocks: RenderBlock[],
  activeLang = "en",
  mode: "home" | "page" | "article" = "page",
  navSnapshot: NavSnapshot = {},
  articleCtx?: ArticleCtx,
): string {
  return [...blocks]
    .filter((b) => b.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((b) => blockToHtml(b, activeLang, mode, navSnapshot, articleCtx))
    .join("\n");
}

// ── Article ctx ──────────────────────────────────────────────────────────────

/** Article context passed from the admin builder for live preview rendering. */
export interface ArticleCtx {
  title: string;
  excerpt: string;
  tag: string;
  date: string;
  cover: string;
  body?: string;
}

// ── Article grid mock data ────────────────────────────────────────────────────

interface MockArticle {
  title: string;
  excerpt: string;
  tag: string;
  date: string;
  cover: string;
}

const MOCK_ARTICLES: MockArticle[] = [
  {
    title: "Getting started with the new features",
    excerpt:
      "A quick walkthrough of all the new capabilities introduced in the latest release and how to make the most of them.",
    tag: "Updates",
    date: "Jun 12, 2025",
    cover: "",
  },
  {
    title: "Design tips for better readability",
    excerpt:
      "Typography and spacing choices that make a big difference to how readers engage with your content.",
    tag: "Design",
    date: "May 29, 2025",
    cover: "",
  },
  {
    title: "Behind the scenes: building in public",
    excerpt:
      "Why we chose to share our progress openly and what we've learned from the community along the way.",
    tag: "Story",
    date: "May 14, 2025",
    cover: "",
  },
];

// ── Per-block animation helpers ───────────────────────────────────────────────

/**
 * Returns extra class string, style string, and data-attribute string for
 * a block that has an animation configured directly in its config.
 */
function animAttrs(c: Record<string, unknown>): {
  cls: string;
  style: string;
  data: string;
} {
  const anim = c.animation as string | null | undefined;
  if (!anim || anim === "none") return { cls: "", style: "", data: "" };
  const trigger = (c.animTrigger as string) ?? "scroll";
  const duration = (c.animDuration as number) ?? 600;
  const easing = (c.animEasing as string) ?? "ease-out";
  const delay = (c.animDelay as number) ?? 0;
  const once = (c.animOnce as boolean) ?? true;
  return {
    cls: `anim-child animate-${anim}`,
    style: `--anim-duration:${duration}ms;--anim-easing:${easing};--anim-delay:${delay}ms;`,
    data: `data-anim-trigger="${escAttr(trigger)}" data-anim-once="${once}"`,
  };
}

// ── Block renderers ───────────────────────────────────────────────────────────

function blockToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
  navSnapshot: NavSnapshot = {},
  articleCtx?: MockArticle | ArticleCtx,
): string {
  if (block.visible === false) return "";
  switch (block.type) {
    case "container":
      return containerToHtml(block, activeLang, mode, navSnapshot, articleCtx);
    case "slideshow":
      return slideshowToHtml(block, activeLang, mode, navSnapshot, articleCtx);
    case "text":
      return textToHtml(block, activeLang, mode);
    case "image":
      return imageToHtml(block);
    case "video":
      return videoToHtml(block, activeLang, mode);
    case "button":
      return buttonToHtml(block);
    case "rich-text":
      return richTextToHtml(block, activeLang, mode);
    case "nav-links":
    case "subnav-links":
    case "single-nav-item":
    case "social-links":
    case "single-social-link":
      return navBlockHtml(block, navSnapshot);
    case "article-grid":
      return articleGridToHtml(block, activeLang, mode, navSnapshot);
    case "article-card":
      return articleCardToHtml(
        block,
        activeLang,
        mode,
        navSnapshot,
        articleCtx,
      );
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
    case "article-body":
      return articleBodyHtml(block, articleCtx);
    default:
      return templatePlaceholderHtml(block);
  }
}

function videoToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
): string {
  const c = block.config;
  const translated =
    mode === "home" ? (block.translations?.[activeLang] ?? {}) : c;
  const title = (translated.title as string) || "";
  const caption = (translated.caption as string) || "";
  const url = (c.url as string) || "";
  const embedUrl = videoEmbedUrl(
    url,
    c.autoplay === true,
    c.controls !== false,
  );
  const allowedRatios = new Set([
    "16 / 9",
    "4 / 3",
    "1 / 1",
    "9 / 16",
    "21 / 9",
  ]);
  const ratio = allowedRatios.has(c.aspectRatio as string)
    ? (c.aspectRatio as string)
    : "16 / 9";
  const idAttr = c.elementId
    ? ` id="${escAttr(c.elementId as string)}"`
    : "";
  const customStyle = (c.customStyle as string) || "";
  const label = `<span class="wysiwyg-label">Video</span>`;

  if (!embedUrl) {
    const message = url
      ? "Enter a valid YouTube or Vimeo URL"
      : "Add a YouTube or Vimeo URL";
    return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="video"${idAttr} class="block-placeholder" style="${escAttr(customStyle)}">${label}<span class="bp-label">Video</span><span>${message}</span></div>`;
  }

  return `<section data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="video"${idAttr} style="position:relative;width:100%;max-width:64rem;margin:0 auto;padding:2.5rem 1.5rem;${escAttr(customStyle)}">${label}${title ? `<h2 style="margin:0 0 1rem;font-size:1.5rem;font-weight:700;">${escHtml(title)}</h2>` : ""}<div style="position:relative;width:100%;aspect-ratio:${ratio};background:#000;overflow:hidden;"><iframe src="${escAttr(embedUrl)}" title="${escAttr(title || "Embedded video")}" style="width:100%;height:100%;border:0;pointer-events:none;" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe><div style="position:absolute;inset:0;" aria-hidden="true"></div></div>${caption ? `<p style="margin:.75rem 0 0;color:var(--color-muted,#6b7280);font-size:.875rem;">${escHtml(caption)}</p>` : ""}</section>`;
}

// ── Container ─────────────────────────────────────────────────────────────────

function containerToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
  navSnapshot: NavSnapshot = {},
  articleCtx?: MockArticle,
): string {
  const c = block.config;
  const baseCls = containerClassNames(c);
  const extraStyle = containerExtraStyle(c);
  const cls = baseCls;
  const customStyle = (c.customStyle as string) || "";
  const bgImg = (c.backgroundImage as string) || "";
  const bgSize = (c.backgroundSize as string) ?? "cover";
  const bgPos = (c.backgroundPosition as string) ?? "center";
  const overlayColor = (c.backgroundOverlay as string) || "";
  const hasOverlay = !!(overlayColor && bgImg);

  // Always render background-image as inline style (not Tailwind arbitrary class)
  const bgStyle = bgImg
    ? `background-image:url('${escAttr(bgImg)}');background-size:${bgSize};background-position:${bgPos};background-repeat:no-repeat;`
    : "";
  const cw = (c.width as string) ?? "w-full";
  const ch = (c.height as string) ?? "h-auto";
  const customWidthStyle = !cw.startsWith("w-") ? `width:${cw};` : "";
  const customHeightStyle = !ch.startsWith("h-") ? `height:${ch};` : "";
  const anim = animAttrs(c);
  const fullStyle = [
    anim.style,
    customWidthStyle,
    customHeightStyle,
    extraStyle,
    bgStyle,
    customStyle,
  ]
    .filter(Boolean)
    .join("");
  const styleAttr = fullStyle ? ` style="${escAttr(fullStyle)}"` : "";
  const fullCls = [cls, anim.cls].filter(Boolean).join(" ");
  const animData = anim.cls ? ` ${anim.data}` : "";
  const label = `<span class="wysiwyg-label">▣ Container</span>`;
  let inner = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((ch) => blockToHtml(ch, activeLang, mode, navSnapshot, articleCtx))
    .join("\n");

  if (inner === "") {
    inner = `<div style="min-height:40px;width:100%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;pointer-events:none;">Drop blocks here</div>`;
  }

  if (hasOverlay) {
    return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="container" class="${escAttr(fullCls)}" style="${escAttr(fullStyle)}"${animData}>
${label}
  <div style="position:absolute;inset:0;background:${escAttr(overlayColor)};pointer-events:none;"></div>
  <div style="position:relative;z-index:1;width:100%;display:flex;flex-direction:inherit;flex-wrap:inherit;justify-content:inherit;align-items:inherit;gap:inherit;">${inner}</div>
</div>`;
  }

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="container" class="${escAttr(fullCls)}"${styleAttr}${animData}>${label}${inner}</div>`;
}

// ── Slideshow ─────────────────────────────────────────────────────────────────

function slideshowToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
  navSnapshot: NavSnapshot = {},
  articleCtx?: MockArticle,
): string {
  const c = block.config;
  const width = (c.width as string) ?? "w-full";
  const height = (c.height as string) ?? "h-96";
  const direction = (c.direction as string) ?? "horizontal";
  const transition = (c.transition as string) ?? "slide";
  const duration = (c.duration as number) ?? 500;
  const easing = (c.easing as string) ?? "ease-in-out";
  const autoAdvance = (c.autoAdvance as number) ?? 0;
  const loop = (c.loop as boolean) !== false;
  const showArrows = (c.showArrows as boolean) !== false;
  const showDots = (c.showDots as boolean) !== false;
  const swipe = (c.swipe as boolean) !== false;

  const widthMap: Record<string, string> = {
    "w-full": "100%",
    "w-1/2": "50%",
    "w-1/3": "33.333%",
    "w-1/4": "25%",
    "w-page": "min(64rem,100%)",
    "w-prose": "min(65ch,100%)",
    "w-screen": "100vw",
  };
  const heightMap: Record<string, string> = {
    "h-auto": "auto",
    "h-48": "12rem",
    "h-64": "16rem",
    "h-96": "24rem",
    "h-screen": "min(100vh,1080px)",
  };
  const touchAction = direction === "vertical" ? "pan-x" : "pan-y";
  const wStyle = widthMap[width] ?? width ?? "100%";
  const hStyle = heightMap[height] ?? height ?? "24rem";

  const slides = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  let slidesHtml: string;
  if (slides.length === 0) {
    slidesHtml = `<div style="min-height:80px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;pointer-events:none;">Add blocks as slides</div>`;
  } else {
    slidesHtml = slides
      .map((ch, i) => {
        const isActive = i === 0;
        const innerHtml = blockToHtml(
          ch,
          activeLang,
          mode,
          navSnapshot,
          articleCtx,
        );
        return `<div data-slide-index="${i}" class="slideshow-slide${isActive ? " slide-active" : ""}" style="transition-duration:${duration}ms;transition-timing-function:${easing};" aria-hidden="${isActive ? "false" : "true"}">${innerHtml}</div>`;
      })
      .join("\n");
  }

  const arrowsHtml =
    showArrows && slides.length > 1
      ? direction === "vertical"
        ? `<button class="slideshow-arrow slideshow-prev" aria-label="Previous slide">↑</button>
<button class="slideshow-arrow slideshow-next" aria-label="Next slide">↓</button>`
        : `<button class="slideshow-arrow slideshow-prev" aria-label="Previous slide">←</button>
<button class="slideshow-arrow slideshow-next" aria-label="Next slide">→</button>`
      : "";

  const dotsHtml =
    showDots && slides.length > 1
      ? `<div class="slideshow-dots${direction === "vertical" ? " slideshow-dots--vertical" : ""}">${slides.map((_, i) => `<button class="slideshow-dot${i === 0 ? " active" : ""}" data-dot-index="${i}" aria-label="Go to slide ${i + 1}"></button>`).join("")}</div>`
      : "";

  const label = `<span class="wysiwyg-label">⧉ Slideshow</span>`;

  return `<div
  data-wysiwyg-id="${escAttr(block.id)}"
  data-wysiwyg-type="slideshow"
  data-slideshow=""
  data-slideshow-id="${escAttr(block.id)}"
  data-slideshow-direction="${escAttr(direction)}"
  data-slideshow-transition="${escAttr(transition)}"
  data-slideshow-duration="${duration}"
  data-slideshow-auto-advance="${autoAdvance}"
  data-slideshow-loop="${loop}"
  data-slideshow-swipe="${swipe}"
  style="position:relative;overflow:hidden;width:${wStyle};height:${hStyle};touch-action:${touchAction};"
>
${label}
${slidesHtml}
${arrowsHtml}
${dotsHtml}
</div>`;
}

// ── Article grid (canvas preview) ────────────────────────────────────────────

function articleCardToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
  navSnapshot: NavSnapshot,
  articleCtx?: MockArticle,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  // Standalone cards use the first mock article for preview
  const ctx = articleCtx ?? MOCK_ARTICLES[0];
  const baseCls = containerClassNames(c);
  const extraStyle = containerExtraStyle(c);
  const cls = baseCls;
  const label = `<span class="wysiwyg-label">⧫ Article Card</span>`;

  const children = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const inner = children.length
    ? children
        .map((ch) => blockToHtml(ch, activeLang, mode, navSnapshot, ctx))
        .join("\n")
    : `<div style="min-height:60px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;">Select this card in the inspector to add article fields</div>`;

  // Badge for standalone mode (no grid is supplying context)
  const standaloneBadge = !articleCtx
    ? `<span style="position:absolute;top:2px;right:2px;background:#8b5cf6;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;pointer-events:none;">standalone</span>`
    : "";

  const cardStyle = `position:relative;${extraStyle}`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-card" class="${escAttr(cls)}" style="${escAttr(cardStyle)}">${label}${standaloneBadge}${inner}</div>`;
}

function articleGridToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
  navSnapshot: NavSnapshot,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const cols = (c.grid_cols as number) ?? 3;
  const gap = (c.gap as number) ?? 6;
  const pt = (c.padding_top as number) ?? 10;
  const pb = (c.padding_bottom as number) ?? 10;
  const showViewAll = c.show_view_all !== false;
  const source = (c.source as string) ?? "latest";
  const sourceBadge =
    source === "featured"
      ? "Featured"
      : source === "tag"
        ? `Tag: ${c.tag_filter ?? ""}`
        : "Latest";

  const gapPx = gap * 4;

  // Find article-card child (card template)
  const allChildren = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const cardTemplate = allChildren.find((ch) => ch.type === "article-card");

  // Render mock article cards
  const cards = MOCK_ARTICLES.map((article, i) => {
    const cardHtml = cardTemplate
      ? articleCardToHtml(cardTemplate, activeLang, mode, navSnapshot, article)
      : `<div style="padding:12px;font-size:13px;color:#9ca3af;border:1px dashed #d1d5db;border-radius:8px;">Add an <strong>Article Card</strong> child to define the card layout</div>`;
    const dimStyle = i > 0 ? "opacity:0.5;pointer-events:none;" : "";
    return `<div style="${dimStyle}">${cardHtml}</div>`;
  });

  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-grid" style="padding-top:${pt * 4}px;padding-bottom:${pb * 4}px;position:relative;">
    <span class="wysiwyg-label">◈ Article Grid <span style="background:#3b82f6;color:#fff;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;vertical-align:middle;">${escHtml(sourceBadge)}</span></span>
    <div style="max-width:1280px;margin:0 auto;padding:0 24px;">
      <div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gapPx}px;">
        ${cards.join("\n")}
      </div>
      ${showViewAll ? `<div style="margin-top:${gapPx}px;text-align:right;"><a href="#" style="font-size:14px;color:var(--color-accent,#3b82f6);text-decoration:none;">View all →</a></div>` : ""}
    </div>
  </div>`;
}

// ── Article field blocks (used inside article-grid card template) ─────────────

function articleImageHtml(block: RenderBlock, ctx?: MockArticle): string {
  const c = block.config;
  const id = escAttr(block.id);
  // camelCase keys (matching ArticleFieldInspector / applyArticleImageDefaults)
  const ratio = (c.aspectRatio as string) ?? "16/9";
  const fit = (c.objectFit as string) ?? "cover";
  const br = (c.borderRadius as number) ?? 0;

  const ratioPctMap: Record<string, string> = {
    "16/9": "56.25",
    "4/3": "75",
    "3/2": "66.67",
    "1/1": "100",
  };
  const pct = ratioPctMap[ratio] ?? "56.25";

  const wrapCls = [
    spClass(c.paddingTop, "pt"),
    spClass(c.paddingBottom, "pb"),
    spClass(c.marginTop, "mt"),
    spClass(c.marginBottom, "mb"),
  ]
    .filter(Boolean)
    .join(" ");

  const anim = animAttrs(c);
  const elementId = (c.elementId as string) || "";
  const customStyle = (c.customStyle as string) || "";
  const idAttr = elementId ? ` id="${escAttr(elementId)}"` : "";
  const allWrapCls = [wrapCls, anim.cls].filter(Boolean).join(" ");
  const imgWrapStyle = `position:relative;width:100%;${anim.style}${customStyle}`;
  const animDataAttr = anim.data ? ` ${anim.data}` : "";

  if (ctx?.cover) {
    return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-image"${idAttr} class="${escAttr(allWrapCls)}" style="${escAttr(imgWrapStyle)}"${animDataAttr}>
      <span class="wysiwyg-label">↗ Article Image</span>
      <div style="position:relative;width:100%;padding-bottom:${pct}%;overflow:hidden;border-radius:${br}px;">
        <img src="${escAttr(ctx.cover)}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:${escAttr(fit)};" />
      </div>
    </div>`;
  }
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-image"${idAttr} class="${escAttr(allWrapCls)}" style="${escAttr(imgWrapStyle)}"${animDataAttr}>
    <span class="wysiwyg-label">↗ Article Image</span>
    <div style="position:relative;width:100%;padding-bottom:${pct}%;overflow:hidden;background:#e5e7eb;border-radius:${br}px;">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9ca3af;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
      </div>
    </div>
  </div>`;
}

// Article text fields share the same config keys as the text block (camelCase)
// and use text-block-style Tailwind class building.

const twWeightMap: Record<string, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};
const twAlignMap: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
  justify: "text-justify",
};

/**
 * Build a full Tailwind class list for a text-like article field block,
 * mirroring the property set that TextInspector exposes.
 */
function buildArticleTextCls(
  c: Record<string, unknown>,
  defaults: { fontSize?: string; fontWeight?: string; color?: string },
): { classAttr: string; styleAttr: string } {
  const fontSize = (c.fontSize as number | null) || null;
  const fontWeight =
    (c.fontWeight as string) || defaults.fontWeight || "normal";
  const textAlign = (c.textAlign as string) || "left";
  const color = (c.color as string) || defaults.color || null;
  const italic = !!c.italic;
  const letterSpacing = (c.letterSpacing as number) ?? 0;
  const lineHeight = (c.lineHeight as number) || null;
  const textTransform = (c.textTransform as string) || "none";
  const textDecoration = (c.textDecoration as string) || "none";
  const bgColor = (c.bgColor as string) || null;
  const maxWidth = (c.maxWidth as string) || "";
  const customStyle = (c.customStyle as string) || "";

  const cls: string[] = [];
  const dynStyle: string[] = [];
  if (fontSize) {
    dynStyle.push(`font-size:${fontSize}px;`);
  } else {
    cls.push(defaults.fontSize ?? "text-base");
  }
  cls.push(twWeightMap[fontWeight] ?? "font-normal");
  cls.push(twAlignMap[textAlign] ?? "text-left");
  if (italic) cls.push("italic");
  if (color) dynStyle.push(`color:${color};`);
  if (letterSpacing) dynStyle.push(`letter-spacing:${letterSpacing / 100}em;`);
  if (lineHeight) dynStyle.push(`line-height:${lineHeight};`);
  const twTransform: Record<string, string> = {
    uppercase: "uppercase",
    lowercase: "lowercase",
    capitalize: "capitalize",
  };
  if (textTransform && textTransform !== "none")
    cls.push(twTransform[textTransform] ?? "");
  if (textDecoration === "underline") cls.push("underline");
  else if (textDecoration === "line-through") cls.push("line-through");
  if (bgColor) dynStyle.push(`background-color:${bgColor};`);
  cls.push(spClass(c.paddingTop, "pt"));
  cls.push(spClass(c.paddingBottom, "pb"));
  cls.push(spClass(c.paddingLeft, "pl"));
  cls.push(spClass(c.paddingRight, "pr"));
  cls.push(spClass(c.marginTop, "mt"));
  cls.push(spClass(c.marginBottom, "mb"));
  cls.push(spClass(c.marginLeft, "ml"));
  cls.push(spClass(c.marginRight, "mr"));
  if (maxWidth) dynStyle.push(`max-width:${maxWidth};`);

  const allStyle = dynStyle.join("") + customStyle;
  return {
    classAttr: cls.filter(Boolean).join(" "),
    styleAttr: allStyle ? ` style="${escAttr(allStyle)}"` : "",
  };
}

function articleTitleHtml(block: RenderBlock, ctx?: MockArticle): string {
  const c = block.config;
  const id = escAttr(block.id);
  const tag = (c.tag as string) ?? "h3";
  const safeTag = ["h2", "h3", "h4"].includes(tag) ? tag : "h3";
  const tagSizeMap: Record<string, string> = {
    h2: "text-2xl",
    h3: "text-xl",
    h4: "text-lg",
  };
  const { classAttr, styleAttr } = buildArticleTextCls(c, {
    fontSize: tagSizeMap[safeTag] ?? "text-xl",
    fontWeight: "bold",
    color: "var(--color-text,inherit)",
  });
  const title = ctx?.title ?? "Article title placeholder";
  // Merge margin:0 with any customStyle
  const headingStyle = styleAttr
    ? styleAttr.replace(' style="', ' style="margin:0;')
    : ' style="margin:0;"';
  const anim = animAttrs(c);
  const wrapClass = anim.cls ? ` class="${escAttr(anim.cls)}"` : "";
  const animDataAttr = anim.data ? ` ${anim.data}` : "";
  const titleWrapStyle = `position:relative;display:block;${anim.style}`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-title"${wrapClass} style="${escAttr(titleWrapStyle)}"${animDataAttr}>
    <span class="wysiwyg-label">↗ Article Title</span>
    <${safeTag} class="${escAttr(classAttr)}"${headingStyle}><a href="#" style="color:inherit;text-decoration:none;">${escHtml(title)}</a></${safeTag}>
  </div>`;
}

function articleExcerptHtml(block: RenderBlock, ctx?: MockArticle): string {
  const c = block.config;
  const id = escAttr(block.id);
  const lineClamp = (c.lineClamp as number) ?? 3;
  const { classAttr, styleAttr } = buildArticleTextCls(c, {
    fontSize: "text-sm",
    fontWeight: "normal",
    color: "var(--color-muted,#6b7280)",
  });
  const clampStyle =
    lineClamp > 0
      ? `overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:${lineClamp};`
      : "";
  const text =
    ctx?.excerpt ??
    "Article excerpt will appear here with a preview of the first few lines of the content…";
  // Merge clamp + margin:0 with any customStyle
  const baseStyle = `margin:0;${clampStyle}`;
  const pStyle = styleAttr
    ? styleAttr.replace(' style="', ` style="${baseStyle}`)
    : ` style="${baseStyle}"`;
  const anim = animAttrs(c);
  const wrapClass = anim.cls ? ` class="${escAttr(anim.cls)}"` : "";
  const animDataAttr = anim.data ? ` ${anim.data}` : "";
  const excerptWrapStyle = `position:relative;display:block;${anim.style}`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-excerpt"${wrapClass} style="${escAttr(excerptWrapStyle)}"${animDataAttr}>
    <span class="wysiwyg-label">↗ Article Excerpt</span>
    <p class="${escAttr(classAttr)}"${pStyle}>${escHtml(text)}</p>
  </div>`;
}

function articleDateHtml(block: RenderBlock, ctx?: MockArticle): string {
  const c = block.config;
  const id = escAttr(block.id);
  const { classAttr, styleAttr } = buildArticleTextCls(c, {
    fontSize: "text-xs",
    fontWeight: "normal",
    color: "var(--color-muted,#6b7280)",
  });
  const date = ctx?.date ?? "Jan 1, 2025";
  const anim = animAttrs(c);
  const wrapClass = anim.cls ? ` class="${escAttr(anim.cls)}"` : "";
  const animDataAttr = anim.data ? ` ${anim.data}` : "";
  const dateWrapStyle = `position:relative;display:inline-block;${anim.style}`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-date"${wrapClass} style="${escAttr(dateWrapStyle)}"${animDataAttr}>
    <span class="wysiwyg-label">↗ Article Date</span>
    <time class="${escAttr(classAttr)}"${styleAttr}>${escHtml(date)}</time>
  </div>`;
}

function articleTagHtml(block: RenderBlock, ctx?: MockArticle): string {
  const c = block.config;
  const id = escAttr(block.id);
  const fgColor = (c.color as string) || "var(--color-accent,#1a56db)";
  const bgColor =
    (c.bgColor as string) || `color-mix(in srgb, ${fgColor} 10%, transparent)`;
  const fontSize = c.fontSize as number | null;
  const fontWeight = (c.fontWeight as string) || "semibold";
  const textAlign = (c.textAlign as string) || "left";
  const italic = !!c.italic;
  const letterSpacing = (c.letterSpacing as number) ?? 0;
  const textTransform = (c.textTransform as string) || "none";
  const textDecoration = (c.textDecoration as string) || "none";
  const customStyle = (c.customStyle as string) || "";

  const wrapCls = [
    twAlignMap[textAlign] ?? "text-left",
    spClass(c.paddingTop, "pt"),
    spClass(c.paddingBottom, "pb"),
    spClass(c.paddingLeft, "pl"),
    spClass(c.paddingRight, "pr"),
    spClass(c.marginTop, "mt"),
    spClass(c.marginBottom, "mb"),
    spClass(c.marginLeft, "ml"),
    spClass(c.marginRight, "mr"),
  ]
    .filter(Boolean)
    .join(" ");

  const anim = animAttrs(c);
  const allWrapCls = [wrapCls, anim.cls].filter(Boolean).join(" ");
  const tagWrapStyle = `position:relative;display:inline-block;${anim.style}${customStyle}`;
  const animDataAttr = anim.data ? ` ${anim.data}` : "";

  const fs = fontSize ? `${fontSize}px` : "11px";
  const fw =
    { normal: "400", medium: "500", semibold: "600", bold: "700" }[
      fontWeight
    ] ?? "600";
  const badgeStyle =
    [
      `display:inline-block`,
      `padding:2px 8px`,
      `border-radius:4px`,
      `font-size:${fs}`,
      `font-weight:${fw}`,
      `color:${fgColor}`,
      `background:${bgColor}`,
      italic ? `font-style:italic` : "",
      letterSpacing ? `letter-spacing:${letterSpacing / 100}em` : "",
      textTransform !== "none" ? `text-transform:${textTransform}` : "",
      textDecoration !== "none" ? `text-decoration:${textDecoration}` : "",
    ]
      .filter(Boolean)
      .join(";") + ";";

  const tag = ctx?.tag ?? "Tag";
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-tag" class="${escAttr(allWrapCls)}" style="${escAttr(tagWrapStyle)}"${animDataAttr}>
    <span class="wysiwyg-label">↗ Article Tag</span>
    <span style="${escAttr(badgeStyle)}">${escHtml(tag)}</span>
  </div>`;
}

function articleBodyHtml(
  block: RenderBlock,
  ctx?: MockArticle | ArticleCtx,
): string {
  const c = block.config;
  const id = escAttr(block.id);
  const baseCls = containerClassNames(c);
  const extraStyle = containerExtraStyle(c);
  const proseCls =
    c.prose !== false
      ? c.width === "w-prose"
        ? "prose"
        : "prose max-w-none"
      : "";
  const anim = animAttrs(c);
  const cls = [baseCls, anim.cls, proseCls].filter(Boolean).join(" ");
  const customStyle = (c.customStyle as string) || "";
  const cw = (c.width as string) ?? "w-full";
  const ch = (c.height as string) ?? "h-auto";
  const bgImg = (c.backgroundImage as string) || "";
  const bgSize = (c.backgroundSize as string) ?? "cover";
  const bgPos = (c.backgroundPosition as string) ?? "center";
  const bgStyle = bgImg
    ? `background-image:url('${escAttr(bgImg)}');background-size:${bgSize};background-position:${bgPos};background-repeat:no-repeat;`
    : "";
  const customWidthStyle = !cw.startsWith("w-") ? `width:${cw};` : "";
  const customHeightStyle = !ch.startsWith("h-") ? `height:${ch};` : "";
  const fullStyle = [
    anim.style,
    customWidthStyle,
    customHeightStyle,
    extraStyle,
    bgStyle,
    customStyle,
  ]
    .filter(Boolean)
    .join("");
  const styleAttr = fullStyle ? ` style="${escAttr(fullStyle)}"` : "";
  const animDataAttr = anim.data ? ` ${anim.data}` : "";
  const label = `<span class="wysiwyg-label">↗ Article Body</span>`;
  const bodyHtml =
    (ctx as ArticleCtx | undefined)?.body ??
    `<p style="color:#9ca3af;font-size:13px;text-align:center;padding:24px;">Article body will appear here</p>`;
  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="article-body" class="${escAttr(cls)}"${styleAttr}${animDataAttr}>
  ${label}
  ${bodyHtml}
</div>`;
}

function containerClassNames(c: Record<string, unknown>): string {
  const cls: string[] = ["flex"];
  cls.push(c.direction === "col" ? "flex-col" : "flex-row");
  cls.push(c.wrap === "wrap" ? "flex-wrap" : "flex-nowrap");

  const justify = (c.justify as string) ?? "start";
  cls.push(
    justify === "center"
      ? "justify-center"
      : justify === "end"
        ? "justify-end"
        : justify === "between"
          ? "justify-between"
          : "justify-start",
  );

  const align = (c.align as string) ?? "start";
  cls.push(
    align === "center"
      ? "items-center"
      : align === "end"
        ? "items-end"
        : align === "stretch"
          ? "items-stretch"
          : "items-start",
  );

  const gapX = (c.gapX as number) ?? 4;
  const gapY = (c.gapY as number) ?? 4;
  if (gapX === gapY) cls.push(`gap-${gapX}`);
  else {
    cls.push(`gap-x-${gapX}`);
    cls.push(`gap-y-${gapY}`);
  }

  const pt = (c.paddingTop as number) ?? 6;
  const pb = (c.paddingBottom as number) ?? 6;
  const pl = (c.paddingLeft as number) ?? 6;
  const pr = (c.paddingRight as number) ?? 6;
  if (pt === pb && pl === pr && pt === pl) {
    cls.push(`p-${pt}`);
  } else {
    if (pt === pb) cls.push(`py-${pt}`);
    else {
      cls.push(`pt-${pt}`);
      cls.push(`pb-${pb}`);
    }
    if (pl === pr) cls.push(`px-${pl}`);
    else {
      cls.push(`pl-${pl}`);
      cls.push(`pr-${pr}`);
    }
  }

  const mt = (c.marginTop as number) ?? 0;
  const mb = (c.marginBottom as number) ?? 0;
  const ml = (c.marginLeft as number) ?? 0;
  const mr = (c.marginRight as number) ?? 0;
  if (mt > 0) cls.push(`mt-${mt}`);
  if (mb > 0) cls.push(`mb-${mb}`);
  if (ml > 0) cls.push(`ml-${ml}`);
  if (mr > 0) cls.push(`mr-${mr}`);

  const w = (c.width as string) ?? "w-full";
  if (w === "w-1/2") cls.push("w-1/2");
  else if (w === "w-1/3") cls.push("w-1/3");
  else if (w === "w-1/4") cls.push("w-1/4");
  else if (w === "w-page") {
    cls.push("w-full");
    cls.push("max-w-5xl");
    cls.push("mx-auto");
  } else if (w === "w-prose") {
    cls.push("w-full");
    cls.push("max-w-prose");
    cls.push("mx-auto");
  } else if (w === "w-auto") cls.push("w-auto");
  else if (w === "w-screen") cls.push("w-screen");
  else if (!w.startsWith("w-")) {
    /* custom px — handled via inline style */
  } else cls.push("w-full");

  const h = (c.height as string) ?? "h-auto";
  if (h === "h-full") cls.push("h-full");
  else if (h === "h-screen") cls.push("h-screen");
  // custom px heights handled via inline style

  return cls.join(" ");
}

function containerExtraStyle(c: Record<string, unknown>): string {
  const parts: string[] = [];
  if (c.backgroundColor) parts.push(`background-color:${c.backgroundColor};`);
  // background-image is rendered as inline style, not a Tailwind class
  if (c.borderRadius && (c.borderRadius as number) > 0)
    parts.push(`border-radius:${c.borderRadius}px;`);
  if (c.textColor) parts.push(`color:${c.textColor};`);
  return parts.join("");
}

// ── Text ──────────────────────────────────────────────────────────────────────

function textToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
): string {
  const c = block.config;

  let content: string;
  if (mode === "home" && block.translations) {
    content =
      (block.translations[activeLang] as Record<string, string> | undefined)
        ?.content ?? "";
  } else {
    content = (c.content as string) ?? "";
  }

  const tag = (c.tag as string) || "p";
  const safeTag = ["p", "h1", "h2", "h3", "h4", "span", "code"].includes(tag)
    ? tag
    : "p";
  const fontSize = (c.fontSize as number | null) || null;
  const fontWeight = (c.fontWeight as string) || "normal";
  const textAlign = (c.textAlign as string) || "left";
  const color = (c.color as string) || null;
  const italic = !!c.italic;
  const letterSpacing = (c.letterSpacing as number) ?? 0;
  const lineHeight = (c.lineHeight as number) || null;
  const textTransform = (c.textTransform as string) || "none";
  const textDecoration = (c.textDecoration as string) || "none";
  const bgColor = (c.bgColor as string) || null;
  const maxWidth = (c.maxWidth as string) || "";
  const elementId = (c.elementId as string) || "";
  const customStyle = (c.customStyle as string) || "";

  // ── Build Tailwind class list ──────────────────────────────────────────────
  const cls: string[] = [];
  const dynStyle: string[] = [];

  // Font size: explicit px OR tag-based heading class
  const tagSizeMap: Record<string, string> = {
    h1: "text-4xl",
    h2: "text-3xl",
    h3: "text-2xl",
    h4: "text-xl",
  };
  if (fontSize) {
    dynStyle.push(`font-size:${fontSize}px;`);
  } else {
    cls.push(tagSizeMap[safeTag] ?? "text-base");
  }

  const twWeight: Record<string, string> = {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
  };
  cls.push(twWeight[fontWeight] ?? "font-normal");

  const twAlign: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
    justify: "text-justify",
  };
  cls.push(twAlign[textAlign] ?? "text-left");

  if (italic) cls.push("italic");
  if (color) dynStyle.push(`color:${color};`);
  if (letterSpacing) dynStyle.push(`letter-spacing:${letterSpacing / 100}em;`);
  if (lineHeight) dynStyle.push(`line-height:${lineHeight};`);

  const twTransform: Record<string, string> = {
    uppercase: "uppercase",
    lowercase: "lowercase",
    capitalize: "capitalize",
  };
  if (textTransform && textTransform !== "none")
    cls.push(twTransform[textTransform] ?? "");

  if (textDecoration === "underline") cls.push("underline");
  else if (textDecoration === "line-through") cls.push("line-through");

  if (bgColor) dynStyle.push(`background-color:${bgColor};`);

  // Always set all 4 padding/margin sides to prevent browser default margins
  cls.push(spClass(c.paddingTop, "pt"));
  cls.push(spClass(c.paddingBottom, "pb"));
  cls.push(spClass(c.paddingLeft, "pl"));
  cls.push(spClass(c.paddingRight, "pr"));
  cls.push(spClass(c.marginTop, "mt"));
  cls.push(spClass(c.marginBottom, "mb"));
  cls.push(spClass(c.marginLeft, "ml"));
  cls.push(spClass(c.marginRight, "mr"));

  if (maxWidth) dynStyle.push(`max-width:${maxWidth};`);

  const classAttr = cls.filter(Boolean).join(" ");
  const allStyle = dynStyle.join("") + customStyle;
  const styleAttr = allStyle ? ` style="${escAttr(allStyle)}"` : "";
  const idAttr = elementId ? ` id="${escAttr(elementId)}"` : "";
  const anim = animAttrs(c);
  const wrapStyle = anim.style
    ? ` style="position:relative;${anim.style}"`
    : ' style="position:relative"';
  const wrapCls = anim.cls ? ` class="${escAttr(anim.cls)}"` : "";
  const animData = anim.cls ? ` ${anim.data}` : "";

  const placeholder =
    safeTag === "p"
      ? "Double-click to edit text…"
      : `Double-click to edit ${safeTag.toUpperCase()}…`;
  const labelText = safeTag === "p" ? "T Text" : `T ${safeTag.toUpperCase()}`;

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="text"${wrapCls}${wrapStyle}${animData}><span class="wysiwyg-label">${escHtml(labelText)}</span><${safeTag}${idAttr} contenteditable="false" data-wysiwyg-content-id="${escAttr(block.id)}" data-placeholder="${escAttr(placeholder)}" class="${escAttr(classAttr)}"${styleAttr}>${content}</${safeTag}></div>`;
}

// ── Button ─────────────────────────────────────────────────────────────────────

function buttonToHtml(block: RenderBlock): string {
  const c = block.config;
  const label = (c.label as string) || "Button";
  const href = (c.href as string) || "#";
  const target = (c.target as string) || "_self";
  const variant = (c.variant as string) || "filled";
  const size = (c.size as string) || "md";
  const align = (c.align as string) || "left";
  const bgColor = (c.bgColor as string) || null;
  const textColor = (c.textColor as string) || null;
  const borderColor = (c.borderColor as string) || null;
  const borderRadius = (c.borderRadius as number) ?? 6;
  const fontWeight = (c.fontWeight as string) || "semibold";
  const btnElementId = (c.elementId as string) || "";
  const btnCustomStyle = (c.customStyle as string) || "";

  // ── Button anchor classes ──────────────────────────────────────────────────
  const sizeMap: Record<string, { py: string; px: string; text: string }> = {
    sm: { py: "py-[6px]", px: "px-[14px]", text: "text-[13px]" },
    md: { py: "py-[10px]", px: "px-[22px]", text: "text-[15px]" },
    lg: { py: "py-[14px]", px: "px-[32px]", text: "text-[18px]" },
  };
  const sz = sizeMap[size] ?? sizeMap["md"];

  const twWeight: Record<string, string> = {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
    bold: "font-bold",
  };

  const btnCls: string[] = [
    "inline-block",
    sz.py,
    sz.px,
    sz.text,
    twWeight[fontWeight] ?? "font-semibold",
    "cursor-pointer",
    "no-underline",
    "leading-[1.25]",
    "transition-opacity",
    "duration-150",
    "border-2",
    "border-solid",
  ];

  const accent = "var(--color-accent,#3b82f6)";
  const btnStyleParts: string[] = [`border-radius:${borderRadius}px;`];
  if (variant === "filled") {
    btnStyleParts.push(`background-color:${bgColor ?? accent};`);
    btnStyleParts.push(`color:${textColor ?? "#fff"};`);
    btnCls.push("border-transparent");
  } else if (variant === "outline") {
    btnCls.push("bg-transparent");
    btnStyleParts.push(`color:${textColor ?? bgColor ?? accent};`);
    btnStyleParts.push(`border-color:${borderColor ?? bgColor ?? accent};`);
  } else {
    // ghost
    btnCls.push("bg-transparent");
    btnStyleParts.push(`color:${textColor ?? bgColor ?? accent};`);
    btnCls.push("border-transparent");
  }

  const btnStyleAttr = ` style="${escAttr(btnStyleParts.join("") + btnCustomStyle)}"`;
  const btnIdAttr = btnElementId ? ` id="${escAttr(btnElementId)}"` : "";

  // ── Wrapper classes ────────────────────────────────────────────────────────
  const twAlign: Record<string, string> = {
    left: "text-left",
    center: "text-center",
    right: "text-right",
  };
  const wrapCls: string[] = ["relative", twAlign[align] ?? "text-left"];
  wrapCls.push(spClass(c.paddingTop, "pt"));
  wrapCls.push(spClass(c.paddingBottom, "pb"));
  wrapCls.push(spClass(c.paddingLeft, "pl"));
  wrapCls.push(spClass(c.paddingRight, "pr"));
  wrapCls.push(spClass(c.marginTop, "mt"));
  wrapCls.push(spClass(c.marginBottom, "mb"));
  wrapCls.push(spClass(c.marginLeft, "ml"));
  wrapCls.push(spClass(c.marginRight, "mr"));
  const anim = animAttrs(c);
  if (anim.cls) wrapCls.push(anim.cls);
  const animData = anim.cls ? ` ${anim.data}` : "";
  const wrapStyle = anim.style ? ` style="${escAttr(anim.style)}"` : "";

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="button" class="${escAttr(wrapCls.join(" "))}"${wrapStyle}${animData}><span class="wysiwyg-label">⬤ Button</span><a${btnIdAttr} href="${escAttr(href)}" target="${escAttr(target)}" class="${escAttr(btnCls.join(" "))}"${btnStyleAttr}>${escHtml(label)}</a></div>`;
}

// ── Image ─────────────────────────────────────────────────────────────────────

function imageToHtml(block: RenderBlock): string {
  const c = block.config;
  const src = (c.src as string) || "";
  const alt = escAttr((c.alt as string) || "");
  const objectFit = (c.objectFit as string) || "cover";
  const borderRadius = (c.borderRadius as number) || 0;
  const width = (c.width as string) || "w-full";
  const height = (c.height as string) || "h-auto";
  const imgElementId = (c.elementId as string) || "";
  const imgCustomStyle = (c.customStyle as string) || "";
  const twFit: Record<string, string> = {
    cover: "object-cover",
    contain: "object-contain",
    fill: "object-fill",
    none: "object-none",
  };

  // ── Img classes ────────────────────────────────────────────────────────────
  const imgCls: string[] = [
    "w-full",
    "block",
    twFit[objectFit] ?? "object-cover",
    borderRadius ? `rounded-[${borderRadius}px]` : "",
  ].filter(Boolean);

  const imgStyleAttr = imgCustomStyle
    ? ` style="${escAttr(imgCustomStyle)}"`
    : "";
  const imgIdAttr = imgElementId ? ` id="${escAttr(imgElementId)}"` : "";

  // ── Wrapper classes ────────────────────────────────────────────────────────
  const wrapCls: string[] = ["relative", width, height];
  wrapCls.push(spClass(c.paddingTop, "pt"));
  wrapCls.push(spClass(c.paddingBottom, "pb"));
  wrapCls.push(spClass(c.paddingLeft, "pl"));
  wrapCls.push(spClass(c.paddingRight, "pr"));
  wrapCls.push(spClass(c.marginTop, "mt"));
  wrapCls.push(spClass(c.marginBottom, "mb"));
  wrapCls.push(spClass(c.marginLeft, "ml"));
  wrapCls.push(spClass(c.marginRight, "mr"));
  const anim = animAttrs(c);
  if (anim.cls) wrapCls.push(anim.cls);
  const animData = anim.cls ? ` ${anim.data}` : "";
  const animStyle = anim.style ? ` style="${escAttr(anim.style)}"` : "";

  if (!src) {
    return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="image" class="block-placeholder ${escAttr(wrapCls.join(" "))}"><span class="wysiwyg-label">⬛ Image</span><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Select an image in the inspector</span></div>`;
  }

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="image" class="${escAttr(wrapCls.join(" "))}"${animStyle}${animData}><span class="wysiwyg-label">⬛ Image</span><img${imgIdAttr} src="${escAttr(src)}" alt="${alt}" class="${escAttr(imgCls.join(" "))}"${imgStyleAttr} /></div>`;
}

// ── Rich text inline renderer ────────────────────────────────────────────────

function richTextToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page" | "article",
): string {
  const c = block.config;
  const content =
    mode === "home"
      ? ((block.translations?.[activeLang]?.content as string) ?? "")
      : ((c.content as string) ?? "");
  const id = escAttr(block.id);
  const label = `<span class="wysiwyg-label">¶ Rich Text</span>`;
  const displayContent = content.trim()
    ? content
    : `<p style="color:#9ca3af;font-style:italic;">Double-click to edit rich text&hellip;</p>`;

  // Spacing / sizing classes from config
  const cls = [
    spClass(c.paddingTop, "pt"),
    spClass(c.paddingBottom, "pb"),
    spClass(c.paddingLeft, "pl"),
    spClass(c.paddingRight, "pr"),
    spClass(c.marginTop, "mt"),
    spClass(c.marginBottom, "mb"),
    spClass(c.marginLeft, "ml"),
    spClass(c.marginRight, "mr"),
  ]
    .filter(
      (v) =>
        v !== "pt-0" &&
        v !== "pb-0" &&
        v !== "pl-0" &&
        v !== "pr-0" &&
        v !== "mt-0" &&
        v !== "mb-0" &&
        v !== "ml-0" &&
        v !== "mr-0",
    )
    .join(" ");

  const customStyle = (c.customStyle as string) || "";
  const idAttr = (c.elementId as string)
    ? ` id="${escAttr(c.elementId as string)}"`
    : "";

  return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="rich-text"${idAttr} class="w-full ${cls}" style="position:relative;cursor:pointer;${customStyle}" title="Double-click to edit">${label}<div class="prose max-w-none w-full" style="pointer-events:none;">${displayContent}</div></div>`;
}

// ── Template placeholders ─────────────────────────────────────────────────────

const TEMPLATE_ICONS: Partial<Record<BlockType, string>> = {
  hero: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`,
  "featured-articles": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`,
  "latest-articles": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>`,
  "cta-band": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="8" width="20" height="8" rx="2"/><path d="M8 12h8"/></svg>`,
  "rich-text": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 10h16M4 14h10M4 18h8"/></svg>`,
  "image-text": `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="9" height="16" rx="1"/><path d="M15 8h5M15 12h5M15 16h5"/></svg>`,
  testimonials: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>`,
  newsletter: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg>`,
};

const TEMPLATE_DISPLAY: Partial<Record<BlockType, string>> = {
  hero: "Hero Section",
  "featured-articles": "Featured Articles",
  "latest-articles": "Latest Articles",
  "cta-band": "CTA Band",
  "rich-text": "Rich Text",
  "image-text": "Image + Text",
  testimonials: "Testimonials",
  newsletter: "Newsletter",
};

function templatePlaceholderHtml(block: RenderBlock): string {
  const icon =
    TEMPLATE_ICONS[block.type as BlockType] ??
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="2"/></svg>`;
  const label = TEMPLATE_DISPLAY[block.type as BlockType] ?? block.type;
  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="template" class="block-placeholder"><span class="wysiwyg-label">◈ ${escHtml(label)}</span>${icon}<span class="bp-label">${escHtml(label)}</span><span style="font-size:11px;color:#9ca3af;">Select to edit in inspector →</span></div>`;
}

// ── Nav-aware blocks ──────────────────────────────────────────────────────────

function navBlockHtml(block: RenderBlock, snap: NavSnapshot): string {
  const c = block.config;
  const id = escAttr(block.id);
  const labelText = navBlockLabel(block.type);
  const label = `<span class="wysiwyg-label">⬡ ${escHtml(labelText)}</span>`;

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
      const links =
        source === "footer" ? (snap.footerLinks ?? []) : (snap.navLinks ?? []);
      const layout = (c.layout as string) ?? "vertical";
      const linkColor = (c.link_color as string) || "var(--color-muted)";
      const flexDir = layout === "vertical" ? "column" : "row";
      const flexWrap = layout === "grid" ? "wrap" : "nowrap";

      let renderLinks: Array<{ label: string; url: string }>;
      if (parentKey) {
        const parent = links.find((l) => l.label === parentKey);
        renderLinks = (parent as any)?.children ?? [];
      } else {
        // Empty parent_key → show all root links from the source directly
        renderLinks = links;
      }

      const childHtml = renderLinks.length
        ? renderLinks
            .map(
              (ch) =>
                `<a href="#" style="color:${escAttr(linkColor)};text-decoration:none;${layout === "grid" ? "width:50%;" : ""}">${escHtml(ch.label)}</a>`,
            )
            .join("")
        : `<span style="color:#9ca3af;font-size:12px;">${parentKey ? "No children — select a parent link with dropdown children" : "No links configured"}</span>`;
      return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="subnav-links"
        style="display:flex;flex-direction:${flexDir};flex-wrap:${flexWrap};gap:8px;padding:12px;">
        ${label}${childHtml}
      </div>`;
    }

    case "single-nav-item": {
      const source = (c.source as string) ?? "nav";
      const linkKey = (c.link_key as string) ?? "";
      const renderAs = (c.render_as as string) ?? "link";
      const links =
        source === "footer" ? (snap.footerLinks ?? []) : (snap.navLinks ?? []);
      const allLinks = links.flatMap((l) => [
        l,
        ...((l as any).children ?? []),
      ]);
      const found = allLinks.find((l) => l.label === linkKey);
      const rawColor = (c.link_color as string) || "";
      // Ensure CSS vars always carry a #hex fallback so they resolve in the iframe
      const safeColor =
        rawColor.startsWith("var(") && !rawColor.includes(",")
          ? rawColor.slice(0, -1) + ",#3b82f6)"
          : rawColor || "#3b82f6";
      const label2 = found?.label ?? (linkKey || "— select a link —");
      const btnHtml =
        renderAs === "button"
          ? `<a href="#" style="display:inline-block;padding:6px 16px;font-size:13px;font-weight:600;border-radius:6px;background:${escAttr(safeColor)};color:#fff;text-decoration:none;line-height:1.4;border:2px solid transparent;">${escHtml(label2)}</a>`
          : `<a href="#" style="color:${escAttr(safeColor)};text-decoration:none;font-size:14px;">${escHtml(label2)}</a>`;
      return `<div data-wysiwyg-id="${id}" data-wysiwyg-type="single-nav-item" style="display:inline-block;padding:4px;">
        ${label}
        ${btnHtml}
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
      const displayName =
        found?.platform ?? (platform || "— select a platform —");
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
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
}

// ── Interaction script ────────────────────────────────────────────────────────

function buildInteractionScript(): string {
  return `(function(){
  var activeContentId=null,dragFromId=null,selectedId=null;
  function reportHeight(){
    var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,400);
    window.parent.postMessage({type:'height',value:h},'*');
  }
  // Returns true if targetEl is the same as or a DOM descendant of the element
  // currently being dragged. Used to prevent a block from being dropped into itself.
  function isDragAncestorOf(targetEl){
    if(!dragFromId) return false;
    var src=document.querySelector('[data-wysiwyg-id="'+dragFromId+'"]');
    if(!src) return false;
    return src===targetEl||src.contains(targetEl);
  }
  function getRootDropZone(){
    var dz=document.getElementById('wysiwyg-root-dropzone');
    if(!dz){
      dz=document.createElement('div');
      dz.id='wysiwyg-root-dropzone';
      dz.innerHTML='<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 3v10M3 8l5 5 5-5"/></svg> Drop here — move to root level';
      document.getElementById('wysiwyg-root').appendChild(dz);
      dz.addEventListener('dragover',function(e){e.preventDefault();e.stopPropagation();dz.classList.add('dz-active');});
      dz.addEventListener('dragleave',function(){dz.classList.remove('dz-active');});
      dz.addEventListener('drop',function(e){
        e.preventDefault();e.stopPropagation();
        dz.classList.remove('dz-active','dz-visible');
        var fromId=e.dataTransfer.getData('text/plain');
        if(fromId) window.parent.postMessage({type:'moveToRoot',fromId:fromId},'*');
      });
    }
    return dz;
  }
  function showRootDropZone(){getRootDropZone().classList.add('dz-visible');}
  function hideRootDropZone(){var dz=document.getElementById('wysiwyg-root-dropzone');if(dz)dz.classList.remove('dz-visible','dz-active');}
  // Returns true if the nearest ancestor container uses flex-row direction
  function isParentRow(el){
    var p=el.parentElement;
    while(p){
      if(p.dataset&&(p.dataset.wysiwygType==='container')){
        return window.getComputedStyle(p).flexDirection==='row';
      }
      p=p.parentElement;
    }
    return false;
  }
  function bindInteractions(){
    // Ensure the root drop zone element exists
    getRootDropZone();
    document.querySelectorAll('[data-wysiwyg-id]').forEach(function(el){
      el.addEventListener('click',function(e){
        e.stopPropagation();
        window.parent.postMessage({type:'select',id:el.dataset.wysiwygId},'*');
      });
      el.removeAttribute('draggable');
      el.addEventListener('mousedown',function(){
        // Suppress drag if a text child is actively being edited
        var contentEl=el.querySelector('[data-wysiwyg-content-id]');
        if(contentEl&&contentEl.getAttribute('contenteditable')==='true') return;
        el.setAttribute('draggable','true');
      });
      el.addEventListener('mouseup',function(){el.removeAttribute('draggable');});
      el.addEventListener('dragstart',function(e){
        if(!el.getAttribute('draggable')){e.preventDefault();return;}
        dragFromId=el.dataset.wysiwygId;
        e.dataTransfer.effectAllowed='move';
        e.dataTransfer.setData('text/plain',el.dataset.wysiwygId);
        e.stopPropagation();
        // Use a compact label ghost so the dragged element itself doesn't obscure drop targets
        var label=el.querySelector('.wysiwyg-label');
        var ghost=document.createElement('div');
        ghost.textContent=(label?label.textContent.trim():'Block')||'Block';
        ghost.style.cssText='position:fixed;top:-999px;left:-999px;padding:3px 10px;background:#3b82f6;color:#fff;font-size:11px;font-weight:600;border-radius:4px;font-family:system-ui,sans-serif;pointer-events:none;';
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost,0,0);
        setTimeout(function(){document.body.removeChild(ghost);},0);
        showRootDropZone();
      });
      el.addEventListener('dragend',function(){el.removeAttribute('draggable');clearDropHints();hideRootDropZone();});
      var isContainer=el.dataset.wysiwygType==='container'||el.dataset.wysiwygType==='slideshow';
      if(isContainer){
        el.addEventListener('dragover',function(e){
          e.preventDefault();e.stopPropagation();
          if(isDragAncestorOf(el)) return;
          clearDropHints();
          el.classList.add('wysiwyg-drop-inside');
        });
        el.addEventListener('dragleave',function(e){
          if(!el.contains(e.relatedTarget)) clearDropHints();
        });
        el.addEventListener('drop',function(e){
          e.preventDefault();e.stopPropagation();
          var fromId=e.dataTransfer.getData('text/plain');
          var toId=el.dataset.wysiwygId;
          clearDropHints();
          if(fromId&&fromId!==toId&&!isDragAncestorOf(el)) window.parent.postMessage({type:'moveToContainer',fromId:fromId,containerId:toId},'*');
        });
      } else {
        // Non-container: direction-aware before/after drop hints
        el.addEventListener('dragover',function(e){
          e.preventDefault();e.stopPropagation();
          if(isDragAncestorOf(el)) return;
          clearDropHints();
          var rect=el.getBoundingClientRect();
          if(isParentRow(el)){
            if(e.clientX<rect.left+rect.width/2) el.classList.add('wysiwyg-drop-left');
            else el.classList.add('wysiwyg-drop-right');
          } else {
            if(e.clientY<rect.top+rect.height/2) el.classList.add('wysiwyg-drop-before');
            else el.classList.add('wysiwyg-drop-after');
          }
        });
        el.addEventListener('dragleave',function(){clearDropHints();});
        el.addEventListener('drop',function(e){
          e.preventDefault();e.stopPropagation();
          var fromId=e.dataTransfer.getData('text/plain');
          var toId=el.dataset.wysiwygId;
          clearDropHints();
          if(isDragAncestorOf(el)) return;
          var rect=el.getBoundingClientRect();
          var before=isParentRow(el)?(e.clientX<rect.left+rect.width/2):(e.clientY<rect.top+rect.height/2);
          if(fromId&&fromId!==toId) window.parent.postMessage({type:'reorder',fromId:fromId,toId:toId,before:before},'*');
        });
      }
    });
    // Rich-text editing: double-click opens TipTap overlay in parent
    document.querySelectorAll('[data-wysiwyg-type="rich-text"]').forEach(function(el){
      el.addEventListener('dblclick',function(e){
        e.stopPropagation();
        var rect=el.getBoundingClientRect();
        window.parent.postMessage({type:'richTextEdit',id:el.dataset.wysiwygId,rect:{top:rect.top,left:rect.left,width:rect.width,height:rect.height}},'*');
      });
    });
    // Text editing: double-click to activate, blur to save, Escape to exit
    document.querySelectorAll('[data-wysiwyg-content-id]').forEach(function(el){
      el.addEventListener('dblclick',function(e){
        e.stopPropagation();
        el.setAttribute('contenteditable','true');
        el.focus();
        // Place caret at the clicked position
        if(document.caretRangeFromPoint){
          var r=document.caretRangeFromPoint(e.clientX,e.clientY);
          if(r){var sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);}
        }
      });
      el.addEventListener('focus',function(){activeContentId=el.dataset.wysiwygContentId;});
      el.addEventListener('blur',function(){
        window.parent.postMessage({type:'content',id:el.dataset.wysiwygContentId,html:el.innerHTML},'*');
        el.setAttribute('contenteditable','false');
        activeContentId=null;
      });
      el.addEventListener('keydown',function(e){
        if(e.key==='Escape'){e.preventDefault();el.blur();}
      });
      // While in edit mode, prevent click from bubbling to the select handler
      el.addEventListener('click',function(e){
        if(el.getAttribute('contenteditable')==='true') e.stopPropagation();
      });
    });
  }
  function clearDropHints(){
    document.querySelectorAll('.wysiwyg-drop-before,.wysiwyg-drop-after,.wysiwyg-drop-inside,.wysiwyg-drop-left,.wysiwyg-drop-right').forEach(function(el){
      el.classList.remove('wysiwyg-drop-before','wysiwyg-drop-after','wysiwyg-drop-inside','wysiwyg-drop-left','wysiwyg-drop-right');
    });
  }
  // Delete/Backspace removes the selected block (when not editing text)
  document.addEventListener('keydown',function(e){
    if(e.key!=='Delete'&&e.key!=='Backspace')return;
    var ae=document.activeElement;
    if(ae&&ae.getAttribute('contenteditable')==='true')return;
    if(selectedId) window.parent.postMessage({type:'deleteSelected',id:selectedId},'*');
  });
  // Prevent links and buttons from navigating / submitting in the preview
  document.addEventListener('click',function(e){
    var t=e.target;
    while(t&&t!==document){
      if(t.tagName==='A'||t.tagName==='BUTTON'||t.tagName==='FORM'){e.preventDefault();break;}
      t=t.parentElement;
    }
  },true);
  document.addEventListener('click',function(){window.parent.postMessage({type:'select',id:null},'*');});
  window.addEventListener('message',function(e){
    var msg=e.data;if(!msg||!msg.type)return;
    if(msg.type==='updateTheme'){
      var ts=document.getElementById('wysiwyg-theme-vars');
      if(!ts){ts=document.createElement('style');ts.id='wysiwyg-theme-vars';document.head.appendChild(ts);}
      ts.textContent=msg.css;
    }
    if(msg.type==='select'){
      selectedId=msg.id!=null?msg.id:null;
      document.querySelectorAll('.wysiwyg-selected').forEach(function(el){el.classList.remove('wysiwyg-selected');});
      if(msg.id){var el=document.querySelector('[data-wysiwyg-id="'+msg.id+'"]');if(el){el.classList.add('wysiwyg-selected');el.scrollIntoView({behavior:'smooth',block:'nearest'});}}
    }
    if(msg.type==='updateBlocks'){
      if(activeContentId)return;
      document.getElementById('wysiwyg-root').innerHTML=msg.html;
      bindInteractions();
      // Re-initialise animation triggers for newly inserted DOM nodes
      if(typeof window.__animInitBlocks === 'function') window.__animInitBlocks();
      if(typeof window.__slideshowInitAll === 'function') window.__slideshowInitAll();
      reportHeight();
    }
    if(msg.type==='setContent'){
      var inner=document.querySelector('[data-wysiwyg-content-id="'+msg.id+'"]');
      var target=inner||(document.querySelector('[data-wysiwyg-id="'+msg.id+'"]'));
      if(target&&document.activeElement!==target) target.innerHTML=msg.html;
    }
  });
  new MutationObserver(function(){reportHeight();}).observe(document.body,{childList:true,subtree:true,attributes:false});
  bindInteractions();
  reportHeight();
})();`;
}

// ── Escape helpers ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildThemeStyle(vars: Record<string, string>): string {
  const lines = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n");
  return `:root {\n${lines}\n}`;
}
