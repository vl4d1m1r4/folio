import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useState, useEffect } from "react";
import { MediaPickerModal } from "./MediaPickerModal";

interface Props {
  value: string;
  onChange: (html: string) => void;
}

function ToolbarButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      title={title}
      className={`px-2 py-1 rounded text-sm transition-colors ${
        active
          ? "bg-(--color-accent) text-white"
          : "hover:bg-(--color-bg) text-(--color-text)"
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ value, onChange }: Props) {
  const [linkUrl, setLinkUrl] = useState("");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ inline: false }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-blue-600 underline" },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        // "prose" class uses the CSS we added to index.css — same rules as the site
        class: "prose max-w-none min-h-64 p-5 focus:outline-none",
      },
    },
  });

  // Sync editor content when the value prop changes externally (e.g. language switch)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value ?? "", false);
    }
  }, [value, editor]);

  if (!editor) return null;

  function applyLink() {
    if (!linkUrl.trim()) {
      editor!.chain().focus().unsetLink().run();
    } else {
      editor!.chain().focus().setLink({ href: linkUrl.trim() }).run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }

  function openLinkInput() {
    // Save selection before the toolbar button blurs the editor
    const existing = editor!.getAttributes("link").href ?? "";
    setLinkUrl(existing);
    setShowLinkInput(true);
  }

  function openMediaPicker() {
    setShowMediaPicker(true);
  }

  function insertImage(filename: string) {
    const src = `/uploads/${filename}`;
    editor!.chain().focus().setImage({ src }).run();
    setShowMediaPicker(false);
  }

  return (
    <div className="border border-(--color-border) rounded-lg overflow-hidden bg-(--color-bg)">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-(--color-border) bg-(--color-bg-surface)">
        <ToolbarButton
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          title="Heading 2"
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          title="Heading 3"
        >
          H3
        </ToolbarButton>
        <span className="w-px bg-(--color-border) mx-1 self-stretch" />
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        >
          1. List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          title="Blockquote"
        >
          " Quote
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("code")}
          onClick={() => editor.chain().focus().toggleCode().run()}
          title="Inline code"
        >
          {"<>"}
        </ToolbarButton>
        <span className="w-px bg-(--color-border) mx-1 self-stretch" />
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={openLinkInput}
          title="Insert / edit link"
        >
          🔗 Link
        </ToolbarButton>
        <ToolbarButton
          onClick={openMediaPicker}
          title="Insert image from media library"
        >
          🖼 Image
        </ToolbarButton>
        <span className="w-px bg-(--color-border) mx-1 self-stretch" />
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          ↪
        </ToolbarButton>
      </div>

      {/* Link input bar */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 bg-(--color-bg-surface) border-b border-(--color-border)">
          <span className="text-xs text-(--color-muted) shrink-0">URL:</span>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 text-sm border border-(--color-border) rounded px-2 py-1 bg-(--color-bg) text-(--color-text) focus:outline-none focus:ring-2 focus:ring-(--color-accent)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") {
                setShowLinkInput(false);
              }
            }}
            autoFocus
          />
          {linkUrl && (
            <button
              type="button"
              onClick={() => {
                setLinkUrl("");
                applyLink();
              }}
              className="text-xs text-red-500 hover:text-red-700 shrink-0"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            onClick={applyLink}
            className="text-sm px-3 py-1 btn-accent rounded shrink-0"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="text-sm text-(--color-muted) hover:text-(--color-text)"
          >
            ✕
          </button>
        </div>
      )}

      <EditorContent editor={editor} />

      {/* Media picker modal for image insertion */}
      {showMediaPicker && (
        <MediaPickerModal
          mode="image"
          onSelect={(file) => insertImage(file.filename)}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
}
