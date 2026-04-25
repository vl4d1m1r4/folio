/**
 * Converts block data into iframe-ready HTML strings.
 * Pure functions — no React imports.
 */
import type { BlockType } from "../../../api/types";

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

// ── Public API ────────────────────────────────────────────────────────────────

/** Build the full srcdoc HTML for the WYSIWYG iframe. */
export function buildSrcdoc(
  blocks: RenderBlock[],
  themeVars: Record<string, string>,
  activeLang = "en",
  mode: "home" | "page" = "page",
): string {
  const themeStyle = buildThemeStyle(themeVars);
  const blocksHtml = renderBlocksHtml(blocks, activeLang, mode);

  return `<!DOCTYPE html>
<html lang="${esc(activeLang)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    ${themeStyle}
    body { margin: 0; padding: 0; font-family: var(--font-body, system-ui, sans-serif); color: var(--color-text, #111); }
    [data-wysiwyg-id] { position: relative; cursor: pointer; transition: outline 80ms; }
    [data-wysiwyg-id]:hover:not(.wysiwyg-selected) { outline: 1px dashed rgba(59,130,246,0.45); outline-offset: 1px; }
    .wysiwyg-selected { outline: 2px solid #3b82f6 !important; outline-offset: 1px; }
    .wysiwyg-selected > .wysiwyg-label { display: flex; }
    .wysiwyg-label { display: none; position: absolute; top: -22px; left: -2px; background: #3b82f6; color: #fff; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 4px 4px 0 0; white-space: nowrap; z-index: 9; pointer-events: none; align-items: center; gap: 4px; }
    .wysiwyg-drop-before { border-top: 3px solid #3b82f6 !important; }
    .wysiwyg-drop-after  { border-bottom: 3px solid #3b82f6 !important; }
    .wysiwyg-drop-inside { outline: 2px dashed #3b82f6 !important; background: rgba(59,130,246,0.04) !important; }
    [contenteditable=true] { outline: none; cursor: text; }
    [contenteditable=true]:focus { outline: 2px solid #3b82f6; outline-offset: 1px; }
    [contenteditable=true]:empty::before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }
    .block-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80px; border: 2px dashed #d1d5db; border-radius: 8px; gap: 8px; padding: 20px; background: #f9fafb; color: #6b7280; font-size: 13px; text-align: center; }
    .block-placeholder .bp-label { font-weight: 600; color: #374151; font-size: 12px; letter-spacing: 0.03em; text-transform: uppercase; }
    .prose p { margin-bottom: .875em; line-height: 1.75; }
    .prose h1,.prose h2,.prose h3,.prose h4 { font-weight: 700; line-height: 1.25; margin-bottom: .5em; margin-top: 1em; }
    .prose h1 { font-size: 2em; } .prose h2 { font-size: 1.5em; } .prose h3 { font-size: 1.25em; }
    .prose ul,.prose ol { padding-left: 1.5em; margin-bottom: .875em; }
    .prose li { margin-bottom: .25em; }
    .prose blockquote { border-left: 4px solid #e5e7eb; padding-left: 1em; color: #6b7280; font-style: italic; margin: 1em 0; }
    .prose code { background: #f3f4f6; padding: .1em .3em; border-radius: 4px; font-size: .875em; }
    .prose pre { background: #1f2937; color: #f9fafb; padding: 1em; border-radius: 8px; overflow-x: auto; }
    .prose a { color: var(--color-accent, #3b82f6); text-decoration: underline; }
    a:not([data-wysiwyg-id]), button:not([data-wysiwyg-id]) { pointer-events: none; }
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
  mode: "home" | "page" = "page",
): string {
  return [...blocks]
    .filter((b) => b.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((b) => blockToHtml(b, activeLang, mode))
    .join("\n");
}

// ── Block renderers ───────────────────────────────────────────────────────────

function blockToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
): string {
  if (block.visible === false) return "";
  switch (block.type) {
    case "container":
      return containerToHtml(block, activeLang, mode);
    case "text":
      return textToHtml(block, activeLang, mode);
    case "image":
      return imageToHtml(block);
    case "button":
      return buttonToHtml(block);
    default:
      return templatePlaceholderHtml(block);
  }
}

// ── Container ─────────────────────────────────────────────────────────────────

function containerToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
): string {
  const c = block.config;
  const baseCls = containerClassNames(c);
  const extraCls = containerExtraClasses(c);
  const cls = extraCls ? `${baseCls} ${extraCls}` : baseCls;
  const customStyle = (c.customStyle as string) || "";
  const styleAttr = customStyle ? ` style="${escAttr(customStyle)}"` : "";
  const label = `<span class="wysiwyg-label">▣ Container</span>`;

  const hasOverlay = !!(c.backgroundOverlay && c.backgroundImage);
  let inner = [...(block.children ?? [])]
    .filter((ch) => ch.visible !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((ch) => blockToHtml(ch, activeLang, mode))
    .join("\n");

  if (inner === "") {
    inner = `<div style="min-height:40px;width:100%;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:12px;pointer-events:none;">Drop blocks here</div>`;
  }

  if (hasOverlay) {
    const overlayColor = c.backgroundOverlay as string;
    const bgImg = c.backgroundImage as string;
    const bgSize = (c.backgroundSize as string) ?? "cover";
    const bgPos = (c.backgroundPosition as string) ?? "center";
    const overlayStyle = [
      `background-image:url('${escAttr(bgImg)}')`,
      `background-size:${bgSize}`,
      `background-position:${bgPos}`,
      ...(customStyle ? [customStyle] : []),
    ].join(";");
    return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="container" class="${escAttr(cls)}" style="${escAttr(overlayStyle)}">
${label}
  <div style="position:absolute;inset:0;background:${escAttr(overlayColor)};pointer-events:none;"></div>
  <div style="position:relative;z-index:1;width:100%;display:flex;flex-direction:inherit;flex-wrap:inherit;justify-content:inherit;align-items:inherit;gap:inherit;">${inner}</div>
</div>`;
  }

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="container" class="${escAttr(cls)}"${styleAttr}>${label}${inner}</div>`;
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
    cls.push("max-w-5xl");
    cls.push("mx-auto");
  } else if (w === "w-auto") cls.push("w-auto");
  else if (w === "w-screen") cls.push("w-screen");
  else cls.push("w-full");

  const h = (c.height as string) ?? "h-auto";
  if (h === "h-full") cls.push("h-full");
  else if (h === "h-screen") cls.push("h-screen");

  return cls.join(" ");
}

function containerExtraClasses(c: Record<string, unknown>): string {
  const cls: string[] = [];
  if (c.backgroundColor) cls.push(`bg-[${c.backgroundColor}]`);
  if (c.backgroundImage && !c.backgroundOverlay) {
    cls.push(`bg-[url('${c.backgroundImage}')]`);
    const bgSize = (c.backgroundSize as string) ?? "cover";
    if (bgSize === "cover") cls.push("bg-cover");
    else if (bgSize === "contain") cls.push("bg-contain");
    else if (bgSize === "auto") cls.push("bg-auto");
    else cls.push(`bg-[size:${bgSize}]`);
    const bgPos = (c.backgroundPosition as string) ?? "center";
    if (bgPos === "center") cls.push("bg-center");
    else if (bgPos === "top") cls.push("bg-top");
    else if (bgPos === "bottom") cls.push("bg-bottom");
    else if (bgPos === "left") cls.push("bg-left");
    else if (bgPos === "right") cls.push("bg-right");
    else cls.push(`bg-[position:${bgPos}]`);
    cls.push("bg-no-repeat");
  }
  if (c.borderRadius && (c.borderRadius as number) > 0)
    cls.push(`rounded-[${c.borderRadius}px]`);
  if (c.textColor) cls.push(`text-[${c.textColor}]`);
  return cls.join(" ");
}

// ── Text ──────────────────────────────────────────────────────────────────────

function textToHtml(
  block: RenderBlock,
  activeLang: string,
  mode: "home" | "page",
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
  const fontSize = (c.fontSize as number) || 16;
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

  cls.push(`text-[${fontSize}px]`);

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
  if (color) cls.push(`text-[${color}]`);
  if (letterSpacing) cls.push(`tracking-[${letterSpacing / 100}em]`);
  if (lineHeight) cls.push(`leading-[${lineHeight}]`);

  const twTransform: Record<string, string> = {
    uppercase: "uppercase",
    lowercase: "lowercase",
    capitalize: "capitalize",
  };
  if (textTransform && textTransform !== "none")
    cls.push(twTransform[textTransform] ?? "");

  if (textDecoration === "underline") cls.push("underline");
  else if (textDecoration === "line-through") cls.push("line-through");

  if (bgColor) cls.push(`bg-[${bgColor}]`);

  // Always set all 4 padding/margin sides to prevent browser default margins
  cls.push(spClass(c.paddingTop, "pt"));
  cls.push(spClass(c.paddingBottom, "pb"));
  cls.push(spClass(c.paddingLeft, "pl"));
  cls.push(spClass(c.paddingRight, "pr"));
  cls.push(spClass(c.marginTop, "mt"));
  cls.push(spClass(c.marginBottom, "mb"));
  cls.push(spClass(c.marginLeft, "ml"));
  cls.push(spClass(c.marginRight, "mr"));

  if (maxWidth) cls.push(`max-w-[${maxWidth}]`);

  const classAttr = cls.filter(Boolean).join(" ");
  const styleAttr = customStyle ? ` style="${escAttr(customStyle)}"` : "";
  const idAttr = elementId ? ` id="${escAttr(elementId)}"` : "";

  const placeholder =
    safeTag === "p"
      ? "Click to edit text…"
      : `Click to edit ${safeTag.toUpperCase()}…`;
  const labelText = safeTag === "p" ? "T Text" : `T ${safeTag.toUpperCase()}`;

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="text" style="position:relative"><span class="wysiwyg-label">${escHtml(labelText)}</span><${safeTag}${idAttr} contenteditable="true" data-wysiwyg-content-id="${escAttr(block.id)}" data-placeholder="${escAttr(placeholder)}" class="${escAttr(classAttr)}"${styleAttr}>${content}</${safeTag}></div>`;
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
    `rounded-[${borderRadius}px]`,
    "cursor-pointer",
    "no-underline",
    "leading-[1.25]",
    "transition-opacity",
    "duration-150",
    "border-2",
    "border-solid",
  ];

  const accent = "var(--color-accent,#3b82f6)";
  if (variant === "filled") {
    btnCls.push(`bg-[${bgColor ?? accent}]`);
    btnCls.push(`text-[${textColor ?? "#fff"}]`);
    btnCls.push("border-transparent");
  } else if (variant === "outline") {
    btnCls.push("bg-transparent");
    btnCls.push(`text-[${textColor ?? bgColor ?? accent}]`);
    btnCls.push(`border-[${borderColor ?? bgColor ?? accent}]`);
  } else {
    // ghost
    btnCls.push("bg-transparent");
    btnCls.push(`text-[${textColor ?? bgColor ?? accent}]`);
    btnCls.push("border-transparent");
  }

  const btnStyleAttr = btnCustomStyle
    ? ` style="${escAttr(btnCustomStyle)}"`
    : "";
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

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="button" class="${escAttr(wrapCls.join(" "))}"><span class="wysiwyg-label">⬤ Button</span><a${btnIdAttr} href="${escAttr(href)}" target="${escAttr(target)}" class="${escAttr(btnCls.join(" "))}"${btnStyleAttr}>${escHtml(label)}</a></div>`;
}

// ── Image ─────────────────────────────────────────────────────────────────────

function imageToHtml(block: RenderBlock): string {
  const c = block.config;
  const src = (c.src as string) || "";
  const alt = escAttr((c.alt as string) || "");
  const objectFit = (c.objectFit as string) || "cover";
  const borderRadius = (c.borderRadius as number) || 0;
  const width = (c.width as string) || "w-full";
  const imgElementId = (c.elementId as string) || "";
  const imgCustomStyle = (c.customStyle as string) || "";

  // objectFit → Tailwind class
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
  const wrapCls: string[] = ["relative", width];
  wrapCls.push(spClass(c.paddingTop, "pt"));
  wrapCls.push(spClass(c.paddingBottom, "pb"));
  wrapCls.push(spClass(c.paddingLeft, "pl"));
  wrapCls.push(spClass(c.paddingRight, "pr"));
  wrapCls.push(spClass(c.marginTop, "mt"));
  wrapCls.push(spClass(c.marginBottom, "mb"));
  wrapCls.push(spClass(c.marginLeft, "ml"));
  wrapCls.push(spClass(c.marginRight, "mr"));

  if (!src) {
    return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="image" class="block-placeholder ${escAttr(wrapCls.join(" "))}"><span class="wysiwyg-label">⬛ Image</span><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg><span>Select an image in the inspector</span></div>`;
  }

  return `<div data-wysiwyg-id="${escAttr(block.id)}" data-wysiwyg-type="image" class="${escAttr(wrapCls.join(" "))}"><span class="wysiwyg-label">⬛ Image</span><img${imgIdAttr} src="${escAttr(src)}" alt="${alt}" class="${escAttr(imgCls.join(" "))}"${imgStyleAttr} /></div>`;
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

