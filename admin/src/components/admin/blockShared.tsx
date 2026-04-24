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
};

// ── Default container config ──────────────────────────────────────────────────

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
}: {
  config: Record<string, unknown>;
  setConfig: (key: string, value: unknown) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 320 });

  const place = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const panelW = 340;
    const vw = window.innerWidth;
    let left = r.right - panelW;
    if (left < 8) left = 8;
    if (left + panelW > vw - 8) left = vw - panelW - 8;
    setPos({ top: r.bottom + 6, left, width: panelW });
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
              maxHeight: "calc(100vh - 120px)",
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
              style={{ maxHeight: "calc(100vh - 160px)" }}
            >
              <ContainerBlockEditor config={config} setConfig={setConfig} />
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
}: {
  config: Record<string, unknown>;
  setConfig: (key: string, value: unknown) => void;
}) {
  // Stored as Tailwind units (e.g. 4 = 1rem); shown and entered as pixels
  const toPx = (val: unknown, def: number) => ((val as number) ?? def) * 4;
  const fromPx = (px: number) => Math.max(0, Math.round(px / 4));

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
      <div className="py-3">
        <p className={sLabel}>Background</p>
        <div className="flex items-center border border-(--color-border) rounded bg-(--color-bg) px-2 h-9 gap-2">
          {/* Color swatch — native picker hidden behind a styled div */}
          <div
            className="relative w-5 h-5 rounded shrink-0 overflow-hidden"
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: (c.backgroundColor as string) || undefined,
              backgroundImage: !c.backgroundColor
                ? "linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%)"
                : undefined,
              backgroundSize: "8px 8px",
              backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
            }}
          >
            <input
              type="color"
              value={(c.backgroundColor as string) ?? "#ffffff"}
              onChange={(e) => setConfig("backgroundColor", e.target.value)}
              className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"
            />
          </div>
          {/* Hex text */}
          <input
            type="text"
            value={
              c.backgroundColor
                ? (c.backgroundColor as string).toUpperCase()
                : ""
            }
            placeholder="None"
            onChange={(e) => {
              const v = e.target.value;
              setConfig("backgroundColor", v === "" ? null : v);
            }}
            className="flex-1 min-w-0 bg-transparent border-none text-sm font-mono outline-none"
          />
          {/* Opacity (static) */}
          <div className="border-l border-(--color-border) pl-2 shrink-0">
            <span className="text-sm text-(--color-muted)">100%</span>
          </div>
          {/* Clear */}
          <button
            type="button"
            onClick={() => setConfig("backgroundColor", null)}
            className="text-(--color-muted) hover:text-red-400 transition-colors shrink-0"
            title="Remove background"
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
        </div>
      </div>
    </div>
  );
}

// ── Add-block modal ───────────────────────────────────────────────────────────

export function AddBlockModal({
  onSelect,
  onClose,
}: {
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}) {
  const types = Object.keys(BLOCK_LABELS) as BlockType[];
  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-(--color-bg) rounded-xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-bold mb-4">Add block</h2>
        <div className="grid grid-cols-2 gap-2">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => onSelect(t)}
              className="px-3 py-2 rounded border border-(--color-border) text-sm text-left hover:bg-(--color-bg-surface) transition-colors"
            >
              {BLOCK_LABELS[t]}
            </button>
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
