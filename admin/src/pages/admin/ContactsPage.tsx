import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/client";

export default function ContactsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "contacts", page],
    queryFn: () => adminApi.listContacts(page),
  });
  const contacts = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));

  if (isLoading)
    return <div className="p-6 text-[--color-muted]">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contact Submissions</h1>
      <div className="bg-[--color-bg-surface] rounded-lg shadow overflow-hidden border border-[--color-border]">
        <table className="min-w-full divide-y divide-[--color-border]">
          <thead className="bg-[--color-bg]">
            <tr>
              {["Name", "Company", "Email", "Phone", "Date", "Message"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-[--color-muted] uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[--color-border]">
            {contacts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-[--color-muted] text-sm"
                >
                  No contact submissions yet.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-[--color-bg]">
                <td className="px-4 py-3 text-sm">
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-4 py-3 text-sm text-[--color-muted]">
                  {c.company || "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`mailto:${c.email}`}
                    className="text-accent hover:underline"
                  >
                    {c.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-[--color-muted]">
                  {c.phone || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-[--color-muted]">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td
                  className="px-4 py-3 text-sm text-[--color-text] max-w-xs truncate"
                  title={c.message}
                >
                  {c.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-sm text-[--color-muted]">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded text-sm disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
