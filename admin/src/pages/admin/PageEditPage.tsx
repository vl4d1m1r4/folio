import { useState, useEffect, type ReactNode } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type {
  Page,
  PageTranslation,
  PageBlock,
  Language,
} from "../../api/types";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";

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
      key={existing?.updated_at ?? existing?.id ?? "new"}
      languages={languages}
      existing={existing ?? null}
      isNew={isNew}
      onSaved={() => {
        qc.invalidateQueries({ queryKey: ["admin", "pages"] });
        qc.invalidateQueries({ queryKey: ["admin", "page", id] });
        navigate("/admin/pages");
      }}
      onCancel={() => navigate("/admin/pages")}
    />
  );
}

// ── Page form ──────────────────────────────────────────────────────────────────

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
  const [saved, setSaved] = useState(false);
  const [themeVars, setThemeVars] = useState<Record<string, string>>({});

  const { data: settings } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  // Derive CSS custom properties for the iframe canvas from the active theme
  useEffect(() => {
    const theme = settings?.theme;
    if (!theme?.colors) return;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(theme.colors)) {
      vars[`--color-${k}`] = v as string;
    }
    if (theme.fonts?.body) vars["--font-body"] = theme.fonts.body;
    if (theme.fonts?.fallback) vars["--font-fallback"] = theme.fonts.fallback;
    setThemeVars(vars);
  }, [settings]);

  const siteUrl = (settings?.site?.url ?? "").replace(/\/$/, "");

  const saveMutation = useMutation({
    mutationFn: (data: Omit<Page, "id" | "created_at" | "updated_at">) =>
      isNew
        ? adminApi.createPage(data)
        : adminApi.updatePage(Number(existing!.id), data),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved();
    },
    onError: (e: Error) => setServerError(e.message),
  });

  function updateTranslationField(
    lang: string,
    field: keyof PageTranslation,
    value: string,
  ) {
    setTranslations((prev) => {
      const updated = { ...prev[lang], [field]: value };
      if (field === "title") {
        const t = prev[lang];
        if (t.slug === slugify(t.title ?? "") || t.slug === "") {
          updated.slug = slugify(value);
        }
      }
      return { ...prev, [lang]: updated };
    });
    setErrors((prev) => {
      const next = { ...prev };
      delete next[`${lang}.${field}`];
      return next;
    });
  }

  function updateSections(sections: PageBlock[]) {
    setTranslations((prev) => ({
      ...prev,
      [activeLang]: { ...prev[activeLang], sections },
    }));
  }

  function handleCopyBlocksFrom(fromLang: string) {
    const src = translations[fromLang];
    if (!src) return;
    // Deep-clone via JSON to avoid shared references
    const clonedSections = JSON.parse(
      JSON.stringify(src.sections ?? []),
    ) as PageBlock[];
    setTranslations((prev) => ({
      ...prev,
      [activeLang]: {
        ...prev[activeLang],
        sections: clonedSections,
        slug: src.slug,
        title: src.title,
        meta_title: src.meta_title,
        meta_description: src.meta_description,
      },
    }));
  }

  function validate() {
    const errs: Record<string, string> = {};
    const defaultLang =
      languages.find((l) => l.default)?.code ?? languages[0]?.code;
    if (defaultLang) {
      const t = translations[defaultLang];
      if (!t.title) errs[`${defaultLang}.title`] = "Required";
      if (!t.slug) errs[`${defaultLang}.slug`] = "Required";
    }
    return errs;
  }

  function handleSave() {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      return;
    }
    saveMutation.mutate({
      is_published: isPublished,
      translations: Object.values(translations),
    });
  }

  const t = translations[activeLang];
  const previewUrl =
    !isNew && t.slug && siteUrl ? `${siteUrl}/${activeLang}/${t.slug}/` : "";

  // ── Page-tab metadata node rendered inside the left sidebar ─────────────────
  const pageSettingsNode: ReactNode = (
    <div className="space-y-4 p-1">
      {/* Back */}
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-(--color-muted) hover:text-(--color-text)"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" width={14} height={14}>
          <path
            fillRule="evenodd"
            d="M17 10a.75.75 0 0 1-.75.75H5.56l3.22 3.22a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 1.06L5.56 9.25H16.25A.75.75 0 0 1 17 10Z"
            clipRule="evenodd"
          />
        </svg>
        Back to pages
      </button>

      <div className="border-t border-(--color-border)" />

      {/* Published toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="w-4 h-4 accent-(--color-accent)"
        />
        <span className="text-sm font-medium">Published</span>
      </label>

      {/* Language selector (multi-lang only) */}
      {languages.length > 1 && (
        <p className="text-xs text-(--color-muted)">
          Switch language using the selector at the top of the panel.
        </p>
      )}

      {/* Title */}
      <div>
        <label className="block text-xs font-medium mb-1">
          Title <span className="text-(--color-destructive)">*</span>
        </label>
        <input
          type="text"
          value={t.title}
          onChange={(e) =>
            updateTranslationField(activeLang, "title", e.target.value)
          }
          className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
        />
        {errors[`${activeLang}.title`] && (
          <p className="text-(--color-destructive) text-xs mt-1">
            {errors[`${activeLang}.title`]}
          </p>
        )}
      </div>

      {/* Slug */}
      <div>
        <label className="block text-xs font-medium mb-1">
          Slug <span className="text-(--color-destructive)">*</span>
        </label>
        <input
          type="text"
          value={t.slug}
          onChange={(e) =>
            setTranslations((prev) => ({
              ...prev,
              [activeLang]: {
                ...prev[activeLang],
                slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
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
          className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
        />
        <p className="text-[11px] text-(--color-muted) mt-1">
          /{activeLang}/{t.slug}/
        </p>
        {errors[`${activeLang}.slug`] && (
          <p className="text-(--color-destructive) text-xs mt-1">
            {errors[`${activeLang}.slug`]}
          </p>
        )}
      </div>

      <div className="border-t border-(--color-border)" />

      {/* Meta title */}
      <div>
        <label className="block text-xs font-medium mb-1">Meta title</label>
        <input
          type="text"
          value={t.meta_title}
          onChange={(e) =>
            updateTranslationField(activeLang, "meta_title", e.target.value)
          }
          className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
        />
      </div>

      {/* Meta description */}
      <div>
        <label className="block text-xs font-medium mb-1">
          Meta description
        </label>
        <textarea
          rows={3}
          value={t.meta_description}
          onChange={(e) =>
            updateTranslationField(
              activeLang,
              "meta_description",
              e.target.value,
            )
          }
          className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent) resize-none"
        />
      </div>

      {/* Live preview link */}
      {previewUrl && (
        <>
          <div className="border-t border-(--color-border)" />
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-(--color-accent) hover:underline"
          >
            Open live preview
            <svg viewBox="0 0 20 20" fill="currentColor" width={12} height={12}>
              <path
                fillRule="evenodd"
                d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5ZM10 2.75a.75.75 0 0 1 .75-.75h6.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0V4.56l-5.72 5.72a.75.75 0 0 1-1.06-1.06L15.44 3.5h-4.69a.75.75 0 0 1-.75-.75Z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        </>
      )}
    </div>
  );

  return (
    <WysiwygShell
      mode="page"
      title={isNew ? "New Page" : t.title || "Edit Page"}
      subtitle={t.slug ? `/${activeLang}/${t.slug}/` : undefined}
      themeVars={themeVars}
      languages={languages}
      activeLang={activeLang}
      onActiveLangChange={setActiveLang}
      blocks={t.sections ?? []}
      onBlocksChange={(updated) => updateSections(updated as PageBlock[])}
      onSave={handleSave}
      saving={saveMutation.isPending}
      saved={saved}
      serverError={serverError}
      onCopyBlocksFrom={languages.length > 1 ? handleCopyBlocksFrom : undefined}
      pageSettingsNode={pageSettingsNode}
    />
  );
}
