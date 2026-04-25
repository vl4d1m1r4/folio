import { useState, useCallback, type ReactNode } from "react";
import type {
  BlockType,
  HomeBlock,
  Language,
  NavLink,
  PageBlock,
  SocialLink,
} from "../../../api/types";
import { Canvas } from "./Canvas";
import { LeftSidebar } from "./LeftSidebar";
import { InspectorPanel } from "./InspectorPanel";
import {
  findBlock,
  makeHomeBlock,
  makePageBlock,
  patchBlocks,
  removeFromBlocks,
  withNormalizedOrder,
  type AnyBlock,
} from "./blockUtils";
import type { NavSnapshot } from "./iframeRenderer";

type ViewportMode = "desktop" | "tablet" | "mobile";

export interface WysiwygShellProps {
  mode: "home" | "page";
  title: string;
  subtitle?: string;
  themeVars: Record<string, string>;
  languages: Language[];
  activeLang: string;
  onActiveLangChange: (code: string) => void;
  blocks: HomeBlock[] | PageBlock[];
  onBlocksChange: (blocks: HomeBlock[] | PageBlock[]) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  serverError?: string | null;
  /** Called when user wants to copy blocks from another language */
  onCopyBlocksFrom?: (fromLang: string) => void;
  /** Page-mode only: metadata form rendered in the "Page" tab of the left sidebar */
  pageSettingsNode?: ReactNode;
  /** Externally controlled left-sidebar tab (optional; falls back to internal state) */
  activeLeftTab?: "add" | "layers" | "page";
  /** Called when the left-sidebar tab changes */
  onLeftTabChange?: (tab: "add" | "layers" | "page") => void;
  /** Nav/social data snapshot for canvas preview of nav block types */
  navSnapshot?: NavSnapshot;
  /** Resolved theme color values for ColorRow swatches */
  themeColors?: Record<string, string>;
  /** If provided, shows a "Load default template" button in the top bar */
  onLoadDefaultTemplate?: () => void;
}

