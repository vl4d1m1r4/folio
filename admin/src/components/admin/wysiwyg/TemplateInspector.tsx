/**
 * Inspector for "template" block types (hero, cta-band, rich-text, etc.).
 * Handles both home mode (text in translations[lang]) and page mode (text in config).
 */
import { useState } from "react";
import type {
  HomeBlock,
  PageBlock,
  BlockType,
  NavLink,
  SocialLink,
} from "../../../api/types";
import { RichTextEditor } from "../RichTextEditor";
import { MediaPickerModal } from "../MediaPickerModal";
import { Field } from "../blockShared";
import { BLOCK_LABELS } from "../blockShared";
import { NavBlockInspector } from "./NavBlockInspector";
import {
  SpacingSection,
  ElementIdSection,
  CustomStyleSection,
} from "./InspectorShared";

interface TemplateInspectorProps {
  block: HomeBlock | PageBlock;
  mode: "home" | "page";
  activeLang: string;
  onConfigChange: (key: string, value: unknown) => void;
  onTransChange: (key: string, value: string) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}

export function TemplateInspector({
  block,
  mode,
  activeLang,
  onConfigChange,
  onTransChange,
  themeColors,
  navSnapshot,
  footerSnapshot,
  socialSnapshot,
}: TemplateInspectorProps) {
  const type = block.type as BlockType;

  // Derive text field value depending on mode
  const t = (key: string): string => {
    if (mode === "home") {
      const hb = block as HomeBlock;
      return (hb.translations[activeLang]?.[key] as string) ?? "";
    }
    return (block.config[key] as string) ?? "";
  };

  const setT = (key: string, value: string) => onTransChange(key, value);

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          {BLOCK_LABELS[type] ?? type} Settings
        </span>
      </div>
      <div className="p-3 overflow-y-auto space-y-3">
        <BlockTypeFields
          block={block}
          type={type}
          t={t}
          setT={setT}
          onConfigChange={onConfigChange}
          themeColors={themeColors}
          navSnapshot={navSnapshot}
          footerSnapshot={footerSnapshot}
          socialSnapshot={socialSnapshot}
        />
      </div>
    </div>
  );
}

// ── Per-type field forms ───────────────────────────────────────────────────────

