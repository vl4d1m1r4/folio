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
