import { TextInspector } from "./TextInspector";
import { SpacingSection, sLabel } from "./InspectorShared";

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

const BINDING_LABEL: Record<ArticleFieldType, string> = {
  "article-image": "Cover Image",
  "article-title": "Title",
  "article-excerpt": "Excerpt",
  "article-date": "Publish Date",
  "article-tag": "Tag",
};

export function ArticleFieldInspector({
  type,
  config: c,
  onConfigChange,
  themeColors,
}: ArticleFieldInspectorProps) {
  const binding = BINDING_LABEL[type];

  if (type === "article-image") {
    return (
      <ArticleImageSettings
        binding={binding}
        config={c}
        onConfigChange={onConfigChange}
      />
    );
  }

  // All other article field types extend TextInspector
  return (
    <>
      <TextInspector
        config={c}
        content=""
        onConfigChange={onConfigChange}
        onContentChange={() => {}}
        themeColors={themeColors}
        readOnly
        binding={binding}
      />
      {type === "article-excerpt" && (
        <ExcerptExtras config={c} onConfigChange={onConfigChange} />
      )}
    </>
  );
}

// ── Article image: aspect ratio + object fit + border radius (no src picker) ──

function ArticleImageSettings({
  binding,
  config: c,
  onConfigChange,
}: {
  binding: string;
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface) flex items-start justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Image Settings
        </span>
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
      </div>
      <div className="p-3 divide-y divide-(--color-border)">
        <div className="py-3">
          <p className={sLabel}>Aspect Ratio</p>
          <select
            value={(c.aspectRatio as string) ?? "16/9"}
            onChange={(e) => onConfigChange("aspectRatio", e.target.value)}
            className={sel}
          >
            <option value="16/9">16:9 — Widescreen</option>
            <option value="4/3">4:3 — Classic</option>
            <option value="3/2">3:2 — Photo</option>
            <option value="1/1">1:1 — Square</option>
          </select>
        </div>
        <div className="py-3">
          <p className={sLabel}>Object Fit</p>
          <select
            value={(c.objectFit as string) ?? "cover"}
            onChange={(e) => onConfigChange("objectFit", e.target.value)}
            className={sel}
          >
            <option value="cover">Cover</option>
            <option value="contain">Contain</option>
            <option value="fill">Fill</option>
          </select>
        </div>
        <div className="py-3">
          <p className={sLabel}>Border Radius (px)</p>
          <input
            type="number"
            min={0}
            max={64}
            value={(c.borderRadius as number) ?? 0}
            onChange={(e) =>
              onConfigChange("borderRadius", parseInt(e.target.value, 10))
            }
            className={sel}
          />
        </div>
        <SpacingSection config={c} onChange={onConfigChange} />
      </div>
    </div>
  );
}

// ── Excerpt extras: line clamp ────────────────────────────────────────────────

function ExcerptExtras({
  config: c,
  onConfigChange,
}: {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";
  return (
    <div className="border-t border-(--color-border) p-3">
      <div className="py-1">
        <p className={sLabel}>Line Clamp</p>
        <select
          value={(c.lineClamp as number) ?? 3}
          onChange={(e) =>
            onConfigChange("lineClamp", parseInt(e.target.value, 10))
          }
          className={sel}
        >
          <option value="2">2 lines</option>
          <option value="3">3 lines</option>
          <option value="4">4 lines</option>
          <option value="5">5 lines</option>
          <option value="0">No limit</option>
        </select>
      </div>
    </div>
  );
}