// ── Interaction script ────────────────────────────────────────────────────────

function buildInteractionScript(): string {
  return `(function(){
  var activeContentId=null,dragFromId=null,selectedId=null;
  var EDGE=10;
  function reportHeight(){
    var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight,400);
    window.parent.postMessage({type:'height',value:h},'*');
  }
  function bindInteractions(){
    document.querySelectorAll('[data-wysiwyg-id]').forEach(function(el){
      el.addEventListener('click',function(e){
        e.stopPropagation();
        window.parent.postMessage({type:'select',id:el.dataset.wysiwygId},'*');
      });
      // Edge-detection drag: text blocks only drag from edges; all others always draggable
      el.removeAttribute('draggable');
      var isText=el.dataset.wysiwygType==='text';
      el.addEventListener('mousedown',function(e){
        var rect=el.getBoundingClientRect();
        var onEdge=(e.clientX-rect.left<EDGE)||(rect.right-e.clientX<EDGE)||(e.clientY-rect.top<EDGE)||(rect.bottom-e.clientY<EDGE);
        if(!isText||onEdge) el.setAttribute('draggable','true');
      });
      el.addEventListener('mouseup',function(){el.removeAttribute('draggable');});
      el.addEventListener('dragstart',function(e){
        if(!el.getAttribute('draggable')){e.preventDefault();return;}
        dragFromId=el.dataset.wysiwygId;
        e.dataTransfer.effectAllowed='move';
        e.dataTransfer.setData('text/plain',el.dataset.wysiwygId);
        e.stopPropagation();
      });
      el.addEventListener('dragend',function(){el.removeAttribute('draggable');clearDropHints();});
      // Drop targets: containers accept inside-drops; others accept before/after reorder
      var isContainer=el.dataset.wysiwygType==='container';
      if(isContainer){
        el.addEventListener('dragover',function(e){
          e.preventDefault();e.stopPropagation();
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
          if(fromId&&fromId!==toId) window.parent.postMessage({type:'moveToContainer',fromId:fromId,containerId:toId},'*');
        });
      } else {
        el.addEventListener('dragover',function(e){
          e.preventDefault();e.stopPropagation();
          clearDropHints();
          var rect=el.getBoundingClientRect();
          if(e.clientY<rect.top+rect.height/2) el.classList.add('wysiwyg-drop-before');
          else el.classList.add('wysiwyg-drop-after');
        });
        el.addEventListener('dragleave',function(){clearDropHints();});
        el.addEventListener('drop',function(e){
          e.preventDefault();e.stopPropagation();
          var fromId=e.dataTransfer.getData('text/plain');
          var toId=el.dataset.wysiwygId;
          clearDropHints();
          if(fromId&&fromId!==toId) window.parent.postMessage({type:'reorder',fromId:fromId,toId:toId},'*');
        });
      }
    });
    // Content-editable interactions (text editing via inner contenteditable elements)
    document.querySelectorAll('[data-wysiwyg-content-id]').forEach(function(el){
      el.addEventListener('focus',function(){activeContentId=el.dataset.wysiwygContentId;});
      el.addEventListener('blur',function(){
        window.parent.postMessage({type:'content',id:el.dataset.wysiwygContentId,html:el.innerHTML},'*');
        activeContentId=null;
      });
    });
  }
  function clearDropHints(){
    document.querySelectorAll('.wysiwyg-drop-before,.wysiwyg-drop-after,.wysiwyg-drop-inside').forEach(function(el){
      el.classList.remove('wysiwyg-drop-before','wysiwyg-drop-after','wysiwyg-drop-inside');
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
    if(msg.type==='select'){
      selectedId=msg.id!=null?msg.id:null;
      document.querySelectorAll('.wysiwyg-selected').forEach(function(el){el.classList.remove('wysiwyg-selected');});
      if(msg.id){var el=document.querySelector('[data-wysiwyg-id="'+msg.id+'"]');if(el){el.classList.add('wysiwyg-selected');el.scrollIntoView({behavior:'smooth',block:'nearest'});}}
    }
    if(msg.type==='updateBlocks'){
      if(activeContentId)return;
      document.getElementById('wysiwyg-root').innerHTML=msg.html;
      bindInteractions();
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
