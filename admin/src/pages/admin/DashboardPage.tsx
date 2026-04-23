import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Mail,
  Users,
  Image,
  RefreshCw,
  Plus,
  ExternalLink,
  Settings,
} from "lucide-react";
import { adminApi } from "../../api/client";
import type { Article } from "../../api/types";

function timeAgo(dateStr: string): string {
  const secs = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function articleTitle(a: Article): string {
  return a.translations?.[0]?.title ?? "Untitled";
}

function articleTag(a: Article): string {
  return a.translations?.[0]?.tag ?? "";
}

function StatCard({
  label,
  value,
  sub,
  to,
  icon,
}: {
  label: string;
  value: number | undefined;
  sub?: string;
  to: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="bg-(--color-bg-surface) rounded-xl border border-(--color-border) p-5 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-(--color-muted)">{label}</p>
        <span className="text-(--color-muted) opacity-40">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-(--color-text)">{value ?? "—"}</p>
      {sub && <p className="text-xs text-(--color-muted) mt-1">{sub}</p>}
    </Link>
  );
}

export default function DashboardPage() {
  const [rebuildStatus, setRebuildStatus] = useState<
    "idle" | "pending" | "ok" | "error"
  >("idle");

  const articlesQ = useQuery({
    queryKey: ["admin", "articles", "dash"],
    queryFn: () => adminApi.listArticles(1, 100),
  });
  const contactsQ = useQuery({
    queryKey: ["admin", "contacts", "dash"],
    queryFn: () => adminApi.listContacts(1),
  });
  const subscribersQ = useQuery({
    queryKey: ["admin", "subscribers", "dash"],
    queryFn: () => adminApi.listSubscribers(1),
  });
  const mediaQ = useQuery({
    queryKey: ["admin", "media", "dash"],
    queryFn: () => adminApi.listMedia(1),
  });

  const allArticles = articlesQ.data?.items ?? [];
  const totalArticles = articlesQ.data?.total;
  const published = allArticles.filter((a) => a.published_at !== null).length;
  const drafts = allArticles.filter((a) => a.published_at === null).length;
  const recentArticles = [...allArticles]
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5);

  const recentContacts = contactsQ.data?.items?.slice(0, 4) ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-(--color-text)">Dashboard</h1>
        <div className="flex items-center gap-2">
          {rebuildStatus === "ok" && (
            <span className="text-xs text-green-600 font-medium">
              ✓ Site rebuilt
            </span>
          )}
          {rebuildStatus === "error" && (
            <span className="text-xs text-red-500 font-medium">
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
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-(--color-border) text-sm text-(--color-muted) hover:bg-(--color-bg-surface) disabled:opacity-50 transition-colors"
          >
            <RefreshCw
              size={14}
              className={rebuildStatus === "pending" ? "animate-spin" : ""}
            />
            {rebuildStatus === "pending" ? "Rebuilding…" : "Rebuild Site"}
          </button>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-(--color-border) text-sm text-(--color-muted) hover:bg-(--color-bg-surface) transition-colors"
          >
            <ExternalLink size={14} />
            View Site
          </a>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Articles"
          value={totalArticles}
          sub={
            articlesQ.isSuccess
              ? `${published} published · ${drafts} draft${drafts !== 1 ? "s" : ""}`
              : undefined
          }
          to="/admin/articles"
          icon={<FileText size={18} />}
        />
        <StatCard
          label="Subscribers"
          value={subscribersQ.data?.total}
          to="/admin/newsletter"
          icon={<Mail size={18} />}
        />
        <StatCard
          label="Contacts"
          value={contactsQ.data?.total}
          to="/admin/contacts"
          icon={<Users size={18} />}
        />
        <StatCard
          label="Media Files"
          value={mediaQ.data?.total}
          to="/admin/media"
          icon={<Image size={18} />}
        />
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent articles — 2/3 width */}
        <div className="lg:col-span-2 bg-(--color-bg-surface) rounded-xl border border-(--color-border) p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-(--color-text)">
              Recent Articles
            </h2>
            <Link
              to="/admin/articles/new"
              className="flex items-center gap-1 text-xs text-(--color-accent) hover:underline"
            >
              <Plus size={12} /> New
            </Link>
          </div>

          {articlesQ.isLoading ? (
            <p className="text-sm text-(--color-muted)">Loading…</p>
          ) : recentArticles.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-(--color-muted) mb-3">
                No articles yet.
              </p>
              <Link
                to="/admin/articles/new"
                className="btn-accent text-sm px-4 py-2 rounded-lg"
              >
                Write your first article
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-(--color-border)">
              {recentArticles.map((a) => (
                <li
                  key={a.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/admin/articles/${a.id}`}
                      className="text-sm font-medium text-(--color-text) hover:text-(--color-accent) truncate block"
                    >
                      {articleTitle(a)}
                    </Link>
                    {articleTag(a) && (
                      <span className="text-xs text-(--color-muted)">
                        {articleTag(a)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.published_at
                          ? "bg-green-100 text-green-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {a.published_at ? "Published" : "Draft"}
                    </span>
                    <span className="text-xs text-(--color-muted) w-14 text-right">
                      {timeAgo(a.updated_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(totalArticles ?? 0) > 5 && (
            <Link
              to="/admin/articles"
              className="block mt-4 text-xs text-(--color-muted) hover:underline"
            >
              View all {totalArticles} articles →
            </Link>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-(--color-bg-surface) rounded-xl border border-(--color-border) p-5">
            <h2 className="font-semibold text-(--color-text) mb-3">
              Quick Actions
            </h2>
            <div className="space-y-1">
              {(
                [
                  {
                    label: "New Article",
                    to: "/admin/articles/new",
                    icon: <Plus size={14} />,
                  },
                  {
                    label: "Media Library",
                    to: "/admin/media",
                    icon: <Image size={14} />,
                  },
                  {
                    label: "Settings",
                    to: "/admin/settings",
                    icon: <Settings size={14} />,
                  },
                ] as const
              ).map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-(--color-text) hover:bg-(--color-bg) transition-colors"
                >
                  <span className="text-(--color-muted)">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent contacts */}
          <div className="bg-(--color-bg-surface) rounded-xl border border-(--color-border) p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-(--color-text)">
                Recent Contacts
              </h2>
              <Link
                to="/admin/contacts"
                className="text-xs text-(--color-muted) hover:underline"
              >
                View all
              </Link>
            </div>

            {contactsQ.isLoading ? (
              <p className="text-sm text-(--color-muted)">Loading…</p>
            ) : recentContacts.length === 0 ? (
              <p className="text-sm text-(--color-muted)">
                No submissions yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {recentContacts.map((c) => (
                  <li key={c.id} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-(--color-border) flex items-center justify-center text-xs font-semibold text-(--color-muted) shrink-0">
                      {(c.first_name?.[0] ?? "?").toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-(--color-text) truncate">
                        {c.first_name} {c.last_name}
                      </p>
                      <p className="text-xs text-(--color-muted) truncate">
                        {c.email}
                      </p>
                    </div>
                    <span className="text-xs text-(--color-muted) shrink-0">
                      {timeAgo(c.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
