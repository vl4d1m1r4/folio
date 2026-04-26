import type { ReactNode } from "react";

// ── Shared inspector primitives ───────────────────────────────────────────────
// Reusable sections and components used by TextInspector, ButtonInspector,
// ImageInspector, and any future element inspectors.

// ── Shared style constants ────────────────────────────────────────────────────

export const sLabel =
  "text-[10px] font-semibold uppercase tracking-wider text-(--color-muted) mb-2";

export const btnGroup =
  "flex rounded border border-(--color-border) overflow-hidden divide-x divide-(--color-border)";

export const numInput =
  "flex items-center gap-1.5 border border-(--color-border) rounded bg-(--color-bg) px-2 h-8";

// ── ColorRow ──────────────────────────────────────────────────────────────────

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
                  isActive
                    ? "border-(--color-accent) scale-110"
                    : "border-transparent"
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

// ── TypographySection ─────────────────────────────────────────────────────────
// Font size, weight, alignment, italic, letter-spacing, line-height,
// text-transform, text-decoration.

const WEIGHT_OPTIONS = [
  { value: "normal", label: "Reg" },
  { value: "medium", label: "Med" },
  { value: "semibold", label: "SB" },
  { value: "bold", label: "Bld" },
] as const;

const TEXT_ALIGN_OPTIONS = [
  { value: "left", Icon: AlignLeftIcon },
  { value: "center", Icon: AlignCenterIcon },
  { value: "right", Icon: AlignRightIcon },
  { value: "justify", Icon: AlignJustifyIcon },
] as const;

