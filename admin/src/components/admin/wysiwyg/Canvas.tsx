import { useRef, useEffect, useCallback, useState } from "react";
import type { BlockType } from "../../../api/types";
import {
  buildSrcdoc,
  renderBlocksHtml,
  type RenderBlock,
  type NavSnapshot,
} from "./iframeRenderer";
import { RichTextEditor } from "../RichTextEditor";

type ViewportMode = "desktop" | "tablet" | "mobile";

interface CanvasProps {
  blocks: RenderBlock[];
  selectedBlockId: string | null;
  activeLang: string;
  mode: "home" | "page";
  themeVars: Record<string, string>;
  viewportMode: ViewportMode;
  onSelect: (id: string | null) => void;
  onReorder: (fromId: string, toId: string, before: boolean) => void;
  onContentChange: (id: string, html: string) => void;
  onPaletteDrop: (type: BlockType, targetId: string | null) => void;
  paletteDragType: BlockType | null;
  onDelete: () => void;
  onMoveToContainer: (fromId: string, containerId: string) => void;
  onMoveToRoot: (fromId: string) => void;
  navSnapshot?: NavSnapshot;
}

export function Canvas({
  blocks,
  selectedBlockId,
  activeLang,
  mode,
  themeVars,
  viewportMode,
  onSelect,
  onReorder,
  onContentChange,
  onPaletteDrop,
  paletteDragType,
  onDelete,
  onMoveToContainer,
  onMoveToRoot,
  navSnapshot = {},
}: CanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialSrcdocRef = useRef<string | null>(null);
  const skipUpdateRef = useRef(false);
  const latestHtmlRef = useRef<string>("");
  const [iframeHeight, setIframeHeight] = useState(600);
  const [isDragOver, setIsDragOver] = useState(false);

  // State for the inline rich-text editor overlay
  type RichEditState = {
    id: string;
    content: string;
    /** Position relative to the viewport (fixed positioning) */
    top: number;
    left: number;
    width: number;
    minHeight: number;
  };
  const [richEdit, setRichEdit] = useState<RichEditState | null>(null);
  const richEditContentRef = useRef<string>("");

  /** Recursively find a block by id in the block tree. */
  function findRenderBlock(
    list: RenderBlock[],
    id: string,
  ): RenderBlock | null {
    for (const b of list) {
      if (b.id === id) return b;
      if (b.children) {
        const found = findRenderBlock(b.children, id);
        if (found) return found;
      }
    }
    return null;
  }

  /** Extract text content from a block given the current mode/lang. */
  function getRichTextContent(block: RenderBlock): string {
    if (mode === "home") {
      return (block.translations?.[activeLang]?.content as string) ?? "";
    }
    return (block.config.content as string) ?? "";
  }

  // Build srcdoc once on first render
  if (!initialSrcdocRef.current) {
    initialSrcdocRef.current = buildSrcdoc(
      blocks,
      themeVars,
      activeLang,
      mode,
      navSnapshot,
    );
  }

  // Send updated blocks to iframe whenever they change
  useEffect(() => {
    if (skipUpdateRef.current) {
      skipUpdateRef.current = false;
      return;
    }
    const html = renderBlocksHtml(blocks, activeLang, mode, navSnapshot);
    latestHtmlRef.current = html;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage({ type: "updateBlocks", html }, "*");
  }, [blocks, activeLang, mode, navSnapshot]);

  // Mirror selectedBlockId into iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "select", id: selectedBlockId },
      "*",
    );
  }, [selectedBlockId]);

  // Receive postMessages from iframe
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const msg = e.data;
      if (!msg?.type) return;
      if (msg.type === "select") onSelect(msg.id ?? null);
      if (msg.type === "reorder")
        onReorder(msg.fromId, msg.toId, msg.before ?? true);
      if (msg.type === "height") setIframeHeight(Math.max(msg.value, 400));
      if (msg.type === "content") {
        skipUpdateRef.current = true;
        onContentChange(msg.id, msg.html);
      }
      if (msg.type === "deleteSelected") onDelete();
      if (msg.type === "moveToContainer")
        onMoveToContainer(msg.fromId, msg.containerId);
      if (msg.type === "moveToRoot") onMoveToRoot(msg.fromId);
      if (msg.type === "richTextEdit") {
        const block = findRenderBlock(blocks, msg.id as string);
        if (!block) return;
        const initialContent = getRichTextContent(block);
        richEditContentRef.current = initialContent;
        const iframeRect = iframeRef.current?.getBoundingClientRect();
        const blockRect = msg.rect as {
          top: number;
          left: number;
          width: number;
          height: number;
        };
        setRichEdit({
          id: msg.id as string,
          content: initialContent,
          top: (iframeRect?.top ?? 0) + blockRect.top,
          left: (iframeRect?.left ?? 0) + blockRect.left,
          width: blockRect.width,
          minHeight: Math.max(blockRect.height, 200),
        });
        onSelect(msg.id as string);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [
    onSelect,
    onReorder,
    onContentChange,
    onDelete,
    onMoveToContainer,
    onMoveToRoot,
    blocks,
    activeLang,
    mode,
  ]);

  // Build theme CSS string from themeVars
  function buildThemeCss(vars: Record<string, string>): string {
    const lines = Object.entries(vars)
      .map(([k, v]) => `  ${k}: ${v};`)
      .join("\n");
    return `:root {\n${lines}\n}`;
  }

  // Push updated theme vars into the iframe whenever they change
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "updateTheme", css: buildThemeCss(themeVars) },
      "*",
    );
  }, [themeVars]);

  // After iframe loads, flush the latest blocks (may have arrived before the
  // iframe's message listener was ready) and send current selection state.
  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "updateTheme", css: buildThemeCss(themeVars) },
      "*",
    );
    iframe.contentWindow.postMessage(
      { type: "updateBlocks", html: latestHtmlRef.current },
      "*",
    );
    iframe.contentWindow.postMessage(
      { type: "select", id: selectedBlockId },
      "*",
    );
  }, [selectedBlockId, themeVars]);

  // Handle drop from the element palette (via transparent overlay)
  const handlePaletteDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(true);
    },
    [],
  );

  const handlePaletteDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const handlePaletteDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      if (!paletteDragType) return;

      const iframe = iframeRef.current;
      let targetId: string | null = null;

      if (iframe?.contentDocument) {
        const rect = iframe.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const el = iframe.contentDocument.elementFromPoint(
          x,
          y,
        ) as HTMLElement | null;
        const blockEl = el?.closest?.(
          "[data-wysiwyg-id]",
        ) as HTMLElement | null;
        targetId = blockEl?.dataset?.wysiwygId ?? null;
      }

      onPaletteDrop(paletteDragType, targetId);
    },
    [paletteDragType, onPaletteDrop],
  );

  const viewportWidth =
    viewportMode === "tablet"
      ? "768px"
      : viewportMode === "mobile"
        ? "390px"
        : "100%";

  function closeRichEdit() {
    if (!richEdit) return;
    const html = richEditContentRef.current;
    skipUpdateRef.current = true;
    onContentChange(richEdit.id, html);
    // Push updated content back into the iframe so it reflects the change immediately
    iframeRef.current?.contentWindow?.postMessage(
      { type: "setContent", id: richEdit.id, html },
      "*",
    );
    setRichEdit(null);
  }

  return (
    <div className="flex-1 overflow-auto relative bg-(--color-bg-surface) bg-[radial-gradient(var(--color-border)_1px,transparent_1px)] bg-size-[20px_20px]">
      <div className="flex justify-center p-8 min-h-full">
        <div
          className="shadow-xl min-h-full relative transition-all duration-200"
          style={{
            width: viewportWidth,
            maxWidth: "100%",
            background: themeVars["--color-bg"] ?? "#fff",
          }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={initialSrcdocRef.current}
            className="w-full border-none block"
            style={{ height: `${iframeHeight}px`, minHeight: "400px" }}
            title="WYSIWYG Canvas"
            onLoad={handleLoad}
          />
          {/* Transparent overlay captures palette drops across iframe boundary */}
          {paletteDragType && (
            <div
              className="absolute inset-0"
              style={{
                zIndex: 10,
                background: isDragOver
                  ? "rgba(59,130,246,0.06)"
                  : "transparent",
                border: isDragOver
                  ? "2px dashed rgba(59,130,246,0.5)"
                  : "2px dashed transparent",
                transition: "all 0.1s",
              }}
              onDragOver={handlePaletteDragOver}
              onDragLeave={handlePaletteDragLeave}
              onDrop={handlePaletteDrop}
            />
          )}
        </div>
      </div>

      {/* Rich-text inline editor overlay — rendered fixed over the block */}
      {richEdit && (
        <>
          {/* Scrim — click to save & close */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 40, background: "rgba(0,0,0,0.25)" }}
            onMouseDown={(e) => {
              e.preventDefault();
              closeRichEdit();
            }}
          />
          {/* Editor panel */}
          <div
            className="fixed rounded-lg shadow-2xl overflow-hidden"
            style={{
              zIndex: 41,
              top: richEdit.top,
              left: richEdit.left,
              width: richEdit.width,
              minHeight: richEdit.minHeight,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--color-bg, #fff)",
              border: "2px solid var(--color-accent, #3b82f6)",
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") closeRichEdit();
            }}
          >
            {/* Done button */}
            <div
              className="flex items-center justify-between px-3 py-1.5 border-b"
              style={{
                borderColor: "var(--color-border,#e2e8f0)",
                background: "var(--color-bg-surface,#f8fafc)",
              }}
            >
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--color-muted,#64748b)" }}
              >
                Rich Text — editing
              </span>
              <button
                type="button"
                className="text-xs px-3 py-1 rounded text-white"
                style={{ background: "var(--color-accent,#3b82f6)" }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  closeRichEdit();
                }}
              >
                Done
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <RichTextEditor
                value={richEdit.content}
                onChange={(html) => {
                  richEditContentRef.current = html;
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
