import { useRef, useEffect, useCallback, useState } from "react";
import type { BlockType } from "../../../api/types";
import {
  buildSrcdoc,
  renderBlocksHtml,
  type RenderBlock,
  type NavSnapshot,
} from "./iframeRenderer";

type ViewportMode = "desktop" | "tablet" | "mobile";

interface CanvasProps {
  blocks: RenderBlock[];
  selectedBlockId: string | null;
  activeLang: string;
  mode: "home" | "page";
  themeVars: Record<string, string>;
  viewportMode: ViewportMode;
  onSelect: (id: string | null) => void;
  onReorder: (fromId: string, toId: string) => void;
  onContentChange: (id: string, html: string) => void;
  onPaletteDrop: (type: BlockType, targetId: string | null) => void;
  paletteDragType: BlockType | null;
  onDelete: () => void;
  onMoveToContainer: (fromId: string, containerId: string) => void;
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
  navSnapshot = {},
}: CanvasProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialSrcdocRef = useRef<string | null>(null);
  const skipUpdateRef = useRef(false);
  const latestHtmlRef = useRef<string>("");
  const [iframeHeight, setIframeHeight] = useState(600);
  const [isDragOver, setIsDragOver] = useState(false);

  // Build srcdoc once on first render
  if (!initialSrcdocRef.current) {
    initialSrcdocRef.current = buildSrcdoc(blocks, themeVars, activeLang, mode, navSnapshot);
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
  }, [blocks, activeLang, mode]);

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
      if (msg.type === "reorder") onReorder(msg.fromId, msg.toId);
      if (msg.type === "height") setIframeHeight(Math.max(msg.value, 400));
      if (msg.type === "content") {
        skipUpdateRef.current = true;
        onContentChange(msg.id, msg.html);
      }
      if (msg.type === "deleteSelected") onDelete();
      if (msg.type === "moveToContainer")
        onMoveToContainer(msg.fromId, msg.containerId);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSelect, onReorder, onContentChange, onDelete, onMoveToContainer]);

  // After iframe loads, flush the latest blocks (may have arrived before the
  // iframe's message listener was ready) and send current selection state.
  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: "updateBlocks", html: latestHtmlRef.current },
      "*",
    );
    iframe.contentWindow.postMessage(
      { type: "select", id: selectedBlockId },
      "*",
    );
  }, [selectedBlockId]);

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

  return (
    <div
      className="flex-1 overflow-auto relative"
      style={{
        background: "#f3f4f6",
        backgroundImage: "radial-gradient(#d1d5db 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
    >
      <div className="flex justify-center p-8 min-h-full">
        <div
          className="bg-white shadow-xl min-h-full relative transition-all duration-200"
          style={{ width: viewportWidth, maxWidth: "100%" }}
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
    </div>
  );
}
