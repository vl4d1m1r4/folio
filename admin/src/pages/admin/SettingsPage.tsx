import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import { MediaPickerModal } from "../../components/admin/MediaPickerModal";
import type {
  AllSettings,
  Language,
  NavLink,
  SocialLink,
  ThemeSettings,
} from "../../api/types";

// ── Preset themes (must match backend themes/ folder names) ──────────────────
const PRESETS = ["default", "dark", "minimal", "warm"] as const;

// ── Google Fonts curated list ─────────────────────────────────────────────────
const GOOGLE_FONTS = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Poppins",
  "Montserrat",
  "Nunito",
  "Raleway",
  "DM Sans",
  "Geist",
  "Source Sans 3",
  "Playfair Display",
  "Merriweather",
  "Lora",
  "EB Garamond",
] as const;

const SYSTEM_FONTS = new Set([
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "helvetica",
  "arial",
  "sans-serif",
  "serif",
  "monospace",
  "inherit",
  "initial",
  "unset",
  "georgia",
  "times new roman",
  "times",
  "courier new",
  "courier",
  "verdana",
  "trebuchet ms",
  "impact",
  "comic sans ms",
]);

function buildGoogleFontsUrl(fontNames: string[]): string | null {
  const toLoad = [...new Set(fontNames)]
    .map((f) => f.trim())
    .filter((f) => f && !SYSTEM_FONTS.has(f.toLowerCase()));
  if (toLoad.length === 0) return null;
  const families = toLoad
    .map(
      (f) =>
        `family=${encodeURIComponent(f)}:ital,wght@0,400;0,600;0,700;1,400`,
    )
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Dropdown + optional free-text override for a single font setting. */
function FontPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isCustom = !GOOGLE_FONTS.includes(
    value as (typeof GOOGLE_FONTS)[number],
  );
  const [custom, setCustom] = useState(isCustom ? value : "");

  function handleSelect(v: string) {
    if (v === "__custom__") {
      onChange(custom || "");
    } else {
      onChange(v);
    }
  }

  const selectVal = isCustom ? "__custom__" : value;

  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      <select
        value={selectVal}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
      >
        {GOOGLE_FONTS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
        <option value="__custom__">Custom…</option>
      </select>
      {isCustom && (
        <input
          type="text"
          placeholder="e.g. Georgia or 'My Font'"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            onChange(e.target.value);
          }}
          className="mt-1 w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono"
        />
      )}
    </div>
  );
}

const PRESET_DATA: Record<string, ThemeSettings> = {
  default: {
    preset: "default",
    colors: {
      accent: "#1a56db",
      "accent-hover": "#1747c4",
      "accent-dark": "#1345b7",
      cta: "#7e3af2",
      "cta-hover": "#6c2bd9",
      "nav-from": "#1a56db",
      "nav-to": "#1747c4",
      bg: "#ffffff",
      "bg-surface": "#f9fafb",
      text: "#111827",
      muted: "#6b7280",
      border: "#e5e7eb",
      success: "#0e9f6e",
      warning: "#ff9800",
      destructive: "#e02424",
    },
    fonts: {
      body: "Inter",
      heading: "Inter",
      fallback: "system-ui, sans-serif",
    },
    radius: { button: "8px", card: "12px", input: "6px" },
  },
  dark: {
    preset: "dark",
    colors: {
      accent: "#10b981",
      "accent-hover": "#059669",
      "accent-dark": "#047857",
      cta: "#6366f1",
      "cta-hover": "#4f46e5",
      "nav-from": "#1e1e2e",
      "nav-to": "#181825",
      bg: "#0f0f1a",
      "bg-surface": "#1e1e2e",
      text: "#e2e8f0",
      muted: "#94a3b8",
      border: "#2d2d44",
      success: "#10b981",
      warning: "#f59e0b",
      destructive: "#f43f5e",
    },
    fonts: {
      body: "Inter",
      heading: "Inter",
      fallback: "system-ui, sans-serif",
    },
    radius: { button: "6px", card: "10px", input: "4px" },
  },
  minimal: {
    preset: "minimal",
    colors: {
      accent: "#111827",
      "accent-hover": "#1f2937",
      "accent-dark": "#030712",
      cta: "#374151",
      "cta-hover": "#4b5563",
      "nav-from": "#111827",
      "nav-to": "#1f2937",
      bg: "#ffffff",
      "bg-surface": "#f9fafb",
      text: "#111827",
      muted: "#6b7280",
      border: "#e5e7eb",
      success: "#059669",
      warning: "#d97706",
      destructive: "#dc2626",
    },
    fonts: { body: "Georgia", heading: "Playfair Display", fallback: "serif" },
    radius: { button: "2px", card: "2px", input: "2px" },
  },
  warm: {
    preset: "warm",
    colors: {
      accent: "#c2410c",
      "accent-hover": "#9a3412",
      "accent-dark": "#7c2d12",
      cta: "#b45309",
      "cta-hover": "#92400e",
      "nav-from": "#c2410c",
      "nav-to": "#b45309",
      bg: "#fffbf5",
      "bg-surface": "#fef3e2",
      text: "#1c1917",
      muted: "#78716c",
      border: "#e7e5e4",
      success: "#15803d",
      warning: "#d97706",
      destructive: "#b91c1c",
    },
    fonts: {
      body: "Merriweather",
      heading: "Playfair Display",
      fallback: "Georgia, serif",
    },
    radius: { button: "12px", card: "16px", input: "8px" },
  },
};

const COLOR_LABELS: Record<string, string> = {
  accent: "Accent",
  "accent-hover": "Accent hover",
  "accent-dark": "Accent dark",
  cta: "CTA",
  "cta-hover": "CTA hover",
  "nav-from": "Nav gradient from",
  "nav-to": "Nav gradient to",
  bg: "Background",
  "bg-surface": "Surface background",
  text: "Text",
  muted: "Muted text",
  border: "Border",
  success: "Success",
  warning: "Warning",
  destructive: "Destructive",
};

