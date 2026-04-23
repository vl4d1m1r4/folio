import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { adminApi } from "../../api/client";
import type { Article } from "../../api/types";

const ch = createColumnHelper<Article>();

export default function ArticlesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [rebuildWarning, setRebuildWarning] = useState<string | null>(
    (location.state as { rebuildWarning?: string } | null)?.rebuildWarning ??
      null,
  );
  const [rebuildStatus, setRebuildStatus] = useState<
    "idle" | "pending" | "ok" | "error"
  >("idle");

  // Fetch configured languages so we can show the default lang title/slug
  const { data: languages = [] } = useQuery({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });
  const defaultLang =
    languages.find((l) => l.default)?.code ?? languages[0]?.code ?? "en";

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "articles", page],
    queryFn: () => adminApi.listArticles(page),
  });
  const articles = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteArticle,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "articles"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({
      id,
      published_at,
    }: {
      id: number;
      published_at: string | null;
    }) => adminApi.updateArticle(id, { published_at } as Partial<Article>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "articles"] }),
  });

  function getDefaultTranslation(a: Article) {
    return (
      a.translations.find((t) => t.lang_code === defaultLang) ??
      a.translations[0]
    );
  }

  const columns = [
    ch.display({
      id: "title",
      header: "Title",
      cell: ({ row }) => {
        const t = getDefaultTranslation(row.original);
        return <span className="font-medium">{t?.title ?? "—"}</span>;
      },
    }),
    ch.display({
      id: "slug",
      header: "Slug",
      cell: ({ row }) => {
        const t = getDefaultTranslation(row.original);
        const otherSlugs = row.original.translations
          .filter((t2) => t2.lang_code !== defaultLang)
          .map((t2) => `${t2.lang_code}: ${t2.slug}`)
          .join("\n");
        return (
          <span
            title={otherSlugs || undefined}
            className="text-gray-500 text-xs font-mono"
          >
            {t?.slug ?? "—"}
          </span>
        );
      },
    }),
    ch.accessor("published_at", {
      header: "Status",
      cell: (info) => {
        const id = info.row.original.id;
        const val = info.getValue();
        return (
          <button
            onClick={() =>
              toggleMutation.mutate({
                id,
                published_at: val ? null : new Date().toISOString(),
              })
            }
            title={val ? "Click to unpublish" : "Click to publish"}
            className={`text-xs px-2 py-1 rounded cursor-pointer select-none transition-colors ${
              val
                ? "bg-green-100 text-green-700 hover:bg-green-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {val ? "● Live" : "○ Draft"}
          </button>
        );
      },
    }),
    ch.accessor("published_at", {
      id: "published_date",
      header: "Published At",
      cell: (info) =>
        info.getValue() ? new Date(info.getValue()!).toLocaleDateString() : "—",
    }),
    ch.display({
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-3">
          <button
            className="text-blue-600 hover:text-blue-800 text-sm"
            onClick={() => navigate(`/admin/articles/${row.original.id}`)}
          >
            Edit
          </button>
          <button
            className="text-red-600 hover:text-red-800 text-sm"
            onClick={() => {
              if (confirm(`Delete this article?`))
                deleteMutation.mutate(row.original.id);
            }}
          >
            Delete
          </button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: articles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div>
      {rebuildWarning && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-300 text-amber-800 rounded-lg px-4 py-3 text-sm">
          <span className="text-lg leading-none">⚠</span>
          <div className="flex-1">
            <p className="font-semibold">
              Article saved, but site regeneration failed
            </p>
            <p className="text-xs mt-0.5 text-amber-700">{rebuildWarning}</p>
          </div>
          <button
            onClick={() => setRebuildWarning(null)}
            className="text-amber-500 hover:text-amber-700 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Articles</h1>
        <div className="flex gap-3 items-center">
          {rebuildStatus === "ok" && (
            <span className="text-xs text-green-700 font-medium">
              ✓ Site rebuilt
            </span>
          )}
          {rebuildStatus === "error" && (
            <span className="text-xs text-red-600 font-medium">
              ✗ Rebuild failed
            </span>
          )}
          <button
            onClick={async () => {
              setRebuildStatus("pending");
              try {
                await adminApi.triggerRebuild();
                setRebuildStatus("ok");
              } catch {
                setRebuildStatus("error");
              }
            }}
            disabled={rebuildStatus === "pending"}
            className="px-4 py-2 border rounded text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            {rebuildStatus === "pending" ? "Rebuilding…" : "↺ Regenerate Site"}
          </button>
          <button
            onClick={() => navigate("/admin/articles/new")}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + New
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  No articles yet. Click "+ New" to create one.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3 text-sm text-gray-700"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
