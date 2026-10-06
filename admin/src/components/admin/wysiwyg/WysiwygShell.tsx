import { useState, useCallback, useEffect, type ReactNode } from "react";
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
  moveInBlocks,
  patchBlocks,
  reorderInTree,
  removeFromBlocks,
  withNormalizedOrder,
  withNormalizedOrderDeep,
  flattenVisible,
  type AnyBlock,
} from "./blockUtils";
import { buildNavPreset, buildFooterPreset } from "./presets";
import type { NavSnapshot, ArticleCtx } from "./iframeRenderer";

const EMPTY_NAV_SNAPSHOT: NavSnapshot = {};

type ViewportMode = "desktop" | "tablet" | "mobile";

export interface WysiwygShellProps {
  mode: "home" | "page" | "article";
  title: string;
  subtitle?: ReactNode;
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
  /** Article mode only: article data for live canvas preview */
  articleCtx?: ArticleCtx | null;
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
  navSnapshot,
  themeColors: themeColorsProp,
  onLoadDefaultTemplate,
  articleCtx,
}: WysiwygShellProps) {
  // Fall back to themeVars — they have the same `--color-*` key structure
  const themeColors = themeColorsProp ?? themeVars;
  const stableNavSnapshot = navSnapshot ?? EMPTY_NAV_SNAPSHOT;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("desktop");
  const [animating, setAnimating] = useState(false);

  // ── Panel visibility ─────────────────────────────────────────────────────────
  // Desktop: Blocks (left) and Inspector (right) are docked and can be hidden to
  // give the canvas more room; the choice is remembered. Phones (< md): the
  // canvas takes the full width and at most one panel slides over it as a drawer.
  const isMobile = useIsMobile();
  const [dockedPanels, setDockedPanels] = useState(readDockedPanels);
  const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
  const leftOpen = isMobile ? mobilePanel === "left" : dockedPanels.left;
  const rightOpen = isMobile ? mobilePanel === "right" : dockedPanels.right;
  const togglePanel = (side: "left" | "right") => {
    if (isMobile) {
      setMobilePanel((p) => (p === side ? null : side));
      return;
    }
    setDockedPanels((p) => {
      const next = { ...p, [side]: !p[side] };
      try {
        localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable — keep in-memory state only */
      }
      return next;
    });
  };
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
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  function toggleCollapsed(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    if (mode !== "home" && mode !== "article") return;
    const homeBlocks = blocks as HomeBlock[];
    const block = findBlock(homeBlocks, blockId);
    if (!block) return;
    const updated = patchBlocks(homeBlocks, blockId, {
      translations: {
        ...block.translations,
        [activeLang]: {
          ...(block.translations?.[activeLang] ?? {}),
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

  // Add a block as a child of an existing block (works for any block type, not just containers).
  // opts.prepend=true puts the new child first (e.g. re-adding an article-grid header).
  function addChildBlock(
    parentId: string,
    type: BlockType,
    opts?: { prepend?: boolean; keepParentSelected?: boolean },
  ) {
    const parent = findBlock(anyBlocks(), parentId);
    if (!parent) return;
    const child =
      mode === "home" || mode === "article"
        ? makeHomeBlock(type, parent.children?.length ?? 0)
        : makePageBlock(type, parent.children?.length ?? 0);
    const existing = parent.children ?? [];
    const newChildren = opts?.prepend
      ? [child, ...existing]
      : [...existing, child];
    commit(
      patchBlocks(anyBlocks(), parentId, {
        children: withNormalizedOrder(newChildren),
      } as Partial<AnyBlock>),
    );
    if (!opts?.keepParentSelected) setSelectedBlockId(child.id);
  }

  function addBlock(type: BlockType, targetId: string | null) {
    // Preset types expand into a complete block tree
    if (type === "preset-nav" || type === "preset-footer") {
      const presetBlocks =
        type === "preset-nav"
          ? buildNavPreset(activeLang)
          : buildFooterPreset(activeLang);
      commit(
        withNormalizedOrder([
          ...anyBlocks(),
          ...(presetBlocks as unknown as AnyBlock[]),
        ]),
      );
      if (presetBlocks[0]) setSelectedBlockId(presetBlocks[0].id);
      return;
    }

    const newBlock =
      mode === "home" || mode === "article"
        ? makeHomeBlock(type, blocks.length)
        : makePageBlock(type, blocks.length);

    if (targetId) {
      // Try to add as child of the target container
      const target = findBlock(anyBlocks(), targetId);
      // article-card accepts article-* children (except article-body); article-grid accepts article-card;
      // container accepts anything
      const canReceive =
        target?.type === "container" ||
        target?.type === "slideshow" ||
        (target?.type === "article-card" && type !== "article-body") ||
        (target?.type === "article-grid" && type === "article-card");
      if (canReceive) {
        const childCount = target.children?.length ?? 0;
        const child =
          mode === "home" || mode === "article"
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
    (fromId: string, toId: string, before: boolean) => {
      commit(reorderInTree(anyBlocks(), fromId, toId, before));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks],
  );

  const handleContentChange = useCallback(
    (blockId: string, html: string) => {
      if (mode === "home" || mode === "article") {
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

  // Keyboard shortcuts for the layers panel
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire when focus is inside a text input / textarea / contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      )
        return;

      // Alt+ArrowUp / Alt+ArrowDown — move selected block within its siblings
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        if (!selectedBlockId) return;
        e.preventDefault();
        const dir = e.key === "ArrowUp" ? "up" : "down";
        commit(
          withNormalizedOrderDeep(
            moveInBlocks(anyBlocks(), selectedBlockId, dir),
          ),
        );
        return;
      }

      // ArrowUp / ArrowDown — navigate selection through visible layers
      if (!e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const flat = flattenVisible(anyBlocks(), collapsedIds);
        if (flat.length === 0) return;
        const cur = selectedBlockId ? flat.indexOf(selectedBlockId) : -1;
        const next =
          e.key === "ArrowUp"
            ? Math.max(0, cur - 1)
            : Math.min(flat.length - 1, cur + 1);
        setSelectedBlockId(flat[next]);
        setLeftTab("layers");
        return;
      }

      // ArrowLeft — collapse selected block; ArrowRight — expand
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (!selectedBlockId) return;
        const block = findBlock(anyBlocks(), selectedBlockId);
        if (!block?.children?.length) return;
        e.preventDefault();
        if (e.key === "ArrowLeft") {
          setCollapsedIds((prev) => new Set([...prev, selectedBlockId]));
        } else {
          setCollapsedIds((prev) => {
            const next = new Set(prev);
            next.delete(selectedBlockId);
            return next;
          });
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlockId, blocks, collapsedIds]);

  const handleMoveToContainer = useCallback(
    (fromId: string, containerId: string) => {
      const block = findBlock(anyBlocks(), fromId);
      const container = findBlock(anyBlocks(), containerId);
      if (
        !block ||
        !container ||
        (container.type !== "container" && container.type !== "slideshow")
      )
        return;
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

  const handleMoveToRoot = useCallback(
    (fromId: string) => {
      const block = findBlock(anyBlocks(), fromId);
      if (!block) return;
      const without = removeFromBlocks(anyBlocks(), fromId);
      commit(withNormalizedOrder([...without, { ...block } as AnyBlock]));
      setSelectedBlockId(fromId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blocks],
  );

  // ── Selected block ────────────────────────────────────────────────────────────

  const selectedBlock = selectedBlockId
    ? (findBlock(anyBlocks(), selectedBlockId) as HomeBlock | PageBlock | null)
    : null;

  // On phones, selecting a block (on the canvas, in Layers, or by adding one)
  // opens the Inspector drawer so its settings are reachable.
  useEffect(() => {
    if (isMobile && selectedBlockId) setMobilePanel("right");
  }, [isMobile, selectedBlockId]);

  // Escape closes a mobile drawer; leaving the phone layout resets it.
  useEffect(() => {
    if (!isMobile) {
      setMobilePanel(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobilePanel(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isMobile]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    // -m-6 counteracts AdminLayout's p-6; fills the viewport (minus AdminLayout's
    // 3.5rem mobile top bar below md)
    <div className="-m-6 flex flex-col overflow-hidden h-[calc(100dvh-3.5rem)] md:h-screen">
      {/* ── Top bar ── */}
      <header className="h-14 shrink-0 bg-(--color-bg) border-b border-(--color-border) flex items-center justify-between gap-2 px-2 md:px-4 z-10">
        {/* Left: Blocks panel toggle + title */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <PanelToggle
            side="left"
            open={leftOpen}
            onClick={() => togglePanel("left")}
          />
          <div
            className="hidden md:flex w-7 h-7 rounded items-center justify-center text-white font-bold text-sm shrink-0"
            style={{ background: "var(--color-accent)" }}
          >
            B
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-(--color-text) leading-tight truncate">
              {title}
            </div>
            {subtitle && (
              <div className="hidden md:block text-xs text-(--color-muted)">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        {/* Center: viewport toggle (on a phone the canvas is already phone-sized) */}
        <div className="hidden md:flex bg-(--color-bg-surface) rounded-lg p-0.5 border border-(--color-border)">
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
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            title={animating ? "Stop preview" : "Play animations"}
            onClick={() => setAnimating((a) => !a)}
            className={`hidden md:block px-3 py-1.5 text-sm rounded border transition-colors ${
              animating
                ? "border-blue-500 bg-blue-50 text-blue-600"
                : "border-(--color-border) text-(--color-muted) hover:text-(--color-text)"
            }`}
          >
            {animating ? "■ Stop" : "▶ Animate"}
          </button>
          {serverError && (
            <span className="text-xs text-(--color-destructive) max-w-[120px] md:max-w-[200px] truncate">
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
            className="px-3 md:px-4 py-1.5 text-sm text-white rounded disabled:opacity-50 transition-opacity whitespace-nowrap"
            style={{ background: "var(--color-accent)" }}
          >
            {saving
              ? "Saving…"
              : mode === "home" || mode === "article"
                ? "Save & Rebuild"
                : "Save"}
          </button>
          {onLoadDefaultTemplate && (
            <button
              onClick={onLoadDefaultTemplate}
              className="hidden md:block px-3 py-1.5 text-sm border border-(--color-border) rounded text-(--color-muted) hover:text-(--color-text)"
            >
              Load default template
            </button>
          )}
          <PanelToggle
            side="right"
            open={rightOpen}
            onClick={() => togglePanel("right")}
          />
        </div>
      </header>

      {/* ── Three panes ── */}
      <div className="relative flex-1 flex min-h-0 overflow-hidden">
        {/* Phone: dim the canvas behind an open drawer; tap to close */}
        {isMobile && mobilePanel && (
          <div
            className="absolute inset-0 z-20 bg-black/30"
            onClick={() => setMobilePanel(null)}
            aria-hidden="true"
          />
        )}

        <div className={panelWrapperClass("left", leftOpen, isMobile)}>
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
            onReorder={handleReorder}
            onStartDrag={(type) => setPaletteDragType(type)}
            onEndDrag={() => setPaletteDragType(null)}
            onAddBlock={(type) => addBlock(type, null)}
            pageSettingsNode={pageSettingsNode}
            collapsedIds={collapsedIds}
            onToggleCollapsed={toggleCollapsed}
          />
        </div>

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
          onMoveToRoot={handleMoveToRoot}
          navSnapshot={stableNavSnapshot}
          animating={animating}
          articleCtx={articleCtx ?? undefined}
        />

        <div className={panelWrapperClass("right", rightOpen, isMobile)}>
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
            onAddChild={addChildBlock}
          />
        </div>
      </div>
    </div>
  );
}

// ── Panel helpers ─────────────────────────────────────────────────────────────

const PANELS_STORAGE_KEY = "folio-builder-panels";
const MOBILE_QUERY = "(max-width: 767px)";

function readDockedPanels(): { left: boolean; right: boolean } {
  try {
    const raw = localStorage.getItem(PANELS_STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { left: p.left !== false, right: p.right !== false };
    }
  } catch {
    /* ignore — default to both panels open */
  }
  return { left: true, right: true };
}

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia(MOBILE_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isMobile;
}

/** Docked flex column on desktop; a drawer over the canvas on phones. Hidden
 *  panels stay mounted (display:none) so their scroll/tab state survives. */
function panelWrapperClass(
  side: "left" | "right",
  open: boolean,
  isMobile: boolean,
): string {
  if (!open) return "hidden";
  if (!isMobile) return "flex shrink-0";
  return `absolute inset-y-0 ${side === "left" ? "left-0" : "right-0"} z-30 flex max-w-[90vw] shadow-xl`;
}

function PanelToggle({
  side,
  open,
  onClick,
}: {
  side: "left" | "right";
  open: boolean;
  onClick: () => void;
}) {
  const label = side === "left" ? "Blocks" : "Inspector";
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${open ? "Hide" : "Show"} ${label.toLowerCase()} panel`}
      aria-label={`${open ? "Hide" : "Show"} ${label.toLowerCase()} panel`}
      aria-pressed={open}
      className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-sm transition-colors shrink-0 ${
        open
          ? "border-(--color-accent) text-(--color-accent) bg-(--color-bg-surface)"
          : "border-(--color-border) text-(--color-muted) hover:text-(--color-text)"
      }`}
    >
      <svg
        viewBox="0 0 16 16"
        width={16}
        height={16}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
        {side === "left" ? (
          <path d="M6 2.5v11" />
        ) : (
          <path d="M10 2.5v11" />
        )}
      </svg>
      <span className="hidden lg:inline">{label}</span>
    </button>
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
