/**
 * PageBlockBuilder — drag-and-drop block editor for custom pages.
 *
 * Unlike HomeBuilderPage, blocks here are already language-specific:
 * all text fields live directly in `block.config` (no translations sub-object).
 */
import { useState } from "react";
import type { BlockType, PageBlock } from "../../api/types";
import { RichTextEditor } from "./RichTextEditor";
import { MediaPickerModal } from "./MediaPickerModal";
import {
  BLOCK_LABELS,
  applyContainerDefaults,
  ContainerConfigPopover,
  AddBlockModal,
  Field,
} from "./blockShared";

function makeBlock(type: BlockType, order: number): PageBlock {
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
    children: type === "container" ? [] : undefined,
  };
}

function withNormalizedOrder(blocks: PageBlock[]): PageBlock[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

function patchBlocks(
  blocks: PageBlock[],
  id: string,
  patch: Partial<PageBlock>,
): PageBlock[] {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch };
    if (b.children)
      return { ...b, children: patchBlocks(b.children, id, patch) };
    return b;
  });
}

function removeFromBlocks(blocks: PageBlock[], id: string): PageBlock[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) =>
      b.children ? { ...b, children: removeFromBlocks(b.children, id) } : b,
    );
}

function moveInBlocks(
  blocks: PageBlock[],
  id: string,
  dir: "up" | "down",
): PageBlock[] {
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

function findBlock(blocks: PageBlock[], id: string): PageBlock | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      const found = findBlock(b.children, id);
      if (found) return found;
    }
  }
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
}

