import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { useState } from "react";
import { MediaPickerModal } from "./MediaPickerModal";

interface Props {
  content: string;
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
        active ? "bg-gray-700 text-white" : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({ content, onChange }: Props) {
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
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        // "prose" class uses the CSS we added to index.css — same rules as the site
        class: "prose max-w-none min-h-64 p-5 focus:outline-none",
      },
    },
  });

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
    <div className="border rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b bg-gray-50">
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
        <span className="w-px bg-gray-200 mx-1 self-stretch" />
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
        <span className="w-px bg-gray-200 mx-1 self-stretch" />
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
        <span className="w-px bg-gray-200 mx-1 self-stretch" />
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
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b">
          <span className="text-xs text-gray-500 shrink-0">URL:</span>
          <input
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bubble menu — shown when cursor is on an existing link */}
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 150, placement: "bottom" }}
        shouldShow={({ editor }) => editor.isActive("link")}
      >
        <div className="flex items-center gap-1 bg-white border shadow-lg rounded px-2 py-1.5">
          <a
            href={editor.getAttributes("link").href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline max-w-[180px] truncate"
          >
            {editor.getAttributes("link").href}
          </a>
          <button
            type="button"
            onClick={() => {
              setLinkUrl(editor.getAttributes("link").href ?? "");
              setShowLinkInput(true);
            }}
            className="text-xs text-gray-500 hover:text-gray-800 px-1 border-l ml-1 pl-2"
            title="Edit link"
          >
            ✏ Edit
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            className="text-xs text-red-500 hover:text-red-700 px-1"
            title="Remove link"
          >
            ✕
          </button>
        </div>
      </BubbleMenu>

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
