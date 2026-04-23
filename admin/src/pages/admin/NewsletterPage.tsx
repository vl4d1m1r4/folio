import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../api/client";

export default function NewsletterPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "newsletter", page],
    queryFn: () => adminApi.listSubscribers(page),
  });
  const subscribers = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));

  if (isLoading) return <div className="p-6 text-gray-400">Loading…</div>;

  const active = subscribers.filter((s) => !s.unsubscribed_at).length;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Newsletter Subscribers</h1>
        {data && (
          <span className="text-sm text-gray-500">
            {active} active / {data.total} total
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {["Email", "Subscribed", "Status"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {subscribers.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-gray-400 text-sm"
                >
                  No subscribers yet.
                </td>
              </tr>
            )}
            {subscribers.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm">{s.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(s.subscribed_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">
                  {s.unsubscribed_at ? (
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">
                      Unsubscribed{" "}
                      {new Date(s.unsubscribed_at).toLocaleDateString()}
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
                      Active
                    </span>
                  )}
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