export function PageBlockBuilder({ blocks, onChange }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);

  function update(id: string, patch: Partial<PageBlock>) {
    onChange(patchBlocks(blocks, id, patch));
  }
  function remove(id: string) {
    onChange(withNormalizedOrder(removeFromBlocks(blocks, id)));
  }
  function move(id: string, dir: "up" | "down") {
    onChange(withNormalizedOrder(moveInBlocks(blocks, id, dir)));
  }
  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = blocks.findIndex((b) => b.id === dragId);
    const to = blocks.findIndex((b) => b.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...blocks];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(withNormalizedOrder(next));
    setDragId(null);
    setDragOverId(null);
  }
  function addBlock(type: BlockType, parentId: string | null) {
    if (parentId) {
      const parent = findBlock(blocks, parentId);
      if (!parent) return;
      const newBlock = makeBlock(type, parent.children?.length ?? 0);
      onChange(
        patchBlocks(blocks, parentId, {
          children: [...(parent.children ?? []), newBlock],
        }),
      );
    } else {
      onChange(
        withNormalizedOrder([...blocks, makeBlock(type, blocks.length)]),
      );
    }
    setAddModalOpen(false);
    setAddParentId(null);
  }

  return (
    <div className="space-y-3">
      {blocks.map((block, idx) => (
        <BlockCard
          key={block.id}
          block={block}
          idx={idx}
          total={blocks.length}
          onUpdate={(patch) => update(block.id, patch)}
          onRemove={() => remove(block.id)}
          onMove={(dir) => move(block.id, dir)}
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
          onDrop={() => drop(block.id)}
          onDragEnd={() => {
            setDragId(null);
            setDragOverId(null);
          }}
        />
      ))}

      <button
        type="button"
        onClick={() => {
          setAddParentId(null);
          setAddModalOpen(true);
        }}
        className="text-sm text-(--color-accent) hover:underline"
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

// ── Block card ─────────────────────────────────────────────────────────────────

function BlockCard({
  block,
  idx,
  total,
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
  block: PageBlock;
  idx: number;
  total: number;
  onUpdate: (patch: Partial<PageBlock>) => void;
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
  const [addChildModal, setAddChildModal] = useState<string | null>(null); // child block id to add into
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

  function setConfig(key: string, value: unknown) {
    onUpdate({ config: { ...block.config, [key]: value } });
  }

  return (
    <div
      className={`rounded border bg-(--color-bg-surface) transition-colors ${isDragOver ? "border-(--color-accent) ring-2 ring-(--color-accent)/20" : "border-(--color-border)"}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <div className="flex items-center gap-2 px-3 py-2">
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
            className="text-xs text-(--color-muted) disabled:opacity-30 leading-none"
          >
            ▲
          </button>
          <button
            onClick={() => onMove("down")}
            disabled={idx === total - 1}
            className="text-xs text-(--color-muted) disabled:opacity-30 leading-none"
          >
            ▼
          </button>
        </div>
        <button
          onClick={() => onUpdate({ visible: !block.visible })}
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

      {expanded && (
        <div className="px-3 pb-3 border-t border-(--color-border) pt-3">
          {block.type !== "container" && (
            <BlockFields
              block={block}
              setConfig={setConfig}
              onUpdate={onUpdate}
            />
          )}

          {block.type === "container" && (block.children ?? []).length > 0 && (
            <div className="pl-4 border-l-2 border-(--color-border) space-y-2">
              {(block.children ?? []).map((child, ci) => (
                <BlockCard
                  key={child.id}
                  block={child}
                  idx={ci}
                  total={(block.children ?? []).length}
                  onUpdate={(patch) => {
                    const next = (block.children ?? []).map((c, i) =>
                      i === ci ? { ...c, ...patch } : c,
                    );
                    onUpdate({ children: next });
                  }}
                  onRemove={() =>
                    onUpdate({
                      children: (block.children ?? []).filter(
                        (_, i) => i !== ci,
                      ),
                    })
                  }
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

// ── Per-block field editors ────────────────────────────────────────────────────

function BlockFields({
  block,
  setConfig,
  onUpdate: _onUpdate,
}: {
  block: PageBlock;
  setConfig: (key: string, value: unknown) => void;
  onUpdate: (patch: Partial<PageBlock>) => void;
}) {
  const [mediaPicker, setMediaPicker] = useState(false);
  const c = block.config;

  switch (block.type) {
    case "hero":
      return (
        <div className="space-y-3">
          <Field
            label="Headline"
            value={(c.headline as string) ?? ""}
            onChange={(v) => setConfig("headline", v)}
          />
          <Field
            label="Subheadline"
            value={(c.subheadline as string) ?? ""}
            onChange={(v) => setConfig("subheadline", v)}
          />
          <Field
            label="CTA button label"
            value={(c.cta_label as string) ?? ""}
            onChange={(v) => setConfig("cta_label", v)}
          />
          <Field
            label="CTA button URL"
            value={(c.cta_url as string) ?? ""}
            onChange={(v) => setConfig("cta_url", v)}
          />
        </div>
      );

    case "featured-articles":
    case "latest-articles":
      return (
        <div className="space-y-3">
          <Field
            label="Section title"
            value={(c.title as string) ?? ""}
            onChange={(v) => setConfig("title", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Max items</label>
            <input
              type="number"
              min={1}
              max={20}
              value={(c.max_count as number) ?? 6}
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
            value={(c.headline as string) ?? ""}
            onChange={(v) => setConfig("headline", v)}
          />
          <Field
            label="Body text"
            value={(c.body as string) ?? ""}
            onChange={(v) => setConfig("body", v)}
          />
          <Field
            label="CTA label"
            value={(c.cta_label as string) ?? ""}
            onChange={(v) => setConfig("cta_label", v)}
          />
          <Field
            label="CTA URL"
            value={(c.cta_url as string) ?? ""}
            onChange={(v) => setConfig("cta_url", v)}
          />
        </div>
      );

    case "rich-text":
      return (
        <RichTextEditor
          value={(c.content as string) ?? ""}
          onChange={(v) => setConfig("content", v)}
        />
      );

    case "image-text":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Image</label>
            <div className="flex gap-2 items-center">
              {Boolean(c.image_url) && (
                <img
                  src={c.image_url as string}
                  alt=""
                  className="h-12 w-12 object-cover rounded"
                />
              )}
              <button
                type="button"
                onClick={() => setMediaPicker(true)}
                className="px-3 py-1.5 text-xs border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
              >
                {c.image_url ? "Change image" : "Pick image"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Image position
            </label>
            <select
              value={(c.image_position as string) ?? "left"}
              onChange={(e) => setConfig("image_position", e.target.value)}
              className="px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <Field
            label="Headline"
            value={(c.headline as string) ?? ""}
            onChange={(v) => setConfig("headline", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Body text</label>
            <RichTextEditor
              value={(c.body as string) ?? ""}
              onChange={(v) => setConfig("body", v)}
            />
          </div>
          {mediaPicker && (
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
      return <TestimonialsFields block={block} setConfig={setConfig} />;

    case "newsletter":
      return (
        <div className="space-y-3">
          <Field
            label="Headline"
            value={(c.headline as string) ?? ""}
            onChange={(v) => setConfig("headline", v)}
          />
          <Field
            label="Body text"
            value={(c.body as string) ?? ""}
            onChange={(v) => setConfig("body", v)}
          />
          <Field
            label="Email placeholder"
            value={(c.placeholder as string) ?? ""}
            onChange={(v) => setConfig("placeholder", v)}
          />
          <Field
            label="Button label"
            value={(c.button_label as string) ?? ""}
            onChange={(v) => setConfig("button_label", v)}
          />
          <Field
            label="Success message"
            value={(c.success_message as string) ?? ""}
            onChange={(v) => setConfig("success_message", v)}
          />
        </div>
      );

    case "container":
      return null;

    default:
      return null;
  }
}

// ── Testimonials sub-editor ────────────────────────────────────────────────────

function TestimonialsFields({
  block,
  setConfig,
}: {
  block: PageBlock;
  setConfig: (key: string, value: unknown) => void;
}) {
  type Testimonial = { quote: string; author: string; role: string };
  const items: Testimonial[] = (block.config.items as Testimonial[]) ?? [];

  function update(idx: number, patch: Partial<Testimonial>) {
    setConfig(
      "items",
      items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    );
  }

  return (
    <div className="space-y-3">
      <Field
        label="Section title"
        value={(block.config.title as string) ?? ""}
        onChange={(v) => setConfig("title", v)}
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
            onClick={() =>
              setConfig(
                "items",
                items.filter((_, i) => i !== idx),
              )
            }
            className="text-xs text-(--color-destructive) hover:underline"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={() =>
          setConfig("items", [...items, { quote: "", author: "", role: "" }])
        }
        className="text-sm text-(--color-accent) hover:underline"
      >
        + Add testimonial
      </button>
    </div>
  );
}