// ── Tab bar ───────────────────────────────────────────────────────────────────
const TABS = [
  "General",
  "Navigation",
  "Footer & Social",
  "Theme",
  "Languages",
  "Translations",
  "Email",
] as const;
type Tab = (typeof TABS)[number];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("General");
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  const { data: pages = [] } = useQuery({
    queryKey: ["admin", "pages", 1],
    queryFn: () => adminApi.listPages(1, 100),
    select: (d) => d.items,
  });

  const { data: languages = [] } = useQuery({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });
  const defaultLang =
    languages.find((l) => l.default)?.code ?? languages[0]?.code ?? "en";

  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: adminApi.saveSettings,
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      qc.invalidateQueries({ queryKey: ["languages"] });
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  // Local state — typed pieces of AllSettings
  const [site, setSite] = useState(settings?.site ?? null);
  const [navLinks, setNavLinks] = useState<NavLink[]>(
    settings?.nav_links ?? [],
  );
  const [footerLinks, setFooterLinks] = useState<NavLink[]>(
    settings?.footer_links ?? [],
  );
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>(
    settings?.social_links ?? [],
  );
  const [theme, setTheme] = useState<ThemeSettings | null>(
    settings?.theme ?? null,
  );
  const [langs, setLangs] = useState<Language[]>(settings?.languages ?? []);
  const [uiStrings, setUiStrings] = useState<
    Record<string, Record<string, string>>
  >(settings?.ui_strings ?? {});

  // Sync once loaded
  useEffect(() => {
    if (!settings) return;
    if (settings.site) setSite(settings.site);
    if (settings.nav_links) setNavLinks(settings.nav_links);
    if (settings.footer_links) setFooterLinks(settings.footer_links);
    if (settings.social_links) setSocialLinks(settings.social_links);
    if (settings.theme) setTheme(settings.theme);
    if (settings.languages) setLangs(settings.languages);
    if (settings.ui_strings) setUiStrings(settings.ui_strings);
  }, [settings]);

  function handleSave() {
    setServerError(null);
    saveMutation.mutate({
      site: site ?? undefined,
      theme: theme ?? undefined,
      nav_links: navLinks,
      footer_links: footerLinks,
      social_links: socialLinks,
      languages: langs,
      ui_strings: uiStrings,
    } as Partial<AllSettings>);
  }

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-(--color-success)">Saved ✓</span>
          )}
          <button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: "var(--color-accent)" }}
          >
            {saveMutation.isPending ? "Saving…" : "Save & Rebuild"}
          </button>
        </div>
      </div>

      {serverError && (
        <div className="mb-4 p-3 rounded border border-(--color-destructive) text-(--color-destructive) text-sm">
          {serverError}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-(--color-border) mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? "border-(--color-accent) text-(--color-accent)"
                : "border-transparent text-(--color-muted) hover:text-(--color-text)"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "General" && site && (
        <GeneralTab site={site} onChange={setSite} />
      )}
      {activeTab === "Navigation" && (
        <LinksTab
          label="Navigation links"
          links={navLinks}
          onChange={setNavLinks}
          pages={pages}
          defaultLang={defaultLang}
          langs={langs}
        />
      )}
      {activeTab === "Footer & Social" && (
        <FooterSocialTab
          footerLinks={footerLinks}
          socialLinks={socialLinks}
          onFooterChange={setFooterLinks}
          onSocialChange={setSocialLinks}
          pages={pages}
          defaultLang={defaultLang}
          langs={langs}
        />
      )}
      {activeTab === "Theme" && theme && (
        <ThemeTab theme={theme} onChange={setTheme} />
      )}
      {activeTab === "Languages" && (
        <LanguagesTab langs={langs} onChange={setLangs} />
      )}
      {activeTab === "Translations" && (
        <TranslationsTab
          langs={langs}
          strings={uiStrings}
          onChange={setUiStrings}
        />
      )}
      {activeTab === "Email" && site && (
        <EmailTab
          emailStatus={settings?.email_status ?? null}
          site={site}
          onChange={setSite}
          savedContactEmail={settings?.site?.contactEmail ?? ""}
        />
      )}
    </div>
  );
}

// ── General tab ───────────────────────────────────────────────────────────────

