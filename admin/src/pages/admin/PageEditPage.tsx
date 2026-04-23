import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type {
  Page,
  PageTranslation,
  PageBlock,
  Language,
} from "../../api/types";
import { PageBlockBuilder } from "../../components/admin/PageBlockBuilder";

function emptyTranslation(langCode: string): PageTranslation {
  return {
    page_id: 0,
    lang_code: langCode,
    slug: "",
    title: "",
    body: "",
    sections: [],
    meta_title: "",
    meta_description: "",
  };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function PageEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: languages = [], isLoading: langsLoading } = useQuery<
    Language[]
  >({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  const { data: existing, isLoading: pageLoading } = useQuery({
    queryKey: ["admin", "page", id],
    queryFn: () => adminApi.getPage(Number(id)),
    enabled: !isNew,
  });

  if (langsLoading || (!isNew && pageLoading)) {
    return <div className="p-6 text-(--color-muted)">Loading…</div>;
  }

  return (
    <PageForm
      key={existing?.id ?? "new"}
      languages={languages}
      existing={existing ?? null}
      isNew={isNew}
      onSaved={() => {
        qc.invalidateQueries({ queryKey: ["admin", "pages"] });
        navigate("/admin/pages");
      }}
      onCancel={() => navigate("/admin/pages")}
    />
  );
}

// ── Page form ─────────────────────────────────────────────────────────────────

function PageForm({
  languages,
  existing,
  isNew,
  onSaved,
  onCancel,
}: {
  languages: Language[];
  existing: Page | null;
  isNew: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [isPublished, setIsPublished] = useState(
    existing?.is_published ?? false,
  );
  const [activeLang, setActiveLang] = useState(
    languages.find((l) => l.default)?.code ?? languages[0]?.code ?? "en",
  );
  const [translations, setTranslations] = useState<
    Record<string, PageTranslation>
  >(() => {
    const init: Record<string, PageTranslation> = {};
    for (const l of languages) {
      init[l.code] =
        existing?.translations.find((t) => t.lang_code === l.code) ??
        emptyTranslation(l.code);
    }
    return init;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: (data: Omit<Page, "id" | "created_at" | "updated_at">) =>
      isNew
        ? adminApi.createPage(data)
        : adminApi.updatePage(Number(existing!.id), data),
    onSuccess: onSaved,
    onError: (e: Error) => setServerError(e.message),
  });

  function updateTranslation(
    lang: string,
    field: keyof PageTranslation,
    value: string | PageBlock[],
  ) {
    setTranslations((prev) => {
      const updated = { ...prev[lang], [field]: value };
      // Auto-update slug from title as long as slug still matches slugify(title)
      if (field === "title") {
        const titleStr = value as string;
        if (
          prev[lang].slug === slugify(prev[lang].title ?? "") ||
          prev[lang].slug === ""
        ) {
          updated.slug = slugify(titleStr);
        }
      }
      return { ...prev, [lang]: updated };
    });
  }

  function validate() {
    const errs: Record<string, string> = {};
    for (const l of languages) {
      const t = translations[l.code];
      if (!t.title) errs[`${l.code}.title`] = "Required";
      if (!t.slug) errs[`${l.code}.slug`] = "Required";
    }
    return errs;
  }

  function handleSave() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      // Switch to the first language that has errors so the user can see them
      const firstErrLang = languages.find((l) =>
        Object.keys(errs).some((k) => k.startsWith(l.code + ".")),
      );
      if (firstErrLang && firstErrLang.code !== activeLang) {
        setActiveLang(firstErrLang.code);
      }
      return;
    }
    saveMutation.mutate({
      is_published: isPublished,
      translations: Object.values(translations),
    });
  }

  const t = translations[activeLang];

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {isNew ? "New page" : "Edit page"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: "var(--color-accent)" }}
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {serverError && (
        <div className="mb-4 p-3 rounded border border-(--color-destructive) text-(--color-destructive) text-sm">
          {serverError}
        </div>
      )}

      {/* Published toggle */}
      <div className="mb-6 flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            className="w-4 h-4 accent-(--color-accent)"
          />
          <span className="text-sm font-medium">Published</span>
        </label>
      </div>

      {/* Language tabs */}
      {languages.length > 1 && (
        <div className="flex gap-1 mb-4 border-b border-(--color-border)">
          {languages.map((l) => {
            const hasErr = Object.keys(errors).some((k) =>
              k.startsWith(l.code + "."),
            );
            return (
              <button
                key={l.code}
                onClick={() => setActiveLang(l.code)}
                className={`relative px-4 py-2 text-sm rounded-t font-medium border-b-2 -mb-px transition-colors ${
                  activeLang === l.code
                    ? "border-(--color-accent) text-(--color-accent)"
                    : "border-transparent text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                {l.label}
                {hasErr && (
                  <span
                    className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full align-middle"
                    style={{ background: "var(--color-destructive)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Translation fields */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={t.title}
            onChange={(e) =>
              updateTranslation(activeLang, "title", e.target.value)
            }
            className="w-full px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
          />
          {errors[`${activeLang}.title`] && (
            <p className="text-(--color-destructive) text-xs mt-1">
              {errors[`${activeLang}.title`]}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Slug</label>
          <input
            type="text"
            value={t.slug}
            onChange={(e) =>
              setTranslations((prev) => ({
                ...prev,
                [activeLang]: {
                  ...prev[activeLang],
                  slug: e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-"),
                },
              }))
            }
            onBlur={(e) =>
              setTranslations((prev) => ({
                ...prev,
                [activeLang]: {
                  ...prev[activeLang],
                  slug: slugify(e.target.value),
                },
              }))
            }
            className="w-full px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
          />
          <p className="text-xs text-(--color-muted) mt-1">
            URL: /{activeLang}/{t.slug}/
          </p>
          {errors[`${activeLang}.slug`] && (
            <p className="text-(--color-destructive) text-xs mt-1">
              {errors[`${activeLang}.slug`]}
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">
            Page Sections
          </label>
          <PageBlockBuilder
            blocks={t.sections ?? []}
            onChange={(blocks) =>
              updateTranslation(activeLang, "sections", blocks)
            }
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Meta title</label>
          <input
            type="text"
            value={t.meta_title}
            onChange={(e) =>
              updateTranslation(activeLang, "meta_title", e.target.value)
            }
            className="w-full px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            Meta description
          </label>
          <textarea
            rows={2}
            value={t.meta_description}
            onChange={(e) =>
              updateTranslation(activeLang, "meta_description", e.target.value)
            }
            className="w-full px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent) resize-none"
          />
        </div>
      </div>
    </div>
  );
}