function BlockTypeFields({
  block,
  type,
  t,
  setT,
  onConfigChange,
  themeColors,
  navSnapshot,
  footerSnapshot,
  socialSnapshot,
}: {
  block: HomeBlock | PageBlock;
  type: BlockType;
  t: (key: string) => string;
  setT: (key: string, value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}) {
  const [mediaPicker, setMediaPicker] = useState<string | null>(null);

  switch (type) {
    case "hero":
      return (
        <>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <Field
            label="Subheadline"
            value={t("subheadline")}
            onChange={(v) => setT("subheadline", v)}
          />
          <Field
            label="CTA label"
            value={t("cta_label")}
            onChange={(v) => setT("cta_label", v)}
          />
          <Field
            label="CTA URL"
            value={t("cta_url")}
            onChange={(v) => setT("cta_url", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">
              Background image
            </label>
            <ImagePickButton
              src={block.config.bg_image as string}
              onPick={() => setMediaPicker("bg_image")}
              onRemove={() => onConfigChange("bg_image", "")}
            />
          </div>
          {mediaPicker === "bg_image" && (
            <MediaPickerModal
              mode="image"
              onSelect={(f) => {
                onConfigChange("bg_image", `/uploads/${f.filename}`);
                setMediaPicker(null);
              }}
              onClose={() => setMediaPicker(null)}
            />
          )}
        </>
      );

    case "featured-articles":
    case "latest-articles":
      return (
        <>
          <Field
            label="Section title"
            value={t("title")}
            onChange={(v) => setT("title", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Max items</label>
            <input
              type="number"
              min={1}
              max={20}
              value={(block.config.max_count as number) ?? 6}
              onChange={(e) =>
                onConfigChange("max_count", Number(e.target.value))
              }
              className="w-24 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            />
          </div>
        </>
      );

    case "cta-band":
      return (
        <>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <Field
            label="Body"
            value={t("body")}
            onChange={(v) => setT("body", v)}
          />
          <Field
            label="CTA label"
            value={t("cta_label")}
            onChange={(v) => setT("cta_label", v)}
          />
          <Field
            label="CTA URL"
            value={t("cta_url")}
            onChange={(v) => setT("cta_url", v)}
          />
        </>
      );

    case "rich-text":
      return (
        <div className="divide-y divide-(--color-border)">
          <div className="px-3 py-2">
            <p className="text-[11px] text-(--color-muted) leading-relaxed">
              Double-click the block on the canvas to open the rich text editor.
            </p>
          </div>
          <div className="p-3 space-y-0 divide-y divide-(--color-border)">
            <SpacingSection config={block.config} onChange={onConfigChange} />
            <ElementIdSection config={block.config} onChange={onConfigChange} />
            <CustomStyleSection
              config={block.config}
              onChange={onConfigChange}
            />
          </div>
        </div>
      );

    case "image-text":
      return (
        <>
          <div>
            <label className="block text-xs font-medium mb-1">Image</label>
            <ImagePickButton
              src={block.config.image_url as string}
              onPick={() => setMediaPicker("image_url")}
              onRemove={() => onConfigChange("image_url", "")}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Image position
            </label>
            <select
              value={(block.config.image_position as string) ?? "left"}
              onChange={(e) => onConfigChange("image_position", e.target.value)}
              className="px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </div>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <div>
            <label className="block text-xs font-medium mb-1">Body</label>
            <RichTextEditor
              value={t("body")}
              onChange={(v) => setT("body", v)}
            />
          </div>
          {mediaPicker === "image_url" && (
            <MediaPickerModal
              mode="image"
              onSelect={(f) => {
                onConfigChange("image_url", `/uploads/${f.filename}`);
                setMediaPicker(null);
              }}
              onClose={() => setMediaPicker(null)}
            />
          )}
        </>
      );

    case "testimonials":
      return (
        <TestimonialsEditor
          block={block}
          t={t}
          setT={setT}
          onConfigChange={onConfigChange}
        />
      );

    case "newsletter":
      return (
        <>
          <Field
            label="Headline"
            value={t("headline")}
            onChange={(v) => setT("headline", v)}
          />
          <Field
            label="Body"
            value={t("body")}
            onChange={(v) => setT("body", v)}
          />
          <Field
            label="Email placeholder"
            value={t("placeholder")}
            onChange={(v) => setT("placeholder", v)}
          />
          <Field
            label="Button label"
            value={t("button_label")}
            onChange={(v) => setT("button_label", v)}
          />
          <Field
            label="Success message"
            value={t("success_message")}
            onChange={(v) => setT("success_message", v)}
          />
        </>
      );

    default:
      if (
        type === "nav-links" ||
        type === "subnav-links" ||
        type === "single-nav-item" ||
        type === "social-links" ||
        type === "single-social-link"
      ) {
        return (
          <NavBlockInspector
            type={type}
            config={block.config}
            onConfigChange={onConfigChange}
            themeColors={themeColors}
            navSnapshot={navSnapshot}
            footerSnapshot={footerSnapshot}
            socialSnapshot={socialSnapshot}
          />
        );
      }
      return (
        <p className="text-sm text-(--color-muted)">
          No editable fields for this block type.
        </p>
      );
  }
}

// ── Testimonials sub-editor ───────────────────────────────────────────────────

type Testimonial = { quote: string; author: string; role: string };

function TestimonialsEditor({
  block,
  t,
  setT,
  onConfigChange,
}: {
  block: HomeBlock | PageBlock;
  t: (key: string) => string;
  setT: (key: string, value: string) => void;
  onConfigChange: (key: string, value: unknown) => void;
}) {
  const items: Testimonial[] = (block.config.items as Testimonial[]) ?? [];

  function update(idx: number, patch: Partial<Testimonial>) {
    onConfigChange(
      "items",
      items.map((item, i) => (i === idx ? { ...item, ...patch } : item)),
    );
  }
  function add() {
    onConfigChange("items", [...items, { quote: "", author: "", role: "" }]);
  }
  function remove(idx: number) {
    onConfigChange(
      "items",
      items.filter((_, i) => i !== idx),
    );
  }

  return (
    <>
      <Field
        label="Section title"
        value={t("title")}
        onChange={(v) => setT("title", v)}
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
    </>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function ImagePickButton({
  src,
  onPick,
  onRemove,
}: {
  src: string | null | undefined;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-2 items-center">
      {!!src && (
        <img
          src={src}
          alt=""
          className="h-10 w-16 object-cover rounded border border-(--color-border)"
        />
      )}
      <button
        type="button"
        onClick={onPick}
        className="px-3 py-1.5 text-xs border border-(--color-border) rounded hover:bg-(--color-bg-surface)"
      >
        {src ? "Change image" : "Pick image"}
      </button>
      {!!src && (
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-(--color-destructive)"
        >
          Remove
        </button>
      )}
    </div>
  );
}
