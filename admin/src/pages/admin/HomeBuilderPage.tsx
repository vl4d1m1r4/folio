import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { HomeBlock, BlockType, Language } from "../../api/types";
import { RichTextEditor } from "../../components/admin/RichTextEditor";
import { MediaPickerModal } from "../../components/admin/MediaPickerModal";
import {
  BLOCK_LABELS,
  applyContainerDefaults,
  ContainerConfigPopover,
  AddBlockModal,
  Field,
} from "../../components/admin/blockShared";

function makeBlock(type: BlockType, order: number): HomeBlock {
  const id = `${type}-${Date.now()}`;
  const config: Record<string, unknown> = {};
  if (type === "featured-articles" || type === "latest-articles")
    config.max_count = 6;
  if (type === "image-text") config.image_position = "left";
  if (type === "container") applyContainerDefaults(config);
  return {
    id,
    type,
    visible: true,
    order,
    config,
    translations: {},
    children: type === "container" ? [] : undefined,
  };
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HomeBuilderPage() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  useEffect(() => {
    if (settings?.home_sections) setBlocks(settings.home_sections);
  }, [settings]);

  useEffect(() => {
    if (languages.length > 0)
      setActiveLang(
        languages.find((l) => l.default)?.code ?? languages[0].code,
      );
  }, [languages]);

  const saveMutation = useMutation({
    mutationFn: (home_sections: HomeBlock[]) =>
      adminApi.saveSettings({ home_sections } as any),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  function updateBlock(id: string, patch: Partial<HomeBlock>) {
    setBlocks((prev) => patchBlocks(prev, id, patch));
  }

  function removeBlock(id: string) {
    setBlocks((prev) => withNormalizedOrder(removeFromBlocks(prev, id)));
  }

  function moveBlock(id: string, dir: "up" | "down") {
    setBlocks((prev) => withNormalizedOrder(moveInBlocks(prev, id, dir)));
  }

  function dropBlock(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === dragId);
      const to = prev.findIndex((b) => b.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return withNormalizedOrder(next);
    });
    setDragId(null);
    setDragOverId(null);
  }

  function addBlock(type: BlockType, parentId: string | null) {
    if (parentId) {
      setBlocks((prev) => {
        const parent = findBlock(prev, parentId);
        if (!parent) return prev;
        const newBlock = makeBlock(type, parent.children?.length ?? 0);
        return patchBlocks(prev, parentId, {
          children: [...(parent.children ?? []), newBlock],
        });
      });
    } else {
      setBlocks((prev) =>
        withNormalizedOrder([...prev, makeBlock(type, prev.length)]),
      );
    }
    setAddModalOpen(false);
    setAddParentId(null);
  }

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Home Page Builder</h1>
        <div className="flex items-center gap-3">
          {saved && (
            <span className="text-sm text-(--color-success)">Saved ✓</span>
          )}
          <button
            onClick={() => saveMutation.mutate(blocks)}
            disabled={saveMutation.isPending}
            className="px-4 py-2 text-sm text-white rounded disabled:opacity-50"
            style={{ background: "var(--color-accent)" }}
          >
            {saveMutation.isPending ? "Saving…" : "Save & Rebuild"}
          </button>
        </div>
      </div>

      {serverError && (
        <div className="mb-4 p-3 rounded border border-(--color-destructive) text-(--color-destructive) text-sm">
          {serverError}
        </div>
      )}

      {languages.length > 1 && (
        <div className="flex gap-1 mb-4">
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => setActiveLang(l.code)}
              className={`px-3 py-1 text-xs rounded font-medium border ${
                activeLang === l.code
                  ? "bg-(--color-accent) text-white border-(--color-accent)"
                  : "border-(--color-border) text-(--color-muted) hover:text-(--color-text)"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {blocks.map((block, idx) => (
          <BlockCard
            key={block.id}
            block={block}
            idx={idx}
            total={blocks.length}
            languages={languages}
            onUpdate={(patch) => updateBlock(block.id, patch)}
            onRemove={() => removeBlock(block.id)}
            onMove={(dir) => moveBlock(block.id, dir)}
            activeLang={activeLang}
            onAddChild={() => {
              setAddParentId(block.id);
              setAddModalOpen(true);
            }}
            isDragOver={dragOverId === block.id}
            onDragStart={() => setDragId(block.id)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverId(block.id);
            }}
            onDrop={() => dropBlock(block.id)}
            onDragEnd={() => {
              setDragId(null);
              setDragOverId(null);
            }}
          />
        ))}
      </div>

      <button
        onClick={() => {
          setAddParentId(null);
          setAddModalOpen(true);
        }}
        className="mt-4 text-sm text-(--color-accent) hover:underline"
      >
        + Add block
      </button>

      {addModalOpen && (
        <AddBlockModal
          onSelect={(type) => addBlock(type, addParentId)}
          onClose={() => {
            setAddModalOpen(false);
            setAddParentId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Block card ────────────────────────────────────────────────────────────────

function BlockCard({
  block,
  idx,
  total,
  languages,
  activeLang,
  onUpdate,
  onRemove,
  onMove,
  onAddChild,
  isDragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  block: HomeBlock;
  idx: number;
  total: number;
  languages: Language[];
  activeLang: string;
  onUpdate: (patch: Partial<HomeBlock>) => void;
  onRemove: () => void;
  onMove: (dir: "up" | "down") => void;
  onAddChild: () => void;
  isDragOver?: boolean;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [addChildModal, setAddChildModal] = useState<string | null>(null);
  const [childDragId, setChildDragId] = useState<string | null>(null);
  const [childDragOverId, setChildDragOverId] = useState<string | null>(null);

  function dropChild(targetId: string) {
    if (!childDragId || childDragId === targetId) return;
    const children = block.children ?? [];
    const from = children.findIndex((c) => c.id === childDragId);
    const to = children.findIndex((c) => c.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...children];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onUpdate({ children: next.map((c, i) => ({ ...c, order: i })) });
    setChildDragId(null);
    setChildDragOverId(null);
  }

  const trans = block.translations[activeLang] ?? {};

  function setTrans(key: string, value: string) {
    onUpdate({
      translations: {
        ...block.translations,
        [activeLang]: { ...trans, [key]: value },
      },
    });
  }

  function setConfig(key: string, value: unknown) {
    onUpdate({ config: { ...block.config, [key]: value } });
  }

  return (
    <div
      className={`rounded border bg-(--color-bg-surface) transition-colors ${
        isDragOver
          ? "border-(--color-accent) ring-2 ring-(--color-accent)/20"
          : "border-(--color-border)"
      }`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Drag handle */}
        <div
          draggable
          onDragStart={onDragStart}
          className="cursor-grab active:cursor-grabbing text-(--color-muted) hover:text-(--color-text) select-none px-0.5 text-base leading-none"
          title="Drag to reorder"
        >
          ⠿
        </div>

        <div className="flex flex-col gap-0.5">
          <button
            onClick={() => onMove("up")}
            disabled={idx === 0}
            className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text) leading-none"
          >
            ▲
          </button>
          <button
            onClick={() => onMove("down")}
            disabled={idx === total - 1}
            className="text-xs text-(--color-muted) disabled:opacity-30 hover:text-(--color-text) leading-none"
          >
            ▼
          </button>
        </div>

        <button
          onClick={() => onUpdate({ visible: !block.visible })}
          title={block.visible ? "Hide block" : "Show block"}
          className={`text-sm ${block.visible ? "text-(--color-success)" : "text-(--color-muted)"}`}
        >
          {block.visible ? "●" : "○"}
        </button>

        <span className="flex-1 text-sm font-medium">
          {BLOCK_LABELS[block.type]}
        </span>

        {block.type === "container" && (
          <ContainerConfigPopover config={block.config} setConfig={setConfig} />
        )}

        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-(--color-accent) hover:underline"
        >
          {expanded ? "Collapse" : "Edit"}
        </button>
        <button
          onClick={() => {
            if (confirm("Remove this block?")) onRemove();
          }}
          className="text-xs text-(--color-destructive) hover:underline"
        >
          Remove
        </button>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-(--color-border) pt-3">
          {block.type !== "container" && (
            <BlockFields
              block={block}
              trans={trans}
              setTrans={setTrans}
              setConfig={setConfig}
            />
          )}

          {/* Container children */}
          {block.type === "container" && (block.children ?? []).length > 0 && (
            <div className="pl-4 border-l-2 border-(--color-border) space-y-2">
              {(block.children ?? []).map((child, ci) => (
                <BlockCard
                  key={child.id}
                  block={child}
                  idx={ci}
                  total={(block.children ?? []).length}
                  languages={languages}
                  activeLang={activeLang}
                  onUpdate={(patch) => {
                    const next = (block.children ?? []).map((c, i) =>
                      i === ci ? { ...c, ...patch } : c,
                    );
                    onUpdate({ children: next });
                  }}
                  onRemove={() => {
                    onUpdate({
                      children: (block.children ?? []).filter(
                        (_, i) => i !== ci,
                      ),
                    });
                  }}
                  onMove={(dir) => {
                    const arr = [...(block.children ?? [])];
                    const ni = dir === "up" ? ci - 1 : ci + 1;
                    if (ni < 0 || ni >= arr.length) return;
                    [arr[ci], arr[ni]] = [arr[ni], arr[ci]];
                    onUpdate({ children: arr });
                  }}
                  onAddChild={() => setAddChildModal(child.id)}
                  isDragOver={childDragOverId === child.id}
                  onDragStart={() => setChildDragId(child.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setChildDragOverId(child.id);
                  }}
                  onDrop={() => dropChild(child.id)}
                  onDragEnd={() => {
                    setChildDragId(null);
                    setChildDragOverId(null);
                  }}
                />
              ))}
            </div>
          )}
          {block.type === "container" && (
            <button
              type="button"
              onClick={onAddChild}
              className="mt-3 text-sm text-(--color-accent) hover:underline"
            >
              + Add child block
            </button>
          )}
          {addChildModal && (
            <AddBlockModal
              onSelect={(type) => {
                const target = (block.children ?? []).find(
                  (c) => c.id === addChildModal,
                );
                if (!target) return;
                const newChild = makeBlock(type, target.children?.length ?? 0);
                const next = (block.children ?? []).map((c) =>
                  c.id === addChildModal
                    ? { ...c, children: [...(c.children ?? []), newChild] }
                    : c,
                );
                onUpdate({ children: next });
                setAddChildModal(null);
              }}
              onClose={() => setAddChildModal(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Per-block field renderers ─────────────────────────────────────────────────

function BlockFields({
  block,
  trans,
  setTrans,
  setConfig,
}: {
  block: HomeBlock;
  trans: Record<string, string>;
  setTrans: (key: string, value: string) => void;
  setConfig: (key: string, value: unknown) => void;
}) {
  const [mediaPicker, setMediaPicker] = useState<boolean | "bg_image">(false);

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <Field
            label="Headline"
            value={trans.headline ?? ""}
            onChange={(v) => setTrans("headline", v)}
          />
          <Field
            label="Subheadline"
            value={trans.subheadline ?? ""}
            onChange={(v) => setTrans("subheadline", v)}
          />
          <Field
            label="CTA button label"
            value={trans.cta_label ?? ""}
            onChange={(v) => setTrans("cta_label", v)}
          />
          <Field
            label="CTA button URL"
            value={trans.cta_url ?? ""}
            onChange={(v) => setTrans("cta_url", v)}
          />
          {/* Background image */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Background image
            </label>
            <div className="flex gap-2 items-center">
              {!!(block.config.bg_image as string) && (
                <img
                  src={block.config.bg_image as string}
                  alt=""
                  className="h-10 w-16 object-cover rounded border border-(--color-border)"
                />
              )}
              <button
                onClick={() => setMediaPicker("bg_image")}
                className="px-3 py-1.5 text-xs border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
              >
                {block.config.bg_image ? "Change image" : "Pick image"}
              </button>
              {!!(block.config.bg_image as string) && (
                <button
                  onClick={() => setConfig("bg_image", "")}
                  className="text-xs text-(--color-destructive)"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {mediaPicker === "bg_image" && (
            <MediaPickerModal
              onSelect={(file) => {
                setConfig("bg_image", `/uploads/${file.filename}`);
                setMediaPicker(false);
              }}
              onClose={() => setMediaPicker(false)}
            />
          )}
        </div>
      );

    case "featured-articles":
    case "latest-articles":
      return (
        <div className="space-y-3">
          <Field
            label="Section title"
            value={trans.title ?? ""}
            onChange={(v) => setTrans("title", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Max items</label>
            <input
              type="number"
              min={1}
              max={20}
              value={(block.config.max_count as number) ?? 6}
              onChange={(e) => setConfig("max_count", Number(e.target.value))}
              className="w-24 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            />
          </div>
        </div>
      );

    case "cta-band":
      return (
        <div className="space-y-3">
          <Field
            label="Headline"
            value={trans.headline ?? ""}
            onChange={(v) => setTrans("headline", v)}
          />
          <Field
            label="Body text"
            value={trans.body ?? ""}
            onChange={(v) => setTrans("body", v)}
          />
          <Field
            label="CTA label"
            value={trans.cta_label ?? ""}
            onChange={(v) => setTrans("cta_label", v)}
          />
          <Field
            label="CTA URL"
            value={trans.cta_url ?? ""}
            onChange={(v) => setTrans("cta_url", v)}
          />
        </div>
      );

    case "rich-text":
      return (
        <RichTextEditor
          value={trans.content ?? ""}
          onChange={(v) => setTrans("content", v)}
        />
      );

    case "image-text":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Image</label>
            <div className="flex gap-2 items-center">
              {!!(block.config.image_url as string) && (
                <img
                  src={block.config.image_url as string}
                  alt=""
                  className="h-12 w-12 object-cover rounded"
                />
              )}
              <button
                onClick={() => setMediaPicker(true)}
                className="px-3 py-1.5 text-xs border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
              >
                {block.config.image_url ? "Change image" : "Pick image"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Image position
            </label>
            <select
              value={(block.config.image_position as string) ?? "left"}
              onChange={(e) => setConfig("image_position", e.target.value)}
              className="px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <Field
            label="Headline"
            value={trans.headline ?? ""}
            onChange={(v) => setTrans("headline", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Body text</label>
            <RichTextEditor
              value={trans.body ?? ""}
              onChange={(v) => setTrans("body", v)}
            />
          </div>
          {mediaPicker === true && (
            <MediaPickerModal
              onSelect={(file) => {
                setConfig("image_url", `/uploads/${file.filename}`);
                setMediaPicker(false);
              }}
              onClose={() => setMediaPicker(false)}
            />
          )}
        </div>
      );

    case "testimonials":
      return (
        <TestimonialsFields
          block={block}
          trans={trans}
          setTrans={setTrans}
          setConfig={setConfig}
        />
      );

    case "newsletter":
      return (
        <div className="space-y-3">
          <Field
            label="Headline"
            value={trans.headline ?? ""}
            onChange={(v) => setTrans("headline", v)}
          />
          <Field
            label="Body text"
            value={trans.body ?? ""}
            onChange={(v) => setTrans("body", v)}
          />
          <Field
            label="Email placeholder"
            value={trans.placeholder ?? ""}
            onChange={(v) => setTrans("placeholder", v)}
          />
          <Field
            label="Button label"
            value={trans.button_label ?? ""}
            onChange={(v) => setTrans("button_label", v)}
          />
          <Field
            label="Success message"
            value={trans.success_message ?? ""}
            onChange={(v) => setTrans("success_message", v)}
          />
        </div>
      );

    case "container":
      return null;

    default:
      return null;
  }
}

// ── Testimonials sub-editor ───────────────────────────────────────────────────

function TestimonialsFields({
  block,
  trans,
  setTrans,
  setConfig,
}: {
  block: HomeBlock;
  trans: Record<string, string>;
  setTrans: (key: string, value: string) => void;
  setConfig: (key: string, value: unknown) => void;
}) {
  type Testimonial = { quote: string; author: string; role: string };
  const items: Testimonial[] = (block.config.items as Testimonial[]) ?? [];

  function update(idx: number, patch: Partial<Testimonial>) {
    const next = items.map((item, i) =>
      i === idx ? { ...item, ...patch } : item,
    );
    setConfig("items", next);
  }
  function add() {
    setConfig("items", [...items, { quote: "", author: "", role: "" }]);
  }
  function remove(idx: number) {
    setConfig(
      "items",
      items.filter((_, i) => i !== idx),
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Section title"
        value={trans.title ?? ""}
        onChange={(v) => setTrans("title", v)}
      />
      {items.map((item, idx) => (
        <div
          key={idx}
          className="p-3 rounded border border-(--color-border) space-y-2"
        >
          <div>
            <label className="text-xs font-medium">Quote</label>
            <textarea
              rows={2}
              value={item.quote}
              onChange={(e) => update(idx, { quote: e.target.value })}
              className="w-full mt-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Author</label>
              <input
                type="text"
                value={item.author}
                onChange={(e) => update(idx, { author: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
            </div>
            <div>
              <label className="text-xs font-medium">Role</label>
              <input
                type="text"
                value={item.role}
                onChange={(e) => update(idx, { role: e.target.value })}
                className="w-full mt-1 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
              />
            </div>
          </div>
          <button
            onClick={() => remove(idx)}
            className="text-xs text-(--color-destructive) hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={add}
        className="text-sm text-(--color-accent) hover:underline"
      >
        + Add testimonial
      </button>
    </div>
  );
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function withNormalizedOrder(blocks: HomeBlock[]): HomeBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

function findBlock(blocks: HomeBlock[], id: string): HomeBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      const found = findBlock(b.children, id);
      if (found) return found;
    }
  }
  return null;
}

function patchBlocks(
  blocks: HomeBlock[],
  id: string,
  patch: Partial<HomeBlock>,
): HomeBlock[] {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch };
    if (b.children)
      return { ...b, children: patchBlocks(b.children, id, patch) };
    return b;
  });
}

function removeFromBlocks(blocks: HomeBlock[], id: string): HomeBlock[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) =>
      b.children ? { ...b, children: removeFromBlocks(b.children, id) } : b,
    );
}

function moveInBlocks(
  blocks: HomeBlock[],
  id: string,
  dir: "up" | "down",
): HomeBlock[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx !== -1) {
    const ni = dir === "up" ? idx - 1 : idx + 1;
    if (ni < 0 || ni >= blocks.length) return blocks;
    const next = [...blocks];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    return next;
  }
  return blocks.map((b) =>
    b.children ? { ...b, children: moveInBlocks(b.children, id, dir) } : b,
  );
}
