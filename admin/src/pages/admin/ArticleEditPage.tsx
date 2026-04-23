import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { Article, ArticleTranslation, Language } from "../../api/types";
import { RichTextEditor } from "../../components/admin/RichTextEditor";
import { MediaPickerModal } from "../../components/admin/MediaPickerModal";

// ── Empty translation factory ─────────────────────────────────────────────────

function emptyTranslation(langCode: string): ArticleTranslation {
  return {
    article_id: 0,
    lang_code: langCode,
    slug: "",
    title: "",
    excerpt: "",
    body: "",
    tag: "",
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

// ── Form types ────────────────────────────────────────────────────────────────

type TranslationErrors = Partial<Record<keyof ArticleTranslation, string>>;
type FormErrors = Record<string, TranslationErrors>;

// ── Main component ────────────────────────────────────────────────────────────

export default function ArticleEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: languages = [], isLoading: langsLoading } = useQuery({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["admin", "tags"],
    queryFn: adminApi.getTags,
  });

  const { data: existing, isLoading: articleLoading } = useQuery({
    queryKey: ["admin", "article", id],
    queryFn: () => adminApi.getArticle(Number(id)),
    enabled: !isNew,
  });

  if (langsLoading || (!isNew && articleLoading)) {
    return <div className="p-6 text-(--color-muted)">Loading…</div>;
  }

  return (
    <ArticleForm
      key={existing?.id ?? "new"}
      languages={languages}
      tags={tags}
      existing={existing ?? null}
      isNew={isNew}
      onSaved={(warning) => {
        qc.invalidateQueries({ queryKey: ["admin", "articles"] });
        navigate("/admin/articles", { state: { rebuildWarning: warning } });
      }}
      onCancel={() => navigate("/admin/articles")}
    />
  );
}

// ── Inner form component ──────────────────────────────────────────────────────

