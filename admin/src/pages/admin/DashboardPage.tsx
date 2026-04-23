import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "../../api/client";

function StatCard({
  label,
  value,
  to,
}: {
  label: string;
  value?: number;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="bg-(--color-bg-surface) rounded-lg shadow p-6 hover:shadow-md transition-shadow block border border-(--color-border)"
    >
      <p className="text-sm text-(--color-muted)">{label}</p>
      <p className="text-3xl font-bold mt-1 text-(--color-text)">
        {value ?? "—"}
      </p>
    </Link>
  );
}

export default function DashboardPage() {
  const articles = useQuery({
    queryKey: ["admin", "articles"],
    queryFn: () => adminApi.listArticles(),
  });
  const contacts = useQuery({
    queryKey: ["admin", "contacts"],
    queryFn: () => adminApi.listContacts(),
  });
  const subscribers = useQuery({
    queryKey: ["admin", "subscribers"],
    queryFn: () => adminApi.listSubscribers(),
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Articles"
          value={articles.data?.total}
          to="/admin/articles"
        />
        <StatCard
          label="Contact Submissions"
          value={contacts.data?.total}
          to="/admin/contacts"
        />
        <StatCard
          label="Newsletter Subscribers"
          value={subscribers.data?.total}
          to="/admin/newsletter"
        />
      </div>
      <div className="bg-(--color-bg-surface) rounded-lg shadow p-6 border border-(--color-border)">
        <h2 className="font-semibold mb-3">Quick links</h2>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "+ New Article", to: "/admin/articles/new" },
            { label: "Media Library", to: "/admin/media" },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="px-4 py-2 bg-(--color-bg) hover:bg-(--color-border) rounded text-sm transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
