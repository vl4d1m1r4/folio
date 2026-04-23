import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "media", page],
    queryFn: () => adminApi.listMedia(page),
  });
  const files = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminApi.uploadMedia(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "media"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteMedia,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "media"] }),
  });

  function copyPath(id: number, filename: string) {
    const url = `/uploads/${filename}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => uploadMutation.mutate(f));
  }

  if (isLoading)
    return <div className="p-6 text-[--color-muted]">Loading…</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Media Library</h1>
        <div className="flex gap-3 items-center">
          {uploadMutation.isPending && (
            <span className="text-xs text-[--color-muted] animate-pulse">
              Uploading…
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-accent px-4 py-2 rounded text-sm"
          >
            + Upload
          </button>
        </div>
      </div>

      {/* Drop zone (visual hint, actual click handled by button) */}
      <div
        className="border-2 border-dashed border-[--color-border] rounded-lg p-8 text-center mb-6 text-[--color-muted] text-sm hover:border-[--color-accent] transition-colors cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
      >
        Drop images here or click to browse
      </div>

      {/* Grid */}
      {files.length === 0 ? (
        <div className="text-center text-[--color-muted] text-sm py-12">
          No media files yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map((file) => {
            const isImage = file.mime_type.startsWith("image/");
            const url = `/uploads/${file.filename}`;
            return (
              <div
                key={file.id}
                className="group bg-[--color-bg-surface] rounded-lg shadow overflow-hidden flex flex-col border border-[--color-border]"
              >
                <div className="h-36 bg-[--color-bg] flex items-center justify-center overflow-hidden">
                  {isImage ? (
                    <img
                      src={url}
                      alt={file.original_name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl text-gray-300">📄</span>
                  )}
                </div>
                <div className="p-2 flex-1 flex flex-col justify-between">
                  <p
                    className="text-xs text-[--color-text] truncate"
                    title={file.original_name}
                  >
                    {file.original_name}
                  </p>
                  <p className="text-xs text-[--color-muted]">
                    {formatBytes(file.size_bytes)}
                  </p>
                </div>
                <div className="border-t border-[--color-border] flex divide-x divide-[--color-border]">
                  <button
                    onClick={() => copyPath(file.id, file.filename)}
                    className="flex-1 text-xs py-1.5 text-center text-accent hover:bg-[--color-bg] transition-colors"
                  >
                    {copied === file.id ? "✓ Copied" : "Copy path"}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm("Delete this file?"))
                        deleteMutation.mutate(file.id);
                    }}
                    className="flex-1 text-xs py-1.5 text-center text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-6">
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
