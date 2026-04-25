import { useState } from "react";
import { MediaPickerModal } from "../MediaPickerModal";
import {
  SpacingSection,
  ElementIdSection,
  CustomStyleSection,
} from "./InspectorShared";

interface ImageInspectorProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}

const sLabel =
  "text-[10px] font-semibold uppercase tracking-wider text-(--color-muted) mb-2";
const numInput =
  "flex items-center gap-1.5 border border-(--color-border) rounded bg-(--color-bg) px-2 h-8";

export function ImageInspector({
  config: c,
  onConfigChange,
}: ImageInspectorProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Image Settings
        </span>
      </div>

      <div className="p-3 divide-y divide-(--color-border)">
        {/* Source */}
        <div className="py-3">
          <p className={sLabel}>Image</p>
          {(c.src as string) && (
            <img
              src={c.src as string}
              alt=""
              className="w-full rounded border border-(--color-border) mb-2 object-cover"
              style={{ maxHeight: 120 }}
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex-1 px-3 py-1.5 text-xs border border-(--color-border) rounded hover:bg-(--color-bg-surface) transition-colors"
            >
              {c.src ? "Change image" : "Pick from library"}
            </button>
            {!!c.src && (
              <button
                type="button"
                onClick={() => onConfigChange("src", null)}
                className="px-2 py-1.5 text-xs text-(--color-destructive) border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Alt text */}
        <div className="py-3">
          <p className={sLabel}>Alt Text</p>
          <input
            type="text"
            value={(c.alt as string) ?? ""}
            onChange={(e) => onConfigChange("alt", e.target.value)}
            placeholder="Describe the image…"
            className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
          />
        </div>

        {/* Width */}
        <div className="py-3">
          <p className={sLabel}>Width</p>
          <select
            value={(c.width as string) ?? "w-full"}
            onChange={(e) => onConfigChange("width", e.target.value)}
            className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
          >
            <option value="w-full">Fill (100%)</option>
            <option value="w-1/2">Half (50%)</option>
            <option value="w-1/3">Third (33%)</option>
            <option value="w-auto">Auto</option>
          </select>
        </div>

        {/* Object fit */}
        <div className="py-3">
          <p className={sLabel}>Object Fit</p>
          <select
            value={(c.objectFit as string) ?? "cover"}
            onChange={(e) => onConfigChange("objectFit", e.target.value)}
            className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
            <option value="none">None</option>
          </select>
        </div>

        {/* Border radius */}
        <div className="py-3">
          <p className={sLabel}>Border Radius</p>
          <div className={numInput}>
            <input
              type="number"
              min={0}
              max={200}
              value={(c.borderRadius as number) ?? 0}
              onChange={(e) =>
                onConfigChange("borderRadius", Number(e.target.value))
              }
              className="flex-1 min-w-0 bg-transparent border-none text-sm outline-none"
            />
            <span className="text-xs text-(--color-muted) shrink-0">px</span>
          </div>
        </div>

        {/* Spacing */}
        <SpacingSection config={c} onChange={onConfigChange} />

        {/* Element ID */}
        <ElementIdSection config={c} onChange={onConfigChange} />

        {/* Custom Style */}
        <CustomStyleSection config={c} onChange={onConfigChange} />
      </div>

      {pickerOpen && (
        <MediaPickerModal
          mode="image"
          onSelect={(file) => {
            onConfigChange("src", `/uploads/${file.filename}`);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
