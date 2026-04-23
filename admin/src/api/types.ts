// ── Article ───────────────────────────────────────────────────────────────────

export interface ArticleTranslation {
  article_id: number;
  lang_code: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tag: string;
  meta_title: string;
  meta_description: string;
}

/** Full article returned by admin endpoints (includes all translations). */
export interface Article {
  id: number;
  is_featured: boolean;
  cover_image_path: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  translations: ArticleTranslation[];
  rebuild_warning?: string;
}

/** Flat single-language article returned by public endpoints. */
export interface PublicArticle {
  id: number;
  is_featured: boolean;
  cover_image_path: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  lang_code: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  tag: string;
  meta_title: string;
  meta_description: string;
}

// ── Language config ───────────────────────────────────────────────────────────

export interface Language {
  code: string;
  label: string;
  dir: "ltr" | "rtl";
  default: boolean;
}

// ── Media ─────────────────────────────────────────────────────────────────────

export interface MediaFile {
  id: number;
  filename: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
}

// ── Contact / Newsletter ──────────────────────────────────────────────────────

export interface ContactSubmission {
  id: number;
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
  message: string;
  privacy_agreed: boolean;
  created_at: string;
}

export interface NewsletterSubscriber {
  id: number;
  email: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

// ── Pagination ────────────────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type PaginatedArticles = Paginated<Article>;
export type PaginatedPublicArticles = Paginated<PublicArticle>;
export type PaginatedMediaFiles = Paginated<MediaFile>;
export type PaginatedContacts = Paginated<ContactSubmission>;
export type PaginatedSubscribers = Paginated<NewsletterSubscriber>;

// ── Custom Pages ──────────────────────────────────────────────────────────────

export interface PageTranslation {
  page_id: number;
  lang_code: string;
  slug: string;
  title: string;
  body: string;
  sections: PageBlock[];
  meta_title: string;
  meta_description: string;
}

export interface Page {
  id: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  translations: PageTranslation[];
}

export type PaginatedPages = Paginated<Page>;

// ── Settings ──────────────────────────────────────────────────────────────────

export interface NavLink {
  /** "builtin" | "page" | "external" | "divider" */
  type: "builtin" | "page" | "external" | "divider";
  label: string;
  /** Per-language label overrides. Falls back to `label` if not set. */
  labels?: Record<string, string>;
  /** Resolved URL (for builtin/external) */
  url: string;
  /** DB page id, only when type === "page" */
  page_id?: number;
  order: number;
  /** When present, this link renders as a dropdown containing these items. */
  children?: NavLink[];
}

export interface SocialLink {
  /** "twitter" | "linkedin" | "github" | custom label */
  platform: string;
  url: string;
}

export interface ThemeColors {
  accent: string;
  "accent-hover": string;
  "accent-dark": string;
  cta: string;
  "cta-hover": string;
  "nav-from": string;
  "nav-to": string;
  bg: string;
  "bg-surface": string;
  text: string;
  muted: string;
  border: string;
  success: string;
  warning: string;
  destructive: string;
  [key: string]: string;
}

export interface ThemeSettings {
  preset: string;
  colors: ThemeColors;
  fonts: { body: string; fallback: string };
  radius: { button: string; card: string; input: string };
}

export interface SiteSettingsData {
  name: string;
  tagline: string;
  url: string;
  bookingUrl: string;
  contactEmail: string;
  tags: string[];
  favicon: string;
  logo: string;
  social: { twitter: string; linkedin: string; github: string };
}

// ── Page Block Builder ────────────────────────────────────────────────────────

/** A block inside a custom page (text stored directly in config, no lang sub-object). */
export interface PageBlock {
  id: string;
  type: BlockType;
  visible: boolean;
  order: number;
  config: Record<string, unknown>;
  children?: PageBlock[];
}

// ── Home Builder ──────────────────────────────────────────────────────────────

export type BlockType =
  | "hero"
  | "featured-articles"
  | "latest-articles"
  | "cta-band"
  | "rich-text"
  | "image-text"
  | "testimonials"
  | "newsletter"
  | "container";

export interface HomeBlock {
  id: string;
  type: BlockType;
  visible: boolean;
  order: number;
  /** Block-specific non-text config (counts, layout flags, etc.) */
  config: Record<string, unknown>;
  /** Text fields keyed by lang code */
  translations: Record<string, Record<string, string>>;
  /** For container blocks only — nested child blocks */
  children?: HomeBlock[];
}

export interface AllSettings {
  site: SiteSettingsData | null;
  theme: ThemeSettings | null;
  nav_links: NavLink[] | null;
  footer_links: NavLink[] | null;
  social_links: SocialLink[] | null;
  home_sections: HomeBlock[] | null;
  languages: Language[] | null;
  ui_strings: Record<string, Record<string, string>> | null;
}
