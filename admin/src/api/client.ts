import type {
  Article,
  Language,
  MediaFile,
  Page,
  PaginatedArticles,
  PaginatedMediaFiles,
  PaginatedContacts,
  PaginatedSubscribers,
  PaginatedPages,
  AllSettings,
} from "./types";

const BASE_URL = "/api/v1";

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "blog_admin_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── Generic fetch wrapper ─────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options?: RequestInit & { auth?: boolean },
): Promise<T> {
  const isFormData = options?.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options?.headers as Record<string, string>),
  };
  if (options?.auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent("auth:unauthorized"));
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const api = {
  getLanguages: () => request<Language[]>("/config/languages"),
};

// ── Admin API ─────────────────────────────────────────────────────────────────

export const adminApi = {
  login: (username: string, password: string) =>
    request<{ token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  refresh: () =>
    request<{ token: string }>("/auth/refresh", { method: "POST", auth: true }),

  // Languages (served from config)
  getLanguages: () => request<Language[]>("/config/languages"),

  // Articles
  listArticles: (page = 1, limit = 20) =>
    request<PaginatedArticles>(`/admin/articles?page=${page}&limit=${limit}`, {
      auth: true,
    }),
  getArticle: (id: number) =>
    request<Article>(`/admin/articles/${id}`, { auth: true }),
  createArticle: (data: Omit<Article, "id" | "created_at" | "updated_at">) =>
    request<Article>("/admin/articles", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  updateArticle: (id: number, data: Partial<Article>) =>
    request<Article>(`/admin/articles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      auth: true,
    }),
  deleteArticle: (id: number) =>
    request<void>(`/admin/articles/${id}`, { method: "DELETE", auth: true }),

  getTags: () => request<string[]>("/admin/tags", { auth: true }),

  // Media
  listMedia: (page = 1) =>
    request<PaginatedMediaFiles>(`/admin/media?page=${page}`, { auth: true }),
  uploadMedia: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<MediaFile>("/admin/media", {
      method: "POST",
      body: fd,
      headers: {},
      auth: true,
    });
  },
  deleteMedia: (id: number) =>
    request<void>(`/admin/media/${id}`, { method: "DELETE", auth: true }),

  // Contacts
  listContacts: (page = 1) =>
    request<PaginatedContacts>(`/admin/contacts?page=${page}`, { auth: true }),

  // Newsletter
  listSubscribers: (page = 1) =>
    request<PaginatedSubscribers>(`/admin/newsletter?page=${page}`, {
      auth: true,
    }),

  // Settings
  getSettings: () => request<AllSettings>("/admin/settings", { auth: true }),
  saveSettings: (data: Partial<AllSettings>) =>
    request<{ message: string }>("/admin/settings", {
      method: "PUT",
      body: JSON.stringify(data),
      auth: true,
    }),

  // Pages
  listPages: (page = 1, limit = 20) =>
    request<PaginatedPages>(`/admin/pages?page=${page}&limit=${limit}`, {
      auth: true,
    }),
  getPage: (id: number) => request<Page>(`/admin/pages/${id}`, { auth: true }),
  createPage: (data: Omit<Page, "id" | "created_at" | "updated_at">) =>
    request<Page>("/admin/pages", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  updatePage: (id: number, data: Partial<Page>) =>
    request<Page>(`/admin/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
      auth: true,
    }),
  deletePage: (id: number) =>
    request<void>(`/admin/pages/${id}`, { method: "DELETE", auth: true }),

  triggerRebuild: () =>
    request<{ status: string }>("/admin/rebuild", {
      method: "POST",
      auth: true,
    }),

  sendTestEmail: (to: string) =>
    request<{ message: string }>("/admin/settings/test-email", {
      method: "POST",
      body: JSON.stringify({ to }),
      auth: true,
    }),
};
