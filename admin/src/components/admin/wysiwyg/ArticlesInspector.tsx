interface ArticlesInspectorProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}

export function ArticlesInspector({
  config: c,
  onConfigChange,
}: ArticlesInspectorProps) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";
  const source = (c.source as string) ?? "latest";

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Article Grid Settings
        </span>
        <p className="text-[11px] text-(--color-muted) mt-1">
          Add an <strong>Article Card</strong> child to define the card layout.
        </p>
      </div>
      <div className="p-3 space-y-3">
        {/* Source */}
        <div>
          <label className="block text-xs font-medium mb-1">
            Article Source
          </label>
          <select
            value={source}
            onChange={(e) => onConfigChange("source", e.target.value)}
            className={sel}
          >
            <option value="latest">Latest articles</option>
            <option value="featured">Featured articles</option>
            <option value="tag">By tag</option>
          </select>
        </div>
        {source === "tag" && (
          <div>
            <label className="block text-xs font-medium mb-1">Tag Filter</label>
            <input
              type="text"
              value={(c.tag_filter as string) ?? ""}
              onChange={(e) => onConfigChange("tag_filter", e.target.value)}
              placeholder="e.g. News"
              className={sel}
            />
          </div>
        )}
        {/* Max count */}
        <div>
          <label className="block text-xs font-medium mb-1">Max articles</label>
          <input
            type="number"
            min={1}
            max={24}
            value={(c.max_count as number) ?? 6}
            onChange={(e) =>
              onConfigChange("max_count", parseInt(e.target.value, 10))
            }
            className={sel}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            checked={!!(c.show_view_all ?? true)}
            onChange={(e) => onConfigChange("show_view_all", e.target.checked)}
            className="w-4 h-4 accent-(--color-accent)"
          />
          Show &ldquo;View all →&rdquo; link
        </label>
        <div>
          {/* Grid columns */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Grid columns
            </label>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onConfigChange("grid_cols", n)}
                  className={`flex-1 py-1 text-xs rounded border transition-colors ${
                    ((c.grid_cols as number) ?? 3) === n
                      ? "bg-(--color-accent) text-white border-(--color-accent)"
                      : "border-(--color-border) text-(--color-muted) hover:text-(--color-text)"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {/* Gap */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Card gap (Tailwind units, 1 = 4px)
            </label>
            <input
              type="number"
              min={0}
              max={16}
              value={(c.gap as number) ?? 6}
              onChange={(e) =>
                onConfigChange("gap", parseInt(e.target.value, 10))
              }
              className={sel}
            />
          </div>
          {/* Padding */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">
                Padding Top
              </label>
              <input
                type="number"
                min={0}
                max={32}
                value={(c.padding_top as number) ?? 10}
                onChange={(e) =>
                  onConfigChange("padding_top", parseInt(e.target.value, 10))
                }
                className={sel}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                Padding Bottom
              </label>
              <input
                type="number"
                min={0}
                max={32}
                value={(c.padding_bottom as number) ?? 10}
                onChange={(e) =>
                  onConfigChange("padding_bottom", parseInt(e.target.value, 10))
                }
                className={sel}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
