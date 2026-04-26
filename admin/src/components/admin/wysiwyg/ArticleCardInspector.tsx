import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../../api/client";
import type { BlockType, PaginatedArticles } from "../../../api/types";
import { ContainerBlockEditor } from "../blockShared";
import { BLOCK_LABELS } from "../blockShared";

// Article field types that can live inside an article-card
const ARTICLE_FIELD_TYPES: { type: BlockType; label: string }[] = [
  { type: "article-image", label: "Image" },
  { type: "article-title", label: "Title" },
  { type: "article-excerpt", label: "Excerpt" },
  { type: "article-date", label: "Date" },
  { type: "article-tag", label: "Tag" },
];

interface ArticleCardInspectorProps {
  blockId: string;
  config: Record<string, unknown>;
  children?: Array<{ type: string }>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
  onAddField?: (type: BlockType) => void;
}

export function ArticleCardInspector({
  config: c,
  children,
  onConfigChange,
  themeColors,
  onAddField,
}: ArticleCardInspectorProps) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";

  // Fetch articles for the binding picker
  const { data: articlesData } = useQuery<PaginatedArticles>({
    queryKey: ["admin", "articles", "all"],
    queryFn: () => adminApi.listArticles(1, 100),
    staleTime: 60_000,
  });

  const articles = articlesData?.items ?? [];

  // All slugs present across all translations
  const articleOptions: { slug: string; title: string }[] = [];
  for (const a of articles) {
    for (const t of a.translations) {
      articleOptions.push({
        slug: t.slug,
        title: `${t.title} (${t.lang_code})`,
      });
    }
  }

  const existingFieldTypes = new Set((children ?? []).map((ch) => ch.type));

  return (
    <div>
      {/* ── Header / binding ───────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          {BLOCK_LABELS["article-card"]}
        </span>
        <p className="text-[11px] text-(--color-muted) mt-1">
          When placed inside an <strong>Article Grid</strong> the data comes
          from the grid. When placed standalone, choose an article below.
        </p>
      </div>

      {/* ── Standalone article binding ─────────────────────────────── */}
      <div className="p-3 border-b border-(--color-border)">
        <label className="block text-xs font-medium mb-1">
          Standalone article
        </label>
        <select
          value={(c.articleSlug as string) ?? ""}
          onChange={(e) =>
            onConfigChange("articleSlug", e.target.value || null)
          }
          className={sel}
        >
          <option value="">— None (use grid data) —</option>
          {articleOptions.map((opt) => (
            <option key={opt.slug} value={opt.slug}>
              {opt.title}
            </option>
          ))}
        </select>
      </div>

      {/* ── Article field blocks ──────────────────────────────────── */}
      <div className="p-3 border-b border-(--color-border)">
        <p className="text-xs font-medium mb-2">Article fields</p>
        <div className="grid grid-cols-2 gap-1.5">
          {ARTICLE_FIELD_TYPES.map(({ type, label }) => {
            const exists = existingFieldTypes.has(type);
            return (
              <button
                key={type}
                type="button"
                disabled={!onAddField}
                onClick={() => onAddField?.(type)}
                className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded border transition-colors text-left ${
                  exists
                    ? "border-(--color-border) text-(--color-muted) opacity-60 cursor-default"
                    : "border-dashed border-(--color-border) text-(--color-muted) hover:text-(--color-accent) hover:border-(--color-accent) cursor-pointer"
                }`}
                title={exists ? "Already added" : `Add ${label}`}
              >
                <svg
                  viewBox="0 0 10 10"
                  width={8}
                  height={8}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  {exists ? <path d="M2 5h6" /> : <path d="M5 1v8M1 5h8" />}
                </svg>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Layout (reuse ContainerBlockEditor) ───────────────────── */}
      <div className="px-4 py-2 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Layout
        </span>
      </div>
      <div className="p-3">
        <ContainerBlockEditor
          config={c}
          setConfig={onConfigChange}
          themeColors={themeColors}
        />
      </div>
    </div>
  );
}
