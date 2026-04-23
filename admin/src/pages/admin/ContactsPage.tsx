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

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contact Submissions</h1>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Name", "Company", "Email", "Phone", "Date", "Message"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {contacts.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  No contact submissions yet.
                </td>
              </tr>
            )}
            {contacts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {c.company || "—"}
                </td>
                <td className="px-4 py-3 text-sm">
                  <a
                    href={`mailto:${c.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {c.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {c.phone || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </td>
                <td
                  className="px-4 py-3 text-sm text-gray-700 max-w-xs truncate"
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
          <span className="text-sm text-gray-500">
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