export function TypographySection({
  config: c,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const decorationOptions: Array<{ v: string; label: ReactNode }> = [
    { v: "none", label: "None" },
    { v: "underline", label: <UnderlineIcon /> },
    { v: "line-through", label: <StrikeIcon /> },
  ];

  return (
    <div className="py-3 space-y-3">
      <p className={sLabel}>Typography</p>

      {/* Font size */}
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">Font Size</p>
        <div className={numInput}>
          <input
            type="number"
            min={8}
            max={200}
            value={(c.fontSize as number) ?? ""}
            placeholder="auto"
            onChange={(e) =>
              onChange(
                "fontSize",
                e.target.value === "" ? null : Number(e.target.value),
              )
            }
            className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
          />
          <span className="text-xs text-(--color-muted) shrink-0">px</span>
        </div>
      </div>

      {/* Font weight */}
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">Font Weight</p>
        <div className={btnGroup}>
          {WEIGHT_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              title={o.label}
              onClick={() => onChange("fontWeight", o.value)}
              className={`flex-1 py-1.5 text-xs transition-colors ${
                (c.fontWeight ?? "normal") === o.value
                  ? "bg-(--color-accent) text-white"
                  : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text align */}
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">Text Align</p>
        <div className={btnGroup}>
          {TEXT_ALIGN_OPTIONS.map(({ value, Icon }) => (
            <button
              key={value}
              type="button"
              title={value}
              onClick={() => onChange("textAlign", value)}
              className={`flex-1 flex items-center justify-center py-2 transition-colors ${
                (c.textAlign ?? "left") === value
                  ? "bg-(--color-accent) text-white"
                  : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
              }`}
            >
              <Icon />
            </button>
          ))}
        </div>
      </div>

      {/* Italic */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!c.italic}
          onChange={(e) => onChange("italic", e.target.checked)}
          className="w-4 h-4 accent-(--color-accent)"
        />
        <span className="text-sm">Italic</span>
      </label>

      {/* Letter spacing + Line height */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-[11px] text-(--color-muted) mb-1.5">
            Letter Spacing
          </p>
          <div className={numInput}>
            <input
              type="number"
              min={-20}
              max={50}
              step={1}
              value={(c.letterSpacing as number) ?? 0}
              onChange={(e) =>
                onChange("letterSpacing", Number(e.target.value))
              }
              className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
            />
            <span className="text-[10px] text-(--color-muted) shrink-0">
              em/100
            </span>
          </div>
        </div>
        <div>
          <p className="text-[11px] text-(--color-muted) mb-1.5">Line Height</p>
          <div className={numInput}>
            <input
              type="number"
              min={0.8}
              max={4}
              step={0.1}
              value={(c.lineHeight as number) ?? ""}
              placeholder="auto"
              onChange={(e) =>
                onChange(
                  "lineHeight",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
            />
          </div>
        </div>
      </div>

      {/* Text transform */}
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">Transform</p>
        <div className={btnGroup}>
          {(
            [
              { v: "none", label: "Ab" },
              { v: "uppercase", label: "AB" },
              { v: "lowercase", label: "ab" },
              { v: "capitalize", label: "Ab+" },
            ] as const
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              title={v}
              onClick={() => onChange("textTransform", v)}
              className={`flex-1 py-1.5 text-xs transition-colors ${
                (c.textTransform ?? "none") === v
                  ? "bg-(--color-accent) text-white"
                  : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Text decoration */}
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">Decoration</p>
        <div className={btnGroup}>
          {decorationOptions.map(({ v, label }) => (
            <button
              key={v}
              type="button"
              title={v}
              onClick={() => onChange("textDecoration", v)}
              className={`flex-1 flex items-center justify-center py-1.5 text-xs transition-colors ${
                (c.textDecoration ?? "none") === v
                  ? "bg-(--color-accent) text-white"
                  : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SpacingSection ────────────────────────────────────────────────────────────
// Padding T/R/B/L and Margin T/R/B/L.
//
// Storage format (matches Container convention where possible):
//   - Multiples of 4px → stored as integer Tailwind unit  (e.g. 16px → 4)
//   - Any other px value → stored as "[Npx]" string       (e.g. 10px → "[10px]")
//
// This lets the renderer apply exact values for arbitrary sizes while staying
// compatible with Tailwind class generation for the Container.

/** Decode a stored spacing value to pixels for display in the input. */
export function spacingToPx(val: unknown): number {
  if (typeof val === "number") return val * 4;
  if (typeof val === "string") {
    const m = val.match(/^\[(\d+(?:\.\d+)?)px\]$/);
    if (m) return parseFloat(m[1]);
  }
  return 0;
}

/** Encode a pixel value back into storage format. */
export function spacingFromPx(px: number): number | string {
  if (px === 0) return 0;
  if (Number.isInteger(px) && px % 4 === 0) return px / 4;
  return `[${px}px]`;
}

export function SpacingSection({
  config: c,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  // Use the module-level encode/decode helpers
  const toPx = spacingToPx;
  const fromPx = spacingFromPx;

  return (
    <div className="py-3 space-y-3">
      <p className={sLabel}>Spacing</p>

      {/* Padding */}
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">
          Inner Spacing (Padding)
        </p>
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
                value={toPx(c[key])}
                onChange={(e) => onChange(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
              <span className="text-xs text-(--color-muted) shrink-0">px</span>
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
                value={toPx(c[key])}
                onChange={(e) => onChange(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
              <span className="text-xs text-(--color-muted) shrink-0">px</span>
            </div>
          ))}
        </div>
      </div>

      {/* Margin */}
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">
          Outer Spacing (Margin)
        </p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          {(["marginTop", "marginBottom"] as const).map((key) => (
            <div key={key} className={numInput}>
              <span className="text-xs text-(--color-muted) shrink-0 w-6">
                {key === "marginTop" ? "Top" : "Btm"}
              </span>
              <input
                type="number"
                min={-96}
                max={384}
                value={toPx(c[key])}
                onChange={(e) => onChange(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
              <span className="text-xs text-(--color-muted) shrink-0">px</span>
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
                min={-96}
                max={384}
                value={toPx(c[key])}
                onChange={(e) => onChange(key, fromPx(Number(e.target.value)))}
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
              <span className="text-xs text-(--color-muted) shrink-0">px</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── SizingSection ─────────────────────────────────────────────────────────────
// Max-width preset selector.

export function SizingSection({
  config: c,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="py-3">
      <p className={sLabel}>Sizing</p>
      <div>
        <p className="text-[11px] text-(--color-muted) mb-1.5">Max Width</p>
        <select
          value={(c.maxWidth as string) ?? ""}
          onChange={(e) => onChange("maxWidth", e.target.value)}
          className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
        >
          <option value="">None (full width)</option>
          <option value="480px">480px — SM</option>
          <option value="640px">640px — MD</option>
          <option value="768px">768px — LG</option>
          <option value="1024px">1024px — XL</option>
          <option value="65ch">65ch — Prose</option>
        </select>
      </div>
    </div>
  );
}

// ── ElementIdSection ──────────────────────────────────────────────────────────
// HTML id attribute for the rendered element (scroll anchors, JS hooks, etc.).

export function ElementIdSection({
  config: c,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="py-3">
      <p className={sLabel}>Element ID</p>
      <p className="text-[11px] text-(--color-muted) mb-1.5">
        HTML <code className="font-mono">id</code> attribute — used for links,
        scroll anchors and JS targeting.
      </p>
      <input
        type="text"
        value={(c.elementId as string) ?? ""}
        onChange={(e) => onChange("elementId", e.target.value)}
        placeholder="e.g. hero-section"
        className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm font-mono bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
        spellCheck={false}
      />
    </div>
  );
}

// ── CustomStyleSection ────────────────────────────────────────────────────────
// Raw inline CSS appended directly to the element's style attribute.

export function CustomStyleSection({
  config: c,
  onChange,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  return (
    <div className="py-3">
      <p className={sLabel}>Custom Style</p>
      <p className="text-[11px] text-(--color-muted) mb-1.5">
        Raw CSS appended to the element's{" "}
        <code className="font-mono">style</code> attribute.
      </p>
      <textarea
        rows={3}
        value={(c.customStyle as string) ?? ""}
        onChange={(e) => onChange("customStyle", e.target.value)}
        placeholder={"border: 2px solid red;\nopacity: 0.9;"}
        spellCheck={false}
        className="w-full px-2 py-1.5 border border-(--color-border) rounded text-xs font-mono bg-(--color-bg) resize-y focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
      />
    </div>
  );
}

// ── Shared icons ──────────────────────────────────────────────────────────────

export function XIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={12}
      height={12}
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
    >
      <path d="M3 3l10 10m0-10L3 13" />
    </svg>
  );
}

export function AlignLeftIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
      <rect x="1" y="3" width="14" height="2" rx="1" />
      <rect x="1" y="7" width="10" height="2" rx="1" />
      <rect x="1" y="11" width="12" height="2" rx="1" />
    </svg>
  );
}

export function AlignCenterIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
      <rect x="1" y="3" width="14" height="2" rx="1" />
      <rect x="3" y="7" width="10" height="2" rx="1" />
      <rect x="2" y="11" width="12" height="2" rx="1" />
    </svg>
  );
}

export function AlignRightIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
      <rect x="1" y="3" width="14" height="2" rx="1" />
      <rect x="5" y="7" width="10" height="2" rx="1" />
      <rect x="3" y="11" width="12" height="2" rx="1" />
    </svg>
  );
}

export function AlignJustifyIcon() {
  return (
    <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor">
      <rect x="1" y="3" width="14" height="2" rx="1" />
      <rect x="1" y="7" width="14" height="2" rx="1" />
      <rect x="1" y="11" width="14" height="2" rx="1" />
    </svg>
  );
}

export function UnderlineIcon() {
  return (
    <svg viewBox="0 0 16 16" width={13} height={13} fill="currentColor">
      <path d="M3 2h1.5v6a3.5 3.5 0 007 0V2H13v6a5 5 0 01-10 0V2zM2 14h12v1.5H2z" />
    </svg>
  );
}

export function StrikeIcon() {
  return (
    <svg viewBox="0 0 16 16" width={13} height={13} fill="currentColor">
      <path d="M1 8h14v1.2H1zm3.1-1.5C4 5.1 5.3 4 7.9 4c1.5 0 2.7.5 3.4 1.2l-1 1C9.7 5.6 9 5.3 7.9 5.3c-1.6 0-2.3.6-2.3 1.4 0 .3.1.5.2.7H4.2a2 2 0 01-.1-.9zM4 10.5h1.6c.4.7 1.1 1.2 2.3 1.2 1.5 0 2.3-.6 2.3-1.5 0-.3-.1-.5-.2-.7H11.7c.1.3.2.5.2.9 0 1.7-1.4 2.6-3.9 2.6-1.8 0-3.1-.7-4-2.5z" />
    </svg>
  );
}
