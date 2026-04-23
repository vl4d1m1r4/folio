import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { MediaFile } from "../../api/types";

interface Props {
  /** "image" restricts to image/* mimes; "any" shows all files */
  mode?: "image" | "any";
  onSelect: (file: MediaFile) => void;
  onClose: () => void;
}

type Tab = "library" | "upload";

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaPickerModal({ mode = "image", onSelect, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("library");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<MediaFile | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "media", page],
    queryFn: () => adminApi.listMedia(page),
  });

  const files = (data?.items ?? []).filter((f) =>
    mode === "image" ? f.mime_type.startsWith("image/") : true,
  );
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.limit ?? 20));

  const uploadMutation = useMutation({
    mutationFn: (file: File) => adminApi.uploadMedia(file),
    onSuccess: (uploaded) => {
      qc.invalidateQueries({ queryKey: ["admin", "media"] });
      setSelected(uploaded);
      setTab("library");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[--color-bg-surface] rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh] border border-[--color-border]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[--color-border]">
          <h2 className="font-semibold">Select Media</h2>
          <button
            onClick={onClose}
            className="text-[--color-muted] hover:text-[--color-text] text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[--color-border] px-6">
          {(["library", "upload"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`mr-6 py-2 text-sm border-b-2 transition-colors capitalize ${
                tab === t
                  ? "border-[--color-accent] text-accent font-medium"
                  : "border-transparent text-[--color-muted]"
              }`}
            >
              {t === "library" ? "Media Library" : "Upload New"}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === "upload" && (
            <div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept={mode === "image" ? "image/*" : "*"}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMutation.mutate(f);
                }}
              />
              <div
                className="border-2 border-dashed border-[--color-border] rounded-lg py-16 text-center cursor-pointer hover:border-[--color-accent] transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) uploadMutation.mutate(f);
                }}
              >
                {uploadMutation.isPending ? (
                  <p className="text-[--color-muted] animate-pulse">
                    Uploading…
                  </p>
                ) : (
                  <>
                    <p className="text-[--color-muted]">
                      Drop a file here or click to browse
                    </p>
                    <p className="text-xs text-[--color-border] mt-1">
                      {mode === "image" ? "Images only" : "Any file"}
                    </p>
                  </>
                )}
              </div>
              {uploadMutation.isError && (
                <p className="mt-3 text-sm text-red-600">
                  {(uploadMutation.error as Error).message}
                </p>
              )}
            </div>
          )}

          {tab === "library" && (
            <div>
              {isLoading ? (
                <p className="text-[--color-muted] text-sm text-center py-8">
                  Loading…
                </p>
              ) : files.length === 0 ? (
                <p className="text-[--color-muted] text-sm text-center py-8">
                  No files yet. Upload one first.
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {files.map((f) => {
                    const isImg = f.mime_type.startsWith("image/");
                    const isSelected = selected?.id === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setSelected(f)}
                        className={`border-2 rounded-lg overflow-hidden transition-all group ${
                          isSelected
                            ? "border-[--color-accent] ring-2 ring-[--color-accent]"
                            : "border-transparent hover:border-[--color-border]"
                        }`}
                      >
                        <div className="h-24 bg-[--color-bg] flex items-center justify-center overflow-hidden">
                          {isImg ? (
                            <img
                              src={`/uploads/${f.filename}`}
                              alt={f.original_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl text-gray-300">📄</span>
                          )}
                        </div>
                        <div className="p-1.5 text-left">
                          <p className="text-xs text-[--color-text] truncate">
                            {f.original_name}
                          </p>
                          <p className="text-xs text-[--color-muted]">
                            {formatBytes(f.size_bytes)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[--color-border] bg-[--color-bg-surface]">
          <span className="text-sm text-[--color-muted]">
            {selected ? selected.original_name : "No file selected"}
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[--color-border] rounded text-[--color-muted] hover:bg-[--color-bg]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selected) onSelect(selected);
              }}
              disabled={!selected}
              className="px-4 py-2 text-sm btn-accent rounded disabled:opacity-40"
            >
              Select
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
