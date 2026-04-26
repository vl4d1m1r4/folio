import {
  sLabel,
  ColorRow,
  TypographySection,
  SpacingSection,
  SizingSection,
  ElementIdSection,
  CustomStyleSection,
} from "./InspectorShared";

interface TextInspectorProps {
  config: Record<string, unknown>;
  /** Content for page mode (from config.content) */
  content: string;
  onConfigChange: (key: string, value: unknown) => void;
  onContentChange: (html: string) => void;
  themeColors?: Record<string, string>;
  /** When true, hides the content editing textarea (used by article-bound fields) */
  readOnly?: boolean;
  /** Shown in the header and content section — e.g. "Article Title" */
  binding?: string;
}

const TAG_OPTIONS = [
  { value: "p", label: "Paragraph" },
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "h4", label: "Heading 4" },
  { value: "code", label: "Code" },
];

export function TextInspector({
  config: c,
  content,
  onConfigChange,
  onContentChange,
  themeColors,
  readOnly,
  binding,
}: TextInspectorProps) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface) flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Text Settings
        </span>
        {binding && (
          <span className="shrink-0 flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/20">
            <svg
              viewBox="0 0 12 12"
              width={10}
              height={10}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M6 1v10M1 6h10" />
            </svg>
            {binding}
          </span>
        )}
      </div>

      <div className="p-3 space-y-0 divide-y divide-(--color-border)">
        {/* Element Type */}
        <div className="py-3">
          <p className={sLabel}>Element Type</p>
          <select
            value={(c.tag as string) ?? "p"}
            onChange={(e) => onConfigChange("tag", e.target.value)}
            className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
          >
            {TAG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Typography */}
        <TypographySection config={c} onChange={onConfigChange} />

        {/* Color */}
        <div className="py-3 space-y-3">
          <p className={sLabel}>Color</p>
          <ColorRow
            label="Text Color"
            value={c.color as string | null}
            placeholder="Inherit"
            onChange={(v) => onConfigChange("color", v)}
            themeColors={themeColors}
          />
          <ColorRow
            label="Background"
            value={c.bgColor as string | null}
            placeholder="None"
            onChange={(v) => onConfigChange("bgColor", v)}
            themeColors={themeColors}
          />
        </div>

        {/* Spacing */}
        <SpacingSection config={c} onChange={onConfigChange} />

        {/* Sizing */}
        <SizingSection config={c} onChange={onConfigChange} />

        {/* Content (synced with canvas inline editing) */}
        {readOnly ? (
          <div className="py-3">
            <p className={sLabel}>Content</p>
            <p className="text-[11px] text-(--color-muted) flex items-center gap-1.5">
              <svg
                viewBox="0 0 12 12"
                width={10}
                height={10}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-(--color-accent) shrink-0"
              >
                <path d="M7 2l3 3-6 6H1V8l6-6z" />
              </svg>
              Auto-filled from the article&rsquo;s{" "}
              <strong>{binding ?? "field"}</strong>
            </p>
          </div>
        ) : (
          <div className="py-3">
            <p className={sLabel}>Content</p>
            <p className="text-[11px] text-(--color-muted) mb-2">
              Click text in the canvas to edit inline, or type here.
            </p>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) resize-y focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
              placeholder="Enter text..."
            />
          </div>
        )}

        {/* Element ID */}
        <ElementIdSection config={c} onChange={onConfigChange} />

        {/* Custom Style */}
        <CustomStyleSection config={c} onChange={onConfigChange} />
      </div>
    </div>
  );
}