export function WysiwygShell({
  mode,
  title,
  subtitle,
  themeVars,
  languages,
  activeLang,
  onActiveLangChange,
  blocks,
  onBlocksChange,
  onSave,
  saving,
  saved,
  serverError,
  onCopyBlocksFrom,
  pageSettingsNode,
  activeLeftTab,
  onLeftTabChange,
  navSnapshot = {},
  themeColors,
  onLoadDefaultTemplate,
}: WysiwygShellProps) {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [leftTabInternal, setLeftTabInternal] = useState<
    "add" | "layers" | "page"
  >("add");
  const leftTab = activeLeftTab ?? leftTabInternal;
  const setLeftTab = (tab: "add" | "layers" | "page") => {
    setLeftTabInternal(tab);
    onLeftTabChange?.(tab);
  };
  const [paletteDragType, setPaletteDragType] = useState<BlockType | null>(
    null,
  );

  // ── Block tree helpers ───────────────────────────────────────────────────────

  function anyBlocks(): AnyBlock[] {
    return blocks as AnyBlock[];
  }

  function commit(updated: AnyBlock[]) {
    (onBlocksChange as (b: typeof updated) => void)(updated);
  }

  function updateBlockConfig(blockId: string, key: string, value: unknown) {
    const block = findBlock(anyBlocks(), blockId);
    if (!block) return;
    commit(
      patchBlocks(anyBlocks(), blockId, {
        config: { ...block.config, [key]: value },
      } as Partial<AnyBlock>),
    );
  }

  function updateBlockTranslation(blockId: string, key: string, value: string) {
    if (mode !== "home") return;
    const homeBlocks = blocks as HomeBlock[];
    const block = findBlock(homeBlocks, blockId);
    if (!block) return;
    const updated = patchBlocks(homeBlocks, blockId, {
      translations: {
        ...block.translations,
        [activeLang]: {
          ...(block.translations[activeLang] ?? {}),
          [key]: value,
        },
      },
    } as Partial<HomeBlock>);
    (onBlocksChange as (b: HomeBlock[]) => void)(updated);
  }

  function removeBlock(blockId: string) {
    if (selectedBlockId === blockId) setSelectedBlockId(null);
    commit(withNormalizedOrder(removeFromBlocks(anyBlocks(), blockId)));
  }

  function toggleVisibility(blockId: string) {
    const block = findBlock(anyBlocks(), blockId);
    if (!block) return;
    commit(
      patchBlocks(anyBlocks(), blockId, {
        visible: !block.visible,
      } as Partial<AnyBlock>),
    );
  }

  function addBlock(type: BlockType, targetId: string | null) {
    const newBlock =
      mode === "home"
        ? makeHomeBlock(type, blocks.length)
        : makePageBlock(type, blocks.length);

    if (targetId) {
      // Try to add as child of the target container
      const target = findBlock(anyBlocks(), targetId);
      if (target?.type === "container") {
        const childCount = target.children?.length ?? 0;
        const child =
          mode === "home"
            ? makeHomeBlock(type, childCount)
            : makePageBlock(type, childCount);
        commit(
          patchBlocks(anyBlocks(), targetId, {
            children: [...(target.children ?? []), child],
          } as Partial<AnyBlock>),
        );
        setSelectedBlockId(child.id);
        return;
      }
    }

    // Otherwise append to root
    commit(withNormalizedOrder([...anyBlocks(), newBlock]));
    setSelectedBlockId(newBlock.id);
  }

  // ── Canvas callbacks ─────────────────────────────────────────────────────────

  const handleReorder = useCallback(
    (fromId: string, toId: string) => {
      const arr = [...anyBlocks()];
      const fromIdx = arr.findIndex((b) => b.id === fromId);
      const toIdx = arr.findIndex((b) => b.id === toId);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      commit(withNormalizedOrder(arr));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks],
  );

  const handleContentChange = useCallback(
    (blockId: string, html: string) => {
      if (mode === "home") {
        updateBlockTranslation(blockId, "content", html);
      } else {
        updateBlockConfig(blockId, "content", html);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, activeLang, blocks],
  );

  const handleDelete = useCallback(() => {
    if (!selectedBlockId) return;
    setSelectedBlockId(null);
    commit(withNormalizedOrder(removeFromBlocks(anyBlocks(), selectedBlockId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockId, blocks]);

  const handleMoveToContainer = useCallback(
    (fromId: string, containerId: string) => {
      const block = findBlock(anyBlocks(), fromId);
      const container = findBlock(anyBlocks(), containerId);
      if (!block || !container || container.type !== "container") return;
      const without = removeFromBlocks(anyBlocks(), fromId);
      // Read existing children from the post-removal tree so a block nested
      // inside the target container is not reintroduced by stale data.
      const containerAfterRemoval = findBlock(without, containerId);
      const existingChildren = containerAfterRemoval?.children ?? [];
      const movedBlock = { ...block, order: existingChildren.length };
      const updated = patchBlocks(without, containerId, {
        children: [...existingChildren, movedBlock],
      } as Partial<AnyBlock>);
      commit(withNormalizedOrder(updated));
      setSelectedBlockId(fromId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks],
  );

  // ── Selected block ────────────────────────────────────────────────────────────

  const selectedBlock = selectedBlockId
    ? (findBlock(anyBlocks(), selectedBlockId) as HomeBlock | PageBlock | null)
    : null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    // -m-6 counteracts AdminLayout's p-6; h-screen fills viewport
    <div
      className="-m-6 flex flex-col overflow-hidden"
      style={{ height: "100vh" }}
    >
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 bg-(--color-bg) border-b border-(--color-border) flex items-center justify-between px-4 z-10">
        {/* Left: title */}
        <div className="flex items-center gap-3">
          <div
            className="w-7 h-7 rounded flex items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "var(--color-accent)" }}
          >
            B
          </div>
          <div>
            <div className="font-semibold text-sm text-(--color-text) leading-tight">
              {title}
            </div>
            {subtitle && (
              <div className="text-xs text-(--color-muted)">{subtitle}</div>
            )}
          </div>
        </div>

        {/* Center: viewport toggle */}
        <div className="flex bg-(--color-bg-surface) rounded-lg p-0.5 border border-(--color-border)">
          {(
            [
              { id: "desktop", label: "Desktop", icon: <DesktopIcon /> },
              { id: "tablet", label: "Tablet", icon: <TabletIcon /> },
              { id: "mobile", label: "Mobile", icon: <MobileIcon /> },
            ] as const
          ).map(({ id, label, icon }) => (
            <button
              key={id}
              title={label}
              onClick={() => setViewportMode(id)}
              className={`px-3 py-1.5 rounded transition-colors ${
                viewportMode === id
                  ? "bg-(--color-bg) shadow-sm text-(--color-text)"
                  : "text-(--color-muted) hover:text-(--color-text)"
              }`}
            >
              {icon}
            </button>
          ))}
        </div>

        {/* Right: save */}
        <div className="flex items-center gap-3">
          {serverError && (
            <span className="text-xs text-(--color-destructive) max-w-[200px] truncate">
              {serverError}
            </span>
          )}
          {saved && (
            <span className="text-xs text-(--color-success) flex items-center gap-1">
              <CheckIcon /> Saved
            </span>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm text-white rounded disabled:opacity-50 transition-opacity"
            style={{ background: "var(--color-accent)" }}
          >
            {saving ? "Saving…" : mode === "home" ? "Save & Rebuild" : "Save"}
          </button>
          {onLoadDefaultTemplate && (
            <button
              onClick={onLoadDefaultTemplate}
              className="px-3 py-1.5 text-sm border border-(--color-border) rounded text-(--color-muted) hover:text-(--color-text)"
            >
              Load default template
            </button>
          )}
        </div>
      </header>

      {/* ── Three panes ── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <LeftSidebar
          mode={mode}
          blocks={
            blocks as (
              | HomeBlock
              | (PageBlock & { children?: (HomeBlock | PageBlock)[] })
            )[]
          }
          selectedBlockId={selectedBlockId}
          languages={languages}
          activeLang={activeLang}
          onActiveLangChange={onActiveLangChange}
          onCopyBlocksFrom={onCopyBlocksFrom}
          activeTab={leftTab}
          onTabChange={setLeftTab}
          onSelect={setSelectedBlockId}
          onRemoveBlock={removeBlock}
          onToggleVisibility={toggleVisibility}
          onStartDrag={(type) => setPaletteDragType(type)}
          onEndDrag={() => setPaletteDragType(null)}
          onAddBlock={(type) => addBlock(type, null)}
          pageSettingsNode={pageSettingsNode}
        />

        <Canvas
          blocks={blocks as any}
          selectedBlockId={selectedBlockId}
          activeLang={activeLang}
          mode={mode}
          themeVars={themeVars}
          viewportMode={viewportMode}
          onSelect={setSelectedBlockId}
          onReorder={handleReorder}
          onContentChange={handleContentChange}
          onPaletteDrop={(type, targetId) => {
            setPaletteDragType(null);
            addBlock(type, targetId);
          }}
          paletteDragType={paletteDragType}
          onDelete={handleDelete}
          onMoveToContainer={handleMoveToContainer}
          navSnapshot={navSnapshot}
        />

        <InspectorPanel
          block={selectedBlock}
          mode={mode}
          activeLang={activeLang}
          onConfigChange={updateBlockConfig}
          onTransChange={updateBlockTranslation}
          themeColors={themeColors}
          navSnapshot={navSnapshot?.navLinks as NavLink[] | undefined}
          footerSnapshot={navSnapshot?.footerLinks as NavLink[] | undefined}
          socialSnapshot={navSnapshot?.socialLinks as SocialLink[] | undefined}
        />
      </div>
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function DesktopIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="2" width="14" height="9" rx="1.5" />
      <path d="M5 14h6M8 11v3" />
    </svg>
  );
}
function TabletIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="3" y="1" width="10" height="14" rx="2" />
      <circle cx="8" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
function MobileIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="4" y="1" width="8" height="14" rx="2" />
      <circle cx="8" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 8l3.5 3.5L13 4" />
    </svg>
  );
}