function ArticleForm({
  languages,
  tags,
  existing,
  isNew,
  onSaved,
  onCancel,
}: {
  languages: Language[];
  tags: string[];
  existing: Article | null;
  isNew: boolean;
  onSaved: (rebuildWarning?: string) => void;
  onCancel: () => void;
}) {
  const defaultLang =
    languages.find((l) => l.default)?.code ?? languages[0]?.code ?? "en";

  // Build initial translations map from existing article or empty for each lang
  const initialTranslations = Object.fromEntries(
    languages.map((l) => {
      const found = existing?.translations.find((t) => t.lang_code === l.code);
      return [l.code, found ?? emptyTranslation(l.code)];
    }),
  );

  const [activeLang, setActiveLang] = useState(defaultLang);
  const [isFeatured, setIsFeatured] = useState(existing?.is_featured ?? false);
  const [coverImagePath, setCoverImagePath] = useState(
    existing?.cover_image_path ?? "",
  );
  const [publishedAt, setPublishedAt] = useState<string | null>(
    existing?.published_at ?? null,
  );
  const [translations, setTranslations] =
    useState<Record<string, ArticleTranslation>>(initialTranslations);
  const [errors, setErrors] = useState<FormErrors>({});
  const [savingError, setSavingError] = useState<string | null>(null);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [preview, setPreview] = useState(false);

  const mutation = useMutation({
    mutationFn: (payload: Partial<Article>) =>
      isNew
        ? adminApi.createArticle(
            payload as Parameters<typeof adminApi.createArticle>[0],
          )
        : adminApi.updateArticle(existing!.id, payload),
    onSuccess: (result) => {
      onSaved(result.rebuild_warning);
    },
    onError: (err: Error) => {
      setSavingError(err.message);
    },
  });

  function updateTranslation(
    langCode: string,
    key: keyof ArticleTranslation,
    value: string,
  ) {
    setTranslations((prev) => ({
      ...prev,
      [langCode]: { ...prev[langCode], [key]: value },
    }));
    // Clear error for this field
    if (errors[langCode]?.[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        if (next[langCode]) {
          next[langCode] = { ...next[langCode] };
          delete next[langCode][key];
        }
        return next;
      });
    }
  }

  function handleTitleChange(langCode: string, value: string) {
    setTranslations((prev) => ({
      ...prev,
      [langCode]: {
        ...prev[langCode],
        title: value,
        // Auto-slugify only if slug is still pristine
        ...(prev[langCode].slug === slugify(prev[langCode].title ?? "")
          ? { slug: slugify(value) }
          : {}),
      },
    }));
  }

  function validate(): FormErrors {
    const errs: FormErrors = {};
    for (const lang of languages) {
      const t = translations[lang.code];
      const langErrs: TranslationErrors = {};
      if (!t.title.trim()) langErrs.title = "Required";
      if (!t.slug.trim()) langErrs.slug = "Required";
      if (!t.excerpt.trim()) langErrs.excerpt = "Required";
      if (Object.keys(langErrs).length) errs[lang.code] = langErrs;
    }
    return errs;
  }

  function handleSave() {
    setSavingError(null);
    const errs = validate();
    if (Object.keys(errs).length) {
      setErrors(errs);
      // Switch to first lang that has errors
      const firstErrLang = Object.keys(errs)[0];
      setActiveLang(firstErrLang);
      return;
    }

    const payload: Partial<Article> = {
      is_featured: isFeatured,
      cover_image_path: coverImagePath,
      published_at: publishedAt,
      translations: Object.values(translations),
    };
    mutation.mutate(payload);
  }

  const t = translations[activeLang] ?? emptyTranslation(activeLang);
  const langErrors = errors[activeLang] ?? {};

  // ── Preview ───────────────────────────────────────────────────────────────

  if (preview) {
    const wordCount = t.body
      .replace(/<[^>]+>/g, "")
      .split(/\s+/)
      .filter(Boolean).length;
    const readingMins = Math.max(1, Math.round(wordCount / 200));

    return (
      <div className="flex flex-col min-h-screen bg-(--color-bg)">
        {/* Admin preview bar — not part of the site UI */}
        <div className="sticky top-0 z-20 bg-(--color-bg-surface) border-b border-(--color-border) px-6 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-(--color-muted) text-xs uppercase tracking-wider">
              Preview
            </span>
            <div className="flex gap-3">
              {languages.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setActiveLang(l.code)}
                  className={`pb-0.5 border-b transition-colors ${activeLang === l.code ? "border-(--color-accent) text-(--color-accent) font-medium" : "border-transparent text-(--color-muted) hover:text-(--color-text)"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setPreview(false)}
            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs transition-colors"
          >
            ← Back to editor
          </button>
        </div>

        {/* ── Simulated site nav ── */}
        <nav className="bg-(--color-bg-surface) border-b border-(--color-border)">
          <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
            <span className="font-bold text-lg tracking-tight text-(--color-accent)">
              Site Preview
            </span>
            <div className="flex items-center gap-6 text-sm text-(--color-muted)">
              <span>Home</span>
              <span>Articles</span>
              <span>Contact</span>
            </div>
          </div>
        </nav>

        {/* ── Article body — mirrors article.njk ── */}
        <main className="flex-1 bg-(--color-bg)">
          <div className="max-w-3xl mx-auto px-6 py-12">
            {/* Breadcrumb */}
            <nav className="text-xs text-(--color-muted) mb-8 flex items-center gap-1">
              <span className="hover:text-(--color-text) cursor-default">
                Home
              </span>
              <span className="mx-1">›</span>
              <span className="hover:text-(--color-text) cursor-default">
                Articles
              </span>
              <span className="mx-1">›</span>
              <span className="text-(--color-text)">
                {t.title || "Untitled"}
              </span>
            </nav>

            {/* Cover image */}
            {coverImagePath && (
              <img
                src={`/uploads/${coverImagePath}`}
                alt={t.title}
                className="w-full rounded-xl object-cover mb-10"
                style={{ maxHeight: 420 }}
              />
            )}

            {/* Tag */}
            {t.tag && (
              <span
                className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-4"
                style={{
                  background:
                    "color-mix(in srgb, var(--color-accent, #1a56db) 10%, transparent)",
                  color: "var(--color-accent, #1a56db)",
                }}
              >
                {t.tag}
              </span>
            )}

            {/* Title */}
            <h1 className="text-4xl font-extrabold text-(--color-text) leading-tight mb-4">
              {t.title || (
                <span className="text-(--color-muted)">(no title)</span>
              )}
            </h1>

            {/* Meta row */}
            <div className="flex items-center gap-4 text-sm text-(--color-muted) mb-10 border-b border-(--color-border) pb-6">
              {publishedAt ? (
                <time>
                  {new Date(publishedAt).toLocaleDateString(activeLang, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
              ) : (
                <span className="italic">Draft — not published</span>
              )}
              <span>·</span>
              <span>{readingMins} min read</span>
            </div>

            {/* Body */}
            <div
              className="prose max-w-none"
              dangerouslySetInnerHTML={{
                __html: t.body || "<p class='text-gray-300'>(no body yet)</p>",
              }}
            />

            {/* Back link */}
            <div className="mt-16 pt-6 border-t">
              <span
                className="text-sm font-medium cursor-default"
                style={{ color: "var(--color-accent, #1a56db)" }}
              >
                ← Back to Articles
              </span>
            </div>
          </div>
        </main>

        {/* ── Simulated footer ── */}
        <footer className="border-t border-(--color-border) bg-(--color-bg-surface)">
          <div className="max-w-5xl mx-auto px-6 py-8 text-center text-xs text-(--color-muted)">
            Site footer
          </div>
        </footer>
      </div>
    );
  }

  // ── Edit form ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-(--color-bg)">
      {/* Sticky header */}
      <header className="sticky top-0 z-10 bg-(--color-bg-surface) border-b border-(--color-border) px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-(--color-text)">
            {isNew ? "New Article" : `Edit: ${t.title || t.slug || "Untitled"}`}
          </h1>
          {/* Language tabs */}
          <div className="flex gap-4 mt-1">
            {languages.map((l) => (
              <button
                key={l.code}
                onClick={() => setActiveLang(l.code)}
                className={`text-sm pb-0.5 border-b-2 transition-colors ${
                  activeLang === l.code
                    ? "border-(--color-accent) text-accent font-medium"
                    : "border-transparent text-(--color-muted)"
                }`}
              >
                {l.label}
                {errors[l.code] && (
                  <span className="ml-1 text-red-500 text-xs">●</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3 items-center">
          {savingError && (
            <span className="text-red-600 text-sm">{savingError}</span>
          )}
          <button
            onClick={() => setPreview(true)}
            className="px-4 py-2 border border-(--color-border) rounded text-sm text-(--color-muted) hover:bg-(--color-bg)"
          >
            Preview
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-(--color-border) rounded text-(--color-muted) text-sm hover:bg-(--color-bg)"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={mutation.isPending}
            className="px-4 py-2 rounded text-sm btn-accent disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      {/* Body: writing + settings */}
      <div className="flex flex-1 min-h-0 divide-x divide-(--color-border)">
        {/* Writing panel */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Title */}
          <div className="relative pb-5">
            <label className="block text-sm font-medium text-(--color-muted) mb-1">
              Title *
            </label>
            <input
              type="text"
              value={t.title}
              onChange={(e) => handleTitleChange(activeLang, e.target.value)}
              className={`border border-(--color-border) rounded px-3 py-2 w-full bg-(--color-bg) text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent) ${langErrors.title ? "border-red-500" : ""}`}
              placeholder="Article title"
            />
            {langErrors.title && (
              <p className="absolute bottom-0 text-xs text-red-600">
                {langErrors.title}
              </p>
            )}
          </div>

          {/* Slug */}
          <div className="relative pb-5">
            <label className="block text-sm font-medium text-(--color-muted) mb-1">
              Slug *
            </label>
            <input
              type="text"
              value={t.slug}
              onChange={(e) =>
                updateTranslation(
                  activeLang,
                  "slug",
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
                )
              }
              className={`border border-(--color-border) rounded px-3 py-2 w-full font-mono text-sm bg-(--color-bg) text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent) ${langErrors.slug ? "border-red-500" : ""}`}
              placeholder="my-article-slug"
            />
            {langErrors.slug && (
              <p className="absolute bottom-0 text-xs text-red-600">
                {langErrors.slug}
              </p>
            )}
          </div>

          {/* Excerpt */}
          <div className="relative pb-5">
            <label className="block text-sm font-medium text-(--color-muted) mb-1">
              Summary / Excerpt *
            </label>
            <textarea
              value={t.excerpt}
              onChange={(e) =>
                updateTranslation(activeLang, "excerpt", e.target.value)
              }
              rows={3}
              className={`border border-(--color-border) rounded px-3 py-2 w-full bg-(--color-bg) text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent) ${langErrors.excerpt ? "border-red-500" : ""}`}
              placeholder="Short summary shown in article listings"
            />
            {langErrors.excerpt && (
              <p className="absolute bottom-0 text-xs text-red-600">
                {langErrors.excerpt}
              </p>
            )}
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-(--color-muted) mb-1">
              Body
            </label>
            <RichTextEditor
              value={t.body}
              onChange={(html) => updateTranslation(activeLang, "body", html)}
            />
          </div>
        </div>

        {/* Settings panel */}
        <div className="w-80 shrink-0 overflow-y-auto p-6 space-y-6 bg-(--color-bg-surface)">
          {/* Publish */}
          <div>
            <p className="text-sm font-semibold text-(--color-text) mb-2">
              Publish Status
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={publishedAt !== null}
                onChange={(e) =>
                  setPublishedAt(
                    e.target.checked ? new Date().toISOString() : null,
                  )
                }
                className="h-4 w-4 rounded border-(--color-border) accent-(--color-accent)"
              />
              <span className="text-sm">
                {publishedAt
                  ? `Live · ${new Date(publishedAt).toLocaleDateString()}`
                  : "Draft"}
              </span>
            </label>
          </div>

          {/* Featured */}
          <div>
            <p className="text-sm font-semibold text-(--color-text) mb-2">
              Featured
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="h-4 w-4 rounded border-(--color-border) accent-(--color-accent)"
              />
              <span className="text-sm">Show as featured article</span>
            </label>
          </div>

          {/* Cover image */}
          <div>
            <p
              className="text-sm font-semibold mb-2"
              style={{ color: "var(--color-text)" }}
            >
              Cover Image
            </p>
            {coverImagePath ? (
              <div className="space-y-2">
                <img
                  src={`/uploads/${coverImagePath}`}
                  alt=""
                  className="w-full rounded object-cover h-32"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCoverPicker(true)}
                    className="text-xs hover:underline"
                    style={{ color: "var(--color-accent)" }}
                  >
                    Change
                  </button>
                  <button
                    onClick={() => setCoverImagePath("")}
                    className="text-xs hover:underline"
                    style={{ color: "var(--color-destructive, #e02424)" }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCoverPicker(true)}
                className="w-full rounded-lg py-6 text-sm transition-colors"
                style={{
                  border: "2px dashed var(--color-border)",
                  color: "var(--color-muted)",
                }}
              >
                + Select image
              </button>
            )}
          </div>

          {/* Tag */}
          <div>
            <p className="text-sm font-semibold text-(--color-text) mb-2">
              Tag / Category
            </p>
            <select
              value={t.tag}
              onChange={(e) =>
                updateTranslation(activeLang, "tag", e.target.value)
              }
              className="border border-(--color-border) rounded px-3 py-2 w-full text-sm bg-(--color-bg) text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
            >
              <option value="">— None —</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>

          {/* SEO */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-(--color-text)">
              SEO ({activeLang.toUpperCase()})
            </p>
            <div>
              <label className="block text-xs text-(--color-muted) mb-1">
                Meta title{" "}
                <span
                  className={t.meta_title.length > 60 ? "text-amber-500" : ""}
                >
                  {t.meta_title.length}/60
                </span>
              </label>
              <input
                type="text"
                value={t.meta_title}
                onChange={(e) =>
                  updateTranslation(activeLang, "meta_title", e.target.value)
                }
                className="border border-(--color-border) rounded px-3 py-2 w-full text-sm bg-(--color-bg) text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
                placeholder="Leave blank to use article title"
              />
            </div>
            <div>
              <label className="block text-xs text-(--color-muted) mb-1">
                Meta description{" "}
                <span
                  className={
                    t.meta_description.length > 160 ? "text-amber-500" : ""
                  }
                >
                  {t.meta_description.length}/160
                </span>
              </label>
              <textarea
                value={t.meta_description}
                onChange={(e) =>
                  updateTranslation(
                    activeLang,
                    "meta_description",
                    e.target.value,
                  )
                }
                rows={3}
                className="border border-(--color-border) rounded px-3 py-2 w-full text-sm bg-(--color-bg) text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
                placeholder="Leave blank to use excerpt"
              />
            </div>
          </div>
        </div>
      </div>

      {showCoverPicker && (
        <MediaPickerModal
          mode="image"
          onSelect={(file) => {
            setCoverImagePath(file.filename);
            setShowCoverPicker(false);
          }}
          onClose={() => setShowCoverPicker(false)}
        />
      )}
    </div>
  );
}
