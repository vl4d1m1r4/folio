import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { Page, Language } from "../../api/types";

export default function PagesPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });
  const defaultLang =
    languages.find((l) => l.default)?.code ?? languages[0]?.code ?? "en";

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "pages", page],
    queryFn: () => adminApi.listPages(page),
  });
  const pages = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));

  const deleteMutation = useMutation({
    mutationFn: adminApi.deletePage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pages"] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, is_published }: { id: number; is_published: boolean }) =>
      adminApi.updatePage(id, { is_published } as Partial<Page>),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "pages"] }),
  });

  function getTitle(p: Page) {
    return (
      p.translations.find((t) => t.lang_code === defaultLang)?.title ??
      p.translations[0]?.title ??
      "—"
    );
  }
  function getSlug(p: Page) {
    return (
      p.translations.find((t) => t.lang_code === defaultLang)?.slug ??
      p.translations[0]?.slug ??
      "—"
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Pages</h1>
        <Link
          to="/admin/pages/new"
          className="px-4 py-2 text-sm font-medium text-white rounded"
          style={{ background: "var(--color-accent)" }}
        >
          + New page
        </Link>
      </div>

      {isLoading ? (
        <p className="text-(--color-muted)">Loading…</p>
      ) : pages.length === 0 ? (
        <p className="text-(--color-muted)">No pages yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-(--color-border)">
          <table className="min-w-full divide-y divide-(--color-border) text-sm">
            <thead className="bg-(--color-bg-surface)">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-(--color-muted)">Title</th>
                <th className="px-4 py-3 text-left font-medium text-(--color-muted)">Slug</th>
                <th className="px-4 py-3 text-left font-medium text-(--color-muted)">Status</th>
                <th className="px-4 py-3 text-left font-medium text-(--color-muted)">Translations</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border) bg-(--color-bg)">
              {pages.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-medium">{getTitle(p)}</td>
                  <td className="px-4 py-3 text-(--color-muted) font-mono text-xs">{getSlug(p)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        toggleMutation.mutate({ id: p.id, is_published: !p.is_published })
                      }
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        p.is_published
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {p.is_published ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-(--color-muted) text-xs">
                    {p.translations.map((t) => t.lang_code).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      onClick={() => navigate(`/admin/pages/${p.id}`)}
                      className="text-(--color-accent) hover:underline text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete page "${getTitle(p)}"?`))
                          deleteMutation.mutate(p.id);
                      }}
                      className="text-(--color-destructive) hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setPage(n)}
              className={`px-3 py-1 rounded text-sm border ${
                n === page
                  ? "bg-(--color-accent) text-white border-(--color-accent)"
                  : "border-(--color-border) text-(--color-text) hover:bg-(--color-bg-surface)"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