function GeneralTab({
  site,
  onChange,
}: {
  site: NonNullable<AllSettings["site"]>;
  onChange: (s: NonNullable<AllSettings["site"]>) => void;
}) {
  // Local raw string so intermediate empty lines (while typing new tags) are preserved
  const [tagsText, setTagsText] = useState(() => (site.tags ?? []).join("\n"));
  const [mediaPicker, setMediaPicker] = useState<"favicon" | "logo" | null>(
    null,
  );

  function field(key: keyof typeof site) {
    return (
      <div>
        <label className="block text-sm font-medium mb-1 capitalize">
          {key.replace(/([A-Z])/g, " $1")}
        </label>
        <input
          type="text"
          value={(site[key] as string) ?? ""}
          onChange={(e) => onChange({ ...site, [key]: e.target.value })}
          className="w-full px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-(--color-muted)">
        Core identity for your blog. Changes take effect after saving and
        rebuilding. The favicon and logo are displayed in the browser tab and
        navigation bar respectively.
      </p>
      {field("name")}
      {field("tagline")}
      {field("url")}
      {field("bookingUrl")}

      <div>
        <label className="block text-sm font-medium mb-1">
          Tags (one per line)
        </label>
        <textarea
          rows={5}
          value={tagsText}
          onChange={(e) => {
            setTagsText(e.target.value);
            onChange({
              ...site,
              tags: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            });
          }}
          className="w-full px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono focus:outline-none focus:ring-2 focus:ring-(--color-accent) resize-none"
        />
      </div>

      {/* Favicon */}
      <div>
        <label className="block text-sm font-medium mb-1">Favicon</label>
        <div className="flex gap-3 items-center">
          {site.favicon ? (
            <img
              src={site.favicon}
              alt="favicon"
              className="w-8 h-8 object-contain rounded border border-(--color-border)"
            />
          ) : (
            <div className="w-8 h-8 rounded border border-(--color-border) flex items-center justify-center text-xs text-(--color-muted)">
              ?
            </div>
          )}
          <button
            type="button"
            onClick={() => setMediaPicker("favicon")}
            className="px-3 py-1.5 text-sm border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
          >
            {site.favicon ? "Change" : "Pick image"}
          </button>
          {site.favicon && (
            <button
              type="button"
              onClick={() => onChange({ ...site, favicon: "" })}
              className="text-xs text-(--color-destructive)"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Logo */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Header logo{" "}
          <span className="text-(--color-muted) font-normal text-xs">
            (replaces site name in nav)
          </span>
        </label>
        <div className="flex gap-3 items-center">
          {site.logo ? (
            <img
              src={site.logo}
              alt="logo"
              className="h-10 max-w-40 object-contain rounded border border-(--color-border) p-1"
            />
          ) : (
            <div className="h-10 w-20 rounded border border-(--color-border) flex items-center justify-center text-xs text-(--color-muted)">
              none
            </div>
          )}
          <button
            type="button"
            onClick={() => setMediaPicker("logo")}
            className="px-3 py-1.5 text-sm border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
          >
            {site.logo ? "Change" : "Pick image"}
          </button>
          {site.logo && (
            <button
              type="button"
              onClick={() => onChange({ ...site, logo: "" })}
              className="text-xs text-(--color-destructive)"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {mediaPicker && (
        <MediaPickerModal
          onSelect={(file) => {
            onChange({ ...site, [mediaPicker]: `/uploads/${file.filename}` });
            setMediaPicker(null);
          }}
          onClose={() => setMediaPicker(null)}
        />
      )}
    </div>
  );
}

// ── Link list editor (used for nav + footer) ──────────────────────────────────

const BUILTIN_OPTIONS = [
  { label: "Home", url: "/" },
  { label: "Articles", url: "/articles/" },
  { label: "Contact", url: "/contact/" },
  { label: "Unsubscribe", url: "/unsubscribe/" },
];

function LinkTargetFields({
  link,
  onUpdate,
  pages,
  defaultLang,
  sizeClass,
}: {
  link: NavLink;
  onUpdate: (patch: Partial<NavLink>) => void;
  pages: import("../../api/types").Page[];
  defaultLang: string;
  sizeClass: string;
}) {
  return (
    <>
      <select
        value={link.type}
        onChange={(e) => {
          const type = e.target.value as NavLink["type"];
          if (type === "builtin")
            onUpdate({ type, url: "/", label: "Home", page_id: undefined });
          else if (type === "page")
            onUpdate({ type, page_id: pages[0]?.id, url: "", label: "" });
          else
            onUpdate({ type, url: "https://", label: "", page_id: undefined });
        }}
        className={`${sizeClass} px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)`}
      >
        <option value="builtin">Built-in page</option>
        <option value="page">Custom page</option>
        <option value="external">External URL</option>
      </select>

      {link.type === "builtin" && (
        <select
          value={link.url}
          onChange={(e) => {
            const opt = BUILTIN_OPTIONS.find((o) => o.url === e.target.value);
            onUpdate({ url: e.target.value, label: opt?.label ?? link.label });
          }}
          className={`${sizeClass} px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)`}
        >
          {BUILTIN_OPTIONS.map((o) => (
            <option key={o.url} value={o.url}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {link.type === "page" && (
        <select
          value={link.page_id ?? ""}
          onChange={(e) => {
            const p = pages.find((pg) => pg.id === Number(e.target.value));
            const slug =
              p?.translations.find((t) => t.lang_code === defaultLang)?.slug ??
              p?.translations[0]?.slug ??
              "";
            const title =
              p?.translations.find((t) => t.lang_code === defaultLang)?.title ??
              p?.translations[0]?.title ??
              "";
            onUpdate({
              page_id: Number(e.target.value),
              url: `/${slug}/`,
              label: link.label || title,
            });
          }}
          className={`${sizeClass} px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)`}
        >
          <option value="">— pick a page —</option>
          {pages.map((p) => {
            const title =
              p.translations.find((t) => t.lang_code === defaultLang)?.title ??
              p.translations[0]?.title ??
              `Page ${p.id}`;
            return (
              <option key={p.id} value={p.id}>
                {title}
              </option>
            );
          })}
        </select>
      )}
      {link.type === "external" && (
        <input
          type="url"
          placeholder="https://…"
          value={link.url}
          onChange={(e) => onUpdate({ url: e.target.value })}
          className={`${sizeClass} px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)`}
        />
      )}
    </>
  );
}

// ── Portalled language-label popover ─────────────────────────────────────────

function LangLabelPopover({
  anchorRef,
  open,
  onClose,
  langs,
  defaultLang,
  value,
  labels,
  onChange,
}: {
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  langs: Language[];
  defaultLang: string;
  value: string;
  labels: Record<string, string> | undefined;
  onChange: (langCode: string, val: string) => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (open && anchorRef.current) {
      setRect(anchorRef.current.getBoundingClientRect());
    }
  }, [open, anchorRef]);

  if (!open || !rect) return null;

  const sortedLangs = [
    ...langs.filter((l) => l.code === defaultLang),
    ...langs.filter((l) => l.code !== defaultLang),
  ];

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 min-w-56 bg-(--color-bg) border border-(--color-border) rounded-lg shadow-lg p-3 space-y-2"
        style={{ top: rect.bottom + 6, right: window.innerWidth - rect.right }}
      >
        {sortedLangs.map((l) => {
          const isDefault = l.code === defaultLang;
          const val = isDefault ? value : (labels?.[l.code] ?? "");
          return (
            <div key={l.code} className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold uppercase w-8 shrink-0 text-(--color-muted)">
                {l.code}
              </span>
              <input
                type="text"
                placeholder={isDefault ? "Default label" : value || "Label"}
                value={val}
                onChange={(e) => onChange(l.code, e.target.value)}
                className="flex-1 px-2 py-1 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:border-(--color-accent) outline-none"
                autoFocus={isDefault}
              />
            </div>
          );
        })}
      </div>
    </>,
    document.body,
  );
}

function LabelWithTranslations({
  value,
  labels,
  langs,
  defaultLang,
  placeholder,
  showCount,
  onLabelChange,
  onLabelsChange,
}: {
  value: string;
  labels: Record<string, string> | undefined;
  langs: Language[];
  defaultLang: string;
  placeholder?: string;
  showCount?: boolean;
  onLabelChange: (val: string) => void;
  onLabelsChange: (labels: Record<string, string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const filledLangs =
    (value ? 1 : 0) +
    langs.filter((l) => l.code !== defaultLang && labels?.[l.code]).length;

  return (
    <div className="relative flex gap-1 items-center flex-1 min-w-24">
      <input
        type="text"
        placeholder={placeholder ?? "Label"}
        value={value}
        onChange={(e) => onLabelChange(e.target.value)}
        className="flex-1 min-w-0 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
      />
      {langs.length > 1 && (
        <>
          <button
            ref={btnRef}
            onClick={() => setOpen((o) => !o)}
            title="Per-language labels"
            className={`flex items-center gap-1 px-2 py-1.5 rounded border text-xs shrink-0 transition-colors ${
              open
                ? "border-(--color-accent) bg-(--color-bg-surface) text-(--color-accent)"
                : "border-(--color-border) bg-(--color-bg) text-(--color-muted) hover:text-(--color-text)"
            }`}
          >
            <span>🌐</span>
            {showCount && (
              <span>
                {filledLangs}/{langs.length}
              </span>
            )}
          </button>
          <LangLabelPopover
            anchorRef={btnRef}
            open={open}
            onClose={() => setOpen(false)}
            langs={langs}
            defaultLang={defaultLang}
            value={value}
            labels={labels}
            onChange={(code, val) => {
              if (code === defaultLang) onLabelChange(val);
              else onLabelsChange({ ...(labels ?? {}), [code]: val });
            }}
          />
        </>
      )}
    </div>
  );
}

function ChildRow({
  child,
  idx,
  total,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  pages,
  defaultLang,
  langs,
}: {
  child: NavLink;
  idx: number;
  total: number;
  onUpdate: (patch: Partial<NavLink>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  pages: import("../../api/types").Page[];
  defaultLang: string;
  langs: Language[];
}) {
  if (child.type === "divider") {
    return (
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-0.5 shrink-0">
          <button
            onClick={onMoveUp}
            disabled={idx === 0}
            className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text)"
            title="Move up"
          >
            ▲
          </button>
          <button
            onClick={onMoveDown}
            disabled={idx === total - 1}
            className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text)"
            title="Move down"
          >
            ▼
          </button>
        </div>
        <div className="flex-1 flex items-center gap-2">
          <div className="flex-1 border-t border-dashed border-(--color-border)" />
          <span className="text-xs text-(--color-muted) italic px-1 shrink-0">
            Divider
          </span>
          <div className="flex-1 border-t border-dashed border-(--color-border)" />
        </div>
        <button
          onClick={onRemove}
          className="text-(--color-destructive) text-sm hover:opacity-70 shrink-0"
          title="Remove"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center flex-wrap">
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          onClick={onMoveUp}
          disabled={idx === 0}
          className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text)"
          title="Move up"
        >
          ▲
        </button>
        <button
          onClick={onMoveDown}
          disabled={idx === total - 1}
          className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text)"
          title="Move down"
        >
          ▼
        </button>
      </div>
      <LinkTargetFields
        link={child}
        onUpdate={onUpdate}
        pages={pages}
        defaultLang={defaultLang}
        sizeClass="shrink-0"
      />
      <LabelWithTranslations
        value={child.label}
        labels={child.labels}
        langs={langs}
        defaultLang={defaultLang}
        onLabelChange={(val) => onUpdate({ label: val })}
        onLabelsChange={(labels) => onUpdate({ labels })}
      />
      <button
        onClick={onRemove}
        className="text-(--color-destructive) text-sm hover:opacity-70 shrink-0"
        title="Remove"
      >
        ✕
      </button>
    </div>
  );
}

function LinksTab({
  label,
  links,
  onChange,
  pages,
  defaultLang,
  langs,
}: {
  label: string;
  links: NavLink[];
  onChange: (l: NavLink[]) => void;
  pages: import("../../api/types").Page[];
  defaultLang: string;
  langs: Language[];
}) {
  const [openDropdowns, setOpenDropdowns] = useState<Set<number>>(new Set());

  function addLink() {
    onChange([
      ...links,
      { type: "builtin", label: "", url: "/", order: links.length },
    ]);
  }

  function removeLink(idx: number) {
    onChange(
      links.filter((_, i) => i !== idx).map((l, i) => ({ ...l, order: i })),
    );
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const next = [...links];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onChange(next.map((l, i) => ({ ...l, order: i })));
  }

  function moveDown(idx: number) {
    if (idx === links.length - 1) return;
    const next = [...links];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onChange(next.map((l, i) => ({ ...l, order: i })));
  }

  function updateLink(idx: number, patch: Partial<NavLink>) {
    onChange(links.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function enableDropdown(idx: number) {
    updateLink(idx, { children: [] });
    setOpenDropdowns((s) => new Set(s).add(idx));
  }

  function toggleDropdownOpen(idx: number) {
    setOpenDropdowns((s) => {
      const next = new Set(s);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function addChild(linkIdx: number, type: "link" | "divider") {
    const children = links[linkIdx].children ?? [];
    const child: NavLink =
      type === "divider"
        ? { type: "divider", label: "", url: "", order: children.length }
        : { type: "builtin", label: "Home", url: "/", order: children.length };
    updateLink(linkIdx, { children: [...children, child] });
  }

  function removeChild(linkIdx: number, childIdx: number) {
    const children = (links[linkIdx].children ?? [])
      .filter((_, i) => i !== childIdx)
      .map((c, i) => ({ ...c, order: i }));
    updateLink(linkIdx, { children });
  }

  function updateChild(
    linkIdx: number,
    childIdx: number,
    patch: Partial<NavLink>,
  ) {
    const children = (links[linkIdx].children ?? []).map((c, i) =>
      i === childIdx ? { ...c, ...patch } : c,
    );
    updateLink(linkIdx, { children });
  }

  function moveChildUp(linkIdx: number, childIdx: number) {
    if (childIdx === 0) return;
    const children = [...(links[linkIdx].children ?? [])];
    [children[childIdx - 1], children[childIdx]] = [
      children[childIdx],
      children[childIdx - 1],
    ];
    updateLink(linkIdx, {
      children: children.map((c, i) => ({ ...c, order: i })),
    });
  }

  function moveChildDown(linkIdx: number, childIdx: number) {
    const children = links[linkIdx].children ?? [];
    if (childIdx === children.length - 1) return;
    const next = [...children];
    [next[childIdx], next[childIdx + 1]] = [next[childIdx + 1], next[childIdx]];
    updateLink(linkIdx, { children: next.map((c, i) => ({ ...c, order: i })) });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-(--color-muted)">{label}</p>
      <p className="text-xs text-(--color-muted)">
        Use ▲▼ to reorder · 🌐 for per-language labels · circle+ to add a
        dropdown with nested links and dividers.
      </p>

      {links.map((link, idx) => {
        const hasChildren = link.children !== undefined;
        const isDropdownOpen = hasChildren && openDropdowns.has(idx);

        return (
          <div
            key={idx}
            className="rounded-lg border border-(--color-border) bg-(--color-bg-surface) overflow-hidden"
          >
            {/* Top-level row */}
            <div className="flex gap-2 items-start p-3">
              {/* Reorder */}
              <div className="flex flex-col gap-1 pt-1 shrink-0">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text)"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === links.length - 1}
                  className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text)"
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              {/* Type + target + label */}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <LinkTargetFields
                  link={link}
                  onUpdate={(patch) => updateLink(idx, patch)}
                  pages={pages}
                  defaultLang={defaultLang}
                  sizeClass=""
                />

                {/* Label + translations popover */}
                <LabelWithTranslations
                  value={link.label}
                  labels={link.labels}
                  langs={langs}
                  defaultLang={defaultLang}
                  placeholder={hasChildren ? "Dropdown label" : "Label"}
                  showCount
                  onLabelChange={(val) => updateLink(idx, { label: val })}
                  onLabelsChange={(labels) => updateLink(idx, { labels })}
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 shrink-0">
                <button
                  onClick={() =>
                    hasChildren ? toggleDropdownOpen(idx) : enableDropdown(idx)
                  }
                  title={
                    isDropdownOpen
                      ? "Collapse dropdown"
                      : hasChildren
                        ? "Expand dropdown"
                        : "Turn into dropdown"
                  }
                  className="p-1.5 rounded border transition-colors border-(--color-accent) text-(--color-accent) bg-(--color-accent)/10 hover:bg-(--color-accent)/20"
                >
                  {isDropdownOpen ? (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path stroke-linecap="round" d="M8 12h8" />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path stroke-linecap="round" d="M12 8v8M8 12h8" />
                    </svg>
                  )}
                </button>
                <button
                  onClick={() => removeLink(idx)}
                  className="text-(--color-destructive) text-sm hover:opacity-70"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Children panel */}
            {isDropdownOpen && (
              <div className="border-t border-(--color-border) bg-(--color-bg) px-4 py-3 space-y-2">
                <p className="text-xs font-medium text-(--color-muted)">
                  Dropdown items
                  {link.children!.length === 0 && (
                    <span className="italic font-normal">
                      {" "}
                      — add items below
                    </span>
                  )}
                </p>
                {link.children!.map((child, childIdx) => (
                  <ChildRow
                    key={childIdx}
                    child={child}
                    idx={childIdx}
                    total={link.children!.length}
                    onUpdate={(patch) => updateChild(idx, childIdx, patch)}
                    onRemove={() => removeChild(idx, childIdx)}
                    onMoveUp={() => moveChildUp(idx, childIdx)}
                    onMoveDown={() => moveChildDown(idx, childIdx)}
                    pages={pages}
                    defaultLang={defaultLang}
                    langs={langs}
                  />
                ))}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => addChild(idx, "link")}
                    className="text-xs text-(--color-accent) hover:underline"
                  >
                    + Child link
                  </button>
                  <button
                    onClick={() => addChild(idx, "divider")}
                    className="text-xs text-(--color-muted) hover:text-(--color-text) hover:underline"
                  >
                    + Divider
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={addLink}
        className="text-sm text-(--color-accent) hover:underline"
      >
        + Add link
      </button>
    </div>
  );
}

// ── Footer & Social tab ───────────────────────────────────────────────────────

function FooterSocialTab({
  footerLinks,
  socialLinks,
  onFooterChange,
  onSocialChange,
  pages,
  defaultLang,
  langs,
}: {
  footerLinks: NavLink[];
  socialLinks: SocialLink[];
  onFooterChange: (l: NavLink[]) => void;
  onSocialChange: (l: SocialLink[]) => void;
  pages: import("../../api/types").Page[];
  defaultLang: string;
  langs: Language[];
}) {
  function addSocial() {
    onSocialChange([...socialLinks, { platform: "twitter", url: "" }]);
  }
  function removeSocial(idx: number) {
    onSocialChange(socialLinks.filter((_, i) => i !== idx));
  }
  function updateSocial(idx: number, patch: Partial<SocialLink>) {
    onSocialChange(
      socialLinks.map((l, i) => (i === idx ? { ...l, ...patch } : l)),
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-(--color-muted)">
        Manage links shown in the site footer and your social media profile
        links. Footer links support the same per-language labels as navigation
        links.
      </p>
      <div>
        <h2 className="font-semibold mb-3">Footer links</h2>
        <LinksTab
          label="Links shown in the footer"
          links={footerLinks}
          onChange={onFooterChange}
          pages={pages}
          defaultLang={defaultLang}
          langs={langs}
        />
      </div>

      <div>
        <h2 className="font-semibold mb-3">Social links</h2>
        <div className="space-y-2">
          {socialLinks.map((s, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Platform (twitter, linkedin, github, …)"
                value={s.platform}
                onChange={(e) =>
                  updateSocial(idx, { platform: e.target.value })
                }
                className="w-40 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
              <input
                type="url"
                placeholder="https://…"
                value={s.url}
                onChange={(e) => updateSocial(idx, { url: e.target.value })}
                className="flex-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
              <button
                onClick={() => removeSocial(idx)}
                className="text-(--color-destructive) text-sm hover:opacity-70"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addSocial}
            className="text-sm text-(--color-accent) hover:underline"
          >
            + Add social link
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Theme tab ─────────────────────────────────────────────────────────────────

function ThemeTab({
  theme,
  onChange,
}: {
  theme: ThemeSettings;
  onChange: (t: ThemeSettings) => void;
}) {
  function setColor(key: string, value: string) {
    onChange({ ...theme, colors: { ...theme.colors, [key]: value } });
  }

  // Live preview: update the global #folio-theme tag so the whole admin reflects changes
  useEffect(() => {
    // Inject / update CSS variables
    let el = document.getElementById("folio-theme") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "folio-theme";
      document.head.appendChild(el);
    }
    const vars = [
      ...Object.entries(theme.colors).map(([k, v]) => `  --color-${k}: ${v};`),
      `  --font-body: ${theme.fonts?.body ?? "Inter"};`,
      `  --font-heading: ${theme.fonts?.heading ?? theme.fonts?.body ?? "Inter"};`,
      `  --font-fallback: ${theme.fonts?.fallback ?? "system-ui, sans-serif"};`,
      `  --radius-button: ${theme.radius?.button ?? "8px"};`,
      `  --radius-card: ${theme.radius?.card ?? "12px"};`,
      `  --radius-input: ${theme.radius?.input ?? "6px"};`,
    ].join("\n");
    el.textContent = `:root {\n${vars}\n}`;

    // Inject / update Google Fonts link for the selected fonts
    const fontNames = [theme.fonts?.body, theme.fonts?.heading].filter(
      (f): f is string => Boolean(f),
    );
    const googleFontsUrl = buildGoogleFontsUrl(fontNames);
    let linkEl = document.getElementById(
      "folio-fonts",
    ) as HTMLLinkElement | null;
    if (googleFontsUrl) {
      if (!linkEl) {
        linkEl = document.createElement("link");
        linkEl.id = "folio-fonts";
        linkEl.rel = "stylesheet";
        document.head.appendChild(linkEl);
      }
      linkEl.href = googleFontsUrl;
    } else if (linkEl) {
      linkEl.remove();
    }
  }, [theme]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-(--color-muted)">
        Customise your site's visual appearance. Picking a preset instantly
        applies a curated set of colours, fonts and border radii — you can then
        fine-tune individual values below. Changes are previewed live in the
        admin UI.
      </p>
      {/* Preset selector */}
      <div>
        <label className="block text-sm font-medium mb-1">Preset</label>
        <select
          value={theme.preset}
          onChange={(e) => {
            const preset = e.target.value;
            const presetData = PRESET_DATA[preset];
            if (presetData) {
              onChange(presetData);
            } else {
              onChange({ ...theme, preset });
            }
          }}
          className="px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg)"
        >
          {PRESETS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <p className="text-xs text-(--color-muted) mt-1">
          Selecting a preset replaces all colours, fonts, and radius below.
        </p>
      </div>

      {/* Colour pickers */}
      <div>
        <h2 className="font-semibold mb-3">Colours</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Object.entries(theme.colors).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <input
                type="color"
                value={value}
                onChange={(e) => setColor(key, e.target.value)}
                className="w-9 h-9 rounded cursor-pointer border border-(--color-border) p-0.5 bg-(--color-bg)"
                title={key}
              />
              <div>
                <div className="text-xs font-medium leading-tight">
                  {COLOR_LABELS[key] ?? key}
                </div>
                <div className="text-xs text-(--color-muted) font-mono leading-tight">
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div>
        <h2 className="font-semibold mb-3">Fonts</h2>
        <div className="grid grid-cols-2 gap-4">
          <FontPicker
            label="Body font"
            value={theme.fonts.body}
            onChange={(v) =>
              onChange({ ...theme, fonts: { ...theme.fonts, body: v } })
            }
          />
          <FontPicker
            label="Heading font"
            value={theme.fonts.heading ?? theme.fonts.body}
            onChange={(v) =>
              onChange({ ...theme, fonts: { ...theme.fonts, heading: v } })
            }
          />
          <div className="col-span-2">
            <label className="block text-xs font-medium mb-1">
              Fallback stack{" "}
              <span className="font-normal text-(--color-muted)">
                (CSS font stack used when the above fonts are unavailable)
              </span>
            </label>
            <input
              type="text"
              value={theme.fonts.fallback}
              onChange={(e) =>
                onChange({
                  ...theme,
                  fonts: { ...theme.fonts, fallback: e.target.value },
                })
              }
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono"
            />
          </div>
        </div>
      </div>

      {/* Border radius */}
      <div>
        <h2 className="font-semibold mb-3">Border radius</h2>
        <div className="grid grid-cols-3 gap-4">
          {(["button", "card", "input"] as const).map((key) => (
            <div key={key}>
              <label className="block text-xs font-medium mb-1 capitalize">
                {key}
              </label>
              <input
                type="text"
                value={theme.radius[key]}
                onChange={(e) =>
                  onChange({
                    ...theme,
                    radius: { ...theme.radius, [key]: e.target.value },
                  })
                }
                className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Languages tab ─────────────────────────────────────────────────────────────

function LanguagesTab({
  langs,
  onChange,
}: {
  langs: Language[];
  onChange: (langs: Language[]) => void;
}) {
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newDir, setNewDir] = useState<"ltr" | "rtl">("ltr");
  const [addError, setAddError] = useState("");

  function setDefault(code: string) {
    onChange(langs.map((l) => ({ ...l, default: l.code === code })));
  }

  function remove(code: string) {
    if (langs.length <= 1) return; // must keep at least one
    const next = langs.filter((l) => l.code !== code);
    // If the removed lang was default, promote the first remaining one
    if (!next.some((l) => l.default)) next[0].default = true;
    onChange(next);
  }

  function addLanguage() {
    setAddError("");
    const code = newCode.trim().toLowerCase();
    const label = newLabel.trim();
    if (!code) {
      setAddError("Code is required.");
      return;
    }
    if (!label) {
      setAddError("Label is required.");
      return;
    }
    if (!/^[a-z]{2,8}(-[a-zA-Z0-9]{1,8})*$/.test(code)) {
      setAddError("Use a valid language code (e.g. en, fr, zh-TW).");
      return;
    }
    if (langs.some((l) => l.code === code)) {
      setAddError(`Language "${code}" already exists.`);
      return;
    }
    onChange([
      ...langs,
      { code, label, dir: newDir, default: langs.length === 0 },
    ]);
    setNewCode("");
    setNewLabel("");
    setNewDir("ltr");
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-(--color-muted)">
        Manage the languages your blog supports. The default language is used as
        the primary locale for URLs and content fallback. Changes take effect
        after saving and rebuilding.
      </p>

      {/* Existing languages */}
      <div className="space-y-2">
        {langs.map((l) => (
          <div
            key={l.code}
            className="flex items-center gap-3 px-4 py-3 rounded border border-(--color-border) bg-(--color-bg-surface)"
          >
            <span className="font-mono text-sm font-semibold w-16 shrink-0">
              {l.code}
            </span>
            <span className="flex-1 text-sm">{l.label}</span>
            <span className="text-xs text-(--color-muted) w-8">{l.dir}</span>
            {l.default ? (
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Default
              </span>
            ) : (
              <button
                onClick={() => setDefault(l.code)}
                className="text-xs text-(--color-accent) hover:underline"
              >
                Set default
              </button>
            )}
            <button
              onClick={() => remove(l.code)}
              disabled={langs.length <= 1}
              className="text-xs text-(--color-destructive) hover:underline disabled:opacity-30"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Add new language */}
      <div className="p-4 rounded border border-(--color-border) space-y-3">
        <h3 className="text-sm font-semibold">Add language</h3>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Code</label>
            <input
              type="text"
              placeholder="e.g. fr"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Label</label>
            <input
              type="text"
              placeholder="e.g. Français"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Direction</label>
            <select
              value={newDir}
              onChange={(e) => setNewDir(e.target.value as "ltr" | "rtl")}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="ltr">LTR</option>
              <option value="rtl">RTL</option>
            </select>
          </div>
        </div>
        {addError && (
          <p className="text-xs text-(--color-destructive)">{addError}</p>
        )}
        <button
          type="button"
          onClick={addLanguage}
          className="px-3 py-1.5 text-sm text-white rounded"
          style={{ background: "var(--color-accent)" }}
        >
          Add language
        </button>
      </div>
    </div>
  );
}

// ── Translations tab ──────────────────────────────────────────────────────────

const UI_STRING_GROUPS: {
  label: string;
  keys: { key: string; label: string }[];
}[] = [
  {
    label: "Contact page",
    keys: [
      { key: "contact_title", label: "Page title" },
      { key: "contact_intro", label: "Intro text" },
      { key: "contact_first_name", label: "First name label" },
      { key: "contact_last_name", label: "Last name label" },
      { key: "contact_company", label: "Company label" },
      { key: "contact_email", label: "Email label" },
      { key: "contact_phone", label: "Phone label" },
      { key: "contact_message", label: "Message label" },
      { key: "contact_submit", label: "Submit button" },
      { key: "contact_success", label: "Success message" },
      { key: "contact_error", label: "Error message" },
    ],
  },
  {
    label: "Unsubscribe page",
    keys: [
      { key: "unsubscribe_title", label: "Page title" },
      { key: "unsubscribe_intro", label: "Intro text" },
      { key: "unsubscribe_email_placeholder", label: "Email placeholder" },
      { key: "unsubscribe_submit", label: "Submit button" },
      { key: "unsubscribe_success", label: "Success message" },
    ],
  },
  {
    label: "Articles page",
    keys: [
      { key: "articles_title", label: "Page title" },
      { key: "articles_intro", label: "Intro text" },
      { key: "articles_all_filter", label: '"All" filter button' },
      { key: "articles_no_results", label: "No tag-filter results" },
      { key: "articles_no_articles", label: "No articles published" },
    ],
  },
  {
    label: "Article page",
    keys: [
      { key: "article_home", label: "Breadcrumb: Home" },
      { key: "article_read_more", label: "Read more (card link)" },
      { key: "reading_time_suffix", label: "Reading time suffix" },
    ],
  },
];

function TranslationsTab({
  langs,
  strings,
  onChange,
}: {
  langs: Language[];
  strings: Record<string, Record<string, string>>;
  onChange: (s: Record<string, Record<string, string>>) => void;
}) {
  const langCodes = langs.map((l) => l.code);
  const defaultLang =
    langs.find((l) => l.default)?.code ?? langCodes[0] ?? "en";
  const [activeLang, setActiveLang] = useState(defaultLang);

  // Ensure activeLang is valid when langs change
  const currentLang = langCodes.includes(activeLang)
    ? activeLang
    : (langCodes[0] ?? "en");

  function set(key: string, value: string) {
    onChange({
      ...strings,
      [currentLang]: { ...(strings[currentLang] ?? {}), [key]: value },
    });
  }

  // English defaults for placeholder hints
  const enDefaults = strings["en"] ?? {};

  return (
    <div className="space-y-6">
      <p className="text-sm text-(--color-muted)">
        Translate the built-in page labels, buttons, and messages for each
        language. Leave a field blank to fall back to English.
      </p>

      {/* Language tabs */}
      {langCodes.length > 1 && (
        <div className="flex gap-1 border-b border-(--color-border)">
          {langs.map((l) => (
            <button
              key={l.code}
              onClick={() => setActiveLang(l.code)}
              className={`px-4 py-2 text-sm font-medium rounded-t border-b-2 -mb-px transition-colors ${
                currentLang === l.code
                  ? "border-(--color-accent) text-(--color-accent)"
                  : "border-transparent text-(--color-muted) hover:text-(--color-text)"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      {/* String groups */}
      {UI_STRING_GROUPS.map((group) => (
        <div key={group.label}>
          <h3
            className="text-sm font-semibold mb-3 pb-1"
            style={{ borderBottom: "1px solid var(--color-border)" }}
          >
            {group.label}
          </h3>
          <div className="space-y-3">
            {group.keys.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-3 gap-3 items-center">
                <label className="text-sm text-(--color-muted) col-span-1">
                  {label}
                </label>
                <input
                  type="text"
                  value={strings[currentLang]?.[key] ?? ""}
                  placeholder={enDefaults[key] ?? ""}
                  onChange={(e) => set(key, e.target.value)}
                  className="col-span-2 px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Email tab ─────────────────────────────────────────────────────────────────

function EmailTab({
  emailStatus,
  site,
  onChange,
  savedContactEmail,
}: {
  emailStatus: AllSettings["email_status"];
  site: NonNullable<AllSettings["site"]>;
  onChange: (s: NonNullable<AllSettings["site"]>) => void;
  savedContactEmail: string;
}) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const [sending, setSending] = useState(false);

  const providerConfigured = emailStatus?.configured ?? false;
  const contactEmail = site.contactEmail ?? "";
  const savedEmailValid = savedContactEmail.includes("@");
  const configured = providerConfigured && savedEmailValid;
  const provider = emailStatus?.provider ?? "unknown";

  async function handleSend() {
    setSending(true);
    setResult(null);
    try {
      const res = await adminApi.sendTestEmail(savedContactEmail);
      setResult({ ok: true, message: res.message });
    } catch (err) {
      setResult({ ok: false, message: (err as Error).message });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-(--color-muted)">
        Email is used to notify you when the contact form is submitted.
        Configuration is done via environment variables — changes require a
        server restart.
      </p>

      {/* Contact email recipient */}
      <div>
        <label className="block text-sm font-medium mb-1">Contact email</label>
        <input
          type="email"
          placeholder="you@example.com"
          value={contactEmail}
          onChange={(e) => onChange({ ...site, contactEmail: e.target.value })}
          className="w-full px-3 py-2 border border-(--color-border) rounded text-sm bg-(--color-bg) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
        />
        <p className="mt-1 text-xs text-(--color-muted)">
          Recipient for contact form notification emails. Save &amp; Rebuild to apply.
        </p>
      </div>

      {/* Status card */}
      <div className="p-4 rounded border border-(--color-border) bg-(--color-bg-surface) space-y-3">
        <h2 className="text-sm font-semibold">Delivery status</h2>
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{
              background: configured
                ? "var(--color-success)"
                : "var(--color-muted)",
            }}
          />
          <div>
            <span className="font-mono text-xs uppercase tracking-wide text-(--color-muted) mr-2">
              {provider}
            </span>
            <span
              className={
                configured
                  ? "text-sm text-(--color-text)"
                  : "text-sm text-(--color-muted)"
              }
            >
              {!providerConfigured
                ? "Not configured — emails will be skipped"
                : !savedEmailValid
                  ? "Provider ready — save a contact email above to enable"
                  : "Configured and ready"}
            </span>
          </div>
        </div>
        <p className="text-xs text-(--color-muted)">
          Set <code className="text-xs">EMAIL_PROVIDER=smtp</code> (or{" "}
          <code className="text-xs">msgraph</code>) and the corresponding
          credentials in your environment file, then restart the server.
        </p>
      </div>

      {/* Test email — only shown when fully configured */}
      {configured && (
        <div className="p-4 rounded border border-(--color-border) space-y-3">
          <h2 className="text-sm font-semibold">Send a test email</h2>
          <p className="text-sm text-(--color-muted)">
            Sends a test message to <strong>{savedContactEmail}</strong>.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSend}
              disabled={sending}
              className="px-4 py-2 text-sm text-white rounded disabled:opacity-50"
              style={{ background: "var(--color-accent)" }}
            >
              {sending ? "Sending…" : "Send test"}
            </button>
          </div>

          {result && (
            <p
              className="text-sm"
              style={{
                color: result.ok
                  ? "var(--color-success)"
                  : "var(--color-destructive)",
              }}
            >
              {result.ok ? "✓ " : "✗ "}
              {result.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
