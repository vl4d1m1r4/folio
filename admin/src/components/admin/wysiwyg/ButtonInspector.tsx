import type { ReactNode } from "react";
import {
  sLabel,
  btnGroup,
  numInput,
  ColorRow,
  SpacingSection,
  ElementIdSection,
  CustomStyleSection,
  AlignLeftIcon,
  AlignCenterIcon,
  AlignRightIcon,
} from "./InspectorShared";

interface ButtonInspectorProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}

const VARIANT_OPTIONS = [
  { value: "filled", label: "Filled" },
  { value: "outline", label: "Outline" },
  { value: "ghost", label: "Ghost" },
] as const;

const SIZE_OPTIONS = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
] as const;

const ALIGN_OPTIONS: Array<{ value: string; icon: ReactNode }> = [
  { value: "left", icon: <AlignLeftIcon /> },
  { value: "center", icon: <AlignCenterIcon /> },
  { value: "right", icon: <AlignRightIcon /> },
];

const WEIGHT_OPTIONS = [
  { value: "normal", label: "Reg" },
  { value: "medium", label: "Med" },
  { value: "semibold", label: "SB" },
  { value: "bold", label: "Bld" },
] as const;

const TARGET_OPTIONS = [
  { value: "_self", label: "Same tab" },
  { value: "_blank", label: "New tab" },
] as const;

export function ButtonInspector({
  config: c,
  onConfigChange,
  themeColors,
}: ButtonInspectorProps) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Button Settings
        </span>
      </div>

      <div className="p-3 space-y-0 divide-y divide-(--color-border)">
        {/* Label */}
        <div className="py-3">
          <p className={sLabel}>Label</p>
          <input
            type="text"
            value={(c.label as string) ?? ""}
            onChange={(e) => onConfigChange("label", e.target.value)}
            placeholder="Button text..."
            className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
          />
        </div>

        {/* Link */}
        <div className="py-3 space-y-2">
          <p className={sLabel}>Link</p>
          <div>
            <p className="text-[11px] text-(--color-muted) mb-1.5">URL</p>
            <input
              type="text"
              value={(c.href as string) ?? ""}
              onChange={(e) => onConfigChange("href", e.target.value)}
              placeholder="https://... or #section"
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
            />
          </div>
          <div>
            <p className="text-[11px] text-(--color-muted) mb-1.5">Target</p>
            <div className={btnGroup}>
              {TARGET_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onConfigChange("target", value)}
                  className={`flex-1 py-1.5 text-xs transition-colors ${
                    (c.target ?? "_self") === value
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

        {/* Style */}
        <div className="py-3 space-y-3">
          <p className={sLabel}>Style</p>

          {/* Variant */}
          <div>
            <p className="text-[11px] text-(--color-muted) mb-1.5">Variant</p>
            <div className={btnGroup}>
              {VARIANT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onConfigChange("variant", value)}
                  className={`flex-1 py-1.5 text-xs transition-colors ${
                    (c.variant ?? "filled") === value
                      ? "bg-(--color-accent) text-white"
                      : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Size */}
          <div>
            <p className="text-[11px] text-(--color-muted) mb-1.5">Size</p>
            <div className={btnGroup}>
              {SIZE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onConfigChange("size", value)}
                  className={`flex-1 py-1.5 text-xs transition-colors ${
                    (c.size ?? "md") === value
                      ? "bg-(--color-accent) text-white"
                      : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Alignment */}
          <div>
            <p className="text-[11px] text-(--color-muted) mb-1.5">Alignment</p>
            <div className={btnGroup}>
              {ALIGN_OPTIONS.map(({ value, icon }) => (
                <button
                  key={value}
                  type="button"
                  title={value}
                  onClick={() => onConfigChange("align", value)}
                  className={`flex-1 flex items-center justify-center py-2 transition-colors ${
                    (c.align ?? "left") === value
                      ? "bg-(--color-accent) text-white"
                      : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Font weight */}
          <div>
            <p className="text-[11px] text-(--color-muted) mb-1.5">
              Font Weight
            </p>
            <div className={btnGroup}>
              {WEIGHT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onConfigChange("fontWeight", value)}
                  className={`flex-1 py-1.5 text-xs transition-colors ${
                    (c.fontWeight ?? "semibold") === value
                      ? "bg-(--color-accent) text-white"
                      : "bg-(--color-bg) text-(--color-muted) hover:bg-(--color-bg-surface)"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Border radius */}
          <div>
            <p className="text-[11px] text-(--color-muted) mb-1.5">
              Border Radius
            </p>
            <div className={numInput}>
              <input
                type="number"
                min={0}
                max={100}
                value={(c.borderRadius as number) ?? 6}
                onChange={(e) =>
                  onConfigChange("borderRadius", Number(e.target.value))
                }
                className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
              />
              <span className="text-xs text-(--color-muted) shrink-0">px</span>
            </div>
          </div>
        </div>

        {/* Colors */}
        <div className="py-3 space-y-3">
          <p className={sLabel}>Colors</p>
          <p className="text-[11px] text-(--color-muted) -mt-1">
            Leave empty to use theme defaults.
          </p>
          <ColorRow
            label="Background / Fill"
            value={c.bgColor as string | null}
            placeholder="Theme accent"
            onChange={(v) => onConfigChange("bgColor", v)}
            themeColors={themeColors}
          />
          <ColorRow
            label="Text Color"
            value={c.textColor as string | null}
            placeholder="Auto"
            onChange={(v) => onConfigChange("textColor", v)}
            themeColors={themeColors}
          />
          <ColorRow
            label="Border Color"
            value={c.borderColor as string | null}
            placeholder="Auto"
            onChange={(v) => onConfigChange("borderColor", v)}
            themeColors={themeColors}
          />
        </div>

        {/* Spacing */}
        <SpacingSection config={c} onChange={onConfigChange} />

        {/* Element ID */}
        <ElementIdSection config={c} onChange={onConfigChange} />

        {/* Custom Style */}
        <CustomStyleSection config={c} onChange={onConfigChange} />
      </div>
    </div>
  );
}
