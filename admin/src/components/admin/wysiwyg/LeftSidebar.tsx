import { useState, type ReactNode } from "react";
import type {
  BlockType,
  HomeBlock,
  PageBlock,
  Language,
} from "../../../api/types";
import { BLOCK_LABELS } from "../blockShared";

type AnyBlock = (HomeBlock | PageBlock) & { children?: AnyBlock[] };

interface LeftSidebarProps {
  mode: "home" | "page";
  blocks: AnyBlock[];
  selectedBlockId: string | null;
  languages: Language[];
  activeLang: string;
  onActiveLangChange: (code: string) => void;
  /** Called when user wants to copy blocks/layers from another language into the active one */
  onCopyBlocksFrom?: (fromLang: string) => void;
  activeTab: "add" | "layers" | "page";
  onTabChange: (tab: "add" | "layers" | "page") => void;
  onSelect: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onReorder: (fromId: string, toId: string, before: boolean) => void;
  onStartDrag: (type: BlockType) => void;
  onEndDrag: () => void;
  /** Called when user clicks a palette tile (non-drag add) */
  onAddBlock: (type: BlockType) => void;
  /** Page-mode only: metadata form rendered in the "page" tab */
  pageSettingsNode?: ReactNode;
}

// ── Palette groups ────────────────────────────────────────────────────────────

const PALETTE: {
  label: string;
  types: BlockType[];
  icons: Record<string, ReactNode>;
}[] = [
  {
    label: "Layout",
    types: ["container"],
    icons: { container: <ContainerIcon /> },
  },
  {
    label: "Content",
    types: ["text", "image", "button"],
    icons: { text: <TextIcon />, image: <ImageIcon />, button: <ButtonIcon /> },
  },
  {
    label: "Templates",
    types: [
      "hero",
      "featured-articles",
      "latest-articles",
      "cta-band",
      "rich-text",
      "image-text",
      "testimonials",
      "newsletter",
    ] as BlockType[],
    icons: {
      hero: <HeroIcon />,
      "featured-articles": <ArticlesIcon />,
      "latest-articles": <ArticlesIcon />,
      "cta-band": <CtaIcon />,
      "rich-text": <RichTextIcon />,
      "image-text": <ImageTextIcon />,
      testimonials: <TestimonialsIcon />,
      newsletter: <NewsletterIcon />,
    },
  },
  {
    label: "Articles",
    types: ["article-grid", "article-card"] as BlockType[],
    icons: {
      "article-grid": <ArticleGridIcon />,
      "article-card": <ArticleCardIcon />,
    },
  },
  {
    label: "Navigation",
    types: [
      "nav-links",
      "subnav-links",
      "single-nav-item",
      "social-links",
      "single-social-link",
    ] as BlockType[],
    icons: {
      "nav-links": <NavLinksIcon />,
      "subnav-links": <SubnavIcon />,
      "single-nav-item": <SingleNavIcon />,
      "social-links": <SocialLinksIcon />,
      "single-social-link": <SingleSocialIcon />,
    },
  },
  {
    label: "Presets",
    types: ["preset-nav", "preset-footer"] as BlockType[],
    icons: {
      "preset-nav": <PresetNavIcon />,
      "preset-footer": <PresetFooterIcon />,
    },
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function LeftSidebar({
  mode,
  blocks,
  selectedBlockId,
  languages,
  activeLang,
  onActiveLangChange,
  onCopyBlocksFrom,
  activeTab,
  onTabChange,
  onSelect,
  onRemoveBlock,
  onToggleVisibility,
  onReorder,
  onStartDrag,
  onEndDrag,
  onAddBlock,
  pageSettingsNode,
}: LeftSidebarProps) {
  const tabs: { id: "add" | "layers" | "page"; label: string }[] = [
    { id: "add", label: "Add" },
    { id: "layers", label: "Layers" },
    ...(mode === "page" ? [{ id: "page" as const, label: "Page" }] : []),
  ];

  return (
    <div className="w-64 shrink-0 bg-(--color-bg) border-r border-(--color-border) flex flex-col overflow-hidden">
      {/* Language switcher (multi-lang) */}
      {languages.length > 1 && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-(--color-border) bg-(--color-bg-surface)">
          {languages.map((l) => (
            <div key={l.code} className="relative group">
              <button
                onClick={() => onActiveLangChange(l.code)}
                className={`px-2 py-0.5 text-xs rounded font-medium border ${
                  activeLang === l.code
                    ? "bg-(--color-accent) text-white border-(--color-accent)"
                    : "border-(--color-border) text-(--color-muted) hover:text-(--color-text)"
                }`}
              >
                {l.label}
              </button>
              {onCopyBlocksFrom && activeLang !== l.code && (
                <button
                  title={`Copy layers from ${l.label} into current language`}
                  onClick={() => onCopyBlocksFrom(l.code)}
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-(--color-bg-surface) border border-(--color-border) text-(--color-muted) hover:text-(--color-accent) hover:border-(--color-accent) flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg
                    viewBox="0 0 12 12"
                    width={8}
                    height={8}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <rect x="1" y="3" width="7" height="8" rx="1" />
                    <path d="M4 3V2a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-1" />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-(--color-border) shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? "text-(--color-accent) border-b-2 border-(--color-accent)"
                : "text-(--color-muted) hover:text-(--color-text)"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "add" && (
          <AddTab
            onStartDrag={onStartDrag}
            onEndDrag={onEndDrag}
            onAddBlock={onAddBlock}
          />
        )}
        {activeTab === "layers" && (
          <LayersTab
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelect={onSelect}
            onRemove={onRemoveBlock}
            onToggleVisibility={onToggleVisibility}
            onReorder={onReorder}
            depth={0}
          />
        )}
        {activeTab === "page" && (
          <div className="p-4 space-y-4">{pageSettingsNode}</div>
        )}
      </div>
    </div>
  );
}

// ── Add tab (palette) ─────────────────────────────────────────────────────────

function AddTab({
  onStartDrag,
  onEndDrag,
  onAddBlock,
}: {
  onStartDrag: (type: BlockType) => void;
  onEndDrag: () => void;
  onAddBlock: (type: BlockType) => void;
}) {
  return (
    <div className="p-3 space-y-5">
      {PALETTE.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-(--color-muted) mb-2">
            {group.label}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {group.types.map((type) => (
              <div
                key={type}
                draggable
                onDragStart={() => onStartDrag(type)}
                onDragEnd={onEndDrag}
                onClick={() => onAddBlock(type)}
                className="flex flex-col items-center gap-1.5 p-2.5 border border-(--color-border) rounded cursor-grab hover:border-(--color-accent) hover:bg-(--color-bg-surface) transition-colors select-none"
                title={`Drag or click to add ${BLOCK_LABELS[type]}`}
              >
                <span className="text-(--color-muted)">
                  {group.icons[type]}
                </span>
                <span className="text-[11px] text-(--color-text) font-medium text-center leading-tight">
                  {BLOCK_LABELS[type]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Layers tab (tree) ─────────────────────────────────────────────────────────

function LayersTab({
  blocks,
  selectedBlockId,
  onSelect,
  onRemove,
  onToggleVisibility,
  onReorder,
  depth,
}: {
  blocks: AnyBlock[];
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onReorder: (fromId: string, toId: string, before: boolean) => void;
  depth: number;
}) {
  const sorted = [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (sorted.length === 0 && depth === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-(--color-muted)">No blocks yet.</p>
        <p className="text-xs text-(--color-muted) mt-1">
          Use the Add tab to place elements.
        </p>
      </div>
    );
  }

  return (
    <div>
      {sorted.map((block) => (
        <LayerRow
          key={block.id}
          block={block}
          depth={depth}
          isSelected={selectedBlockId === block.id}
          selectedBlockId={selectedBlockId}
          onSelect={onSelect}
          onRemove={onRemove}
          onToggleVisibility={onToggleVisibility}
          onReorder={onReorder}
        />
      ))}
    </div>
  );
}

function LayerRow({
  block,
  depth,
  isSelected,
  selectedBlockId,
  onSelect,
  onRemove,
  onToggleVisibility,
  onReorder,
}: {
  block: AnyBlock;
  depth: number;
  isSelected: boolean;
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onReorder: (fromId: string, toId: string, before: boolean) => void;
}) {
  const [dropPos, setDropPos] = useState<"before" | "after" | null>(null);

  const hasChildren =
    (block.type === "container" ||
      block.type === "article-grid" ||
      block.type === "article-card") &&
    (block.children?.length ?? 0) > 0;

  return (
    <div>
      <div className="relative">
        {/* Drop indicator – before */}
        {dropPos === "before" && (
          <div className="absolute top-0 inset-x-0 h-0.5 bg-(--color-accent) z-10 pointer-events-none" />
        )}

        <div
          draggable
          className={`flex items-center group h-8 pr-1 cursor-pointer transition-colors ${
            isSelected
              ? "bg-(--color-accent) text-white"
              : "hover:bg-(--color-bg-surface)"
          }`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          onClick={() => onSelect(block.id)}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", block.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = "move";
            const rect = e.currentTarget.getBoundingClientRect();
            setDropPos(e.clientY < rect.top + rect.height / 2 ? "before" : "after");
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setDropPos(null);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const fromId = e.dataTransfer.getData("text/plain");
            if (fromId && fromId !== block.id) {
              onReorder(fromId, block.id, dropPos === "before");
            }
            setDropPos(null);
          }}
          onDragEnd={() => setDropPos(null)}
        >
          {/* Drag grip */}
          <span
            className={`opacity-0 group-hover:opacity-50 shrink-0 mr-1 cursor-grab ${
              isSelected ? "text-white" : "text-(--color-muted)"
            }`}
          >
            <GripIcon size={10} />
          </span>

          {/* Type icon */}
          <span
            className={`shrink-0 mr-1.5 ${
              isSelected ? "text-white" : "text-(--color-muted)"
            }`}
          >
            <BlockTypeIcon type={block.type as BlockType} size={12} />
          </span>

          {/* Label */}
          <span className="flex-1 text-xs truncate font-medium">
            {BLOCK_LABELS[block.type as BlockType] ?? block.type}
          </span>

          {/* Visibility toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility(block.id);
            }}
            title={block.visible ? "Hide" : "Show"}
            className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
              isSelected
                ? "text-white/80 hover:text-white"
                : "text-(--color-muted) hover:text-(--color-text)"
            } ${!block.visible ? "!opacity-100" : ""}`}
          >
            {block.visible ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />}
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (
                confirm(
                  `Remove "${BLOCK_LABELS[block.type as BlockType] ?? block.type}"?`,
                )
              ) {
                onRemove(block.id);
              }
            }}
            title="Remove"
            className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-opacity ${
              isSelected
                ? "text-white/80 hover:text-white"
                : "text-(--color-muted) hover:text-red-500"
            }`}
          >
            <TrashIcon size={11} />
          </button>
        </div>

        {/* Drop indicator – after */}
        {dropPos === "after" && (
          <div className="absolute bottom-0 inset-x-0 h-0.5 bg-(--color-accent) z-10 pointer-events-none" />
        )}
      </div>

      {/* Nested children */}
      {hasChildren && block.children && (
        <LayersTab
          blocks={block.children as AnyBlock[]}
          selectedBlockId={selectedBlockId}
          onSelect={onSelect}
          onRemove={onRemove}
          onToggleVisibility={onToggleVisibility}
          onReorder={onReorder}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

// ── Block type icons ──────────────────────────────────────────────────────────

function BlockTypeIcon({
  type,
  size = 14,
}: {
  type: BlockType;
  size?: number;
}) {
  switch (type) {
    case "container":
      return <ContainerIcon size={size} />;
    case "text":
      return <TextIcon size={size} />;
    case "image":
      return <ImageIcon size={size} />;
    case "button":
      return <ButtonIcon size={size} />;
    case "hero":
      return <HeroIcon size={size} />;
    case "cta-band":
      return <CtaIcon size={size} />;
    case "rich-text":
      return <RichTextIcon size={size} />;
    case "image-text":
      return <ImageTextIcon size={size} />;
    case "testimonials":
      return <TestimonialsIcon size={size} />;
    case "newsletter":
      return <NewsletterIcon size={size} />;
    case "article-grid":
      return <ArticleGridIcon size={size} />;
    case "article-card":
      return <ArticleCardIcon size={size} />;
    case "article-image":
      return <ArticleImageIcon size={size} />;
    case "article-title":
      return <ArticleTitleIcon size={size} />;
    case "article-excerpt":
      return <ArticleExcerptIcon size={size} />;
    case "article-date":
      return <ArticleDateIcon size={size} />;
    case "article-tag":
      return <ArticleTagIcon size={size} />;
    default:
      return <ArticlesIcon size={size} />;
  }
}

// ── SVG Icons ─────────────────────────────────────────────────────────────────

function ContainerIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
    </svg>
  );
}
function TextIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="currentColor">
      <path d="M2 3h12v2H9v8H7V5H2V3z" />
    </svg>
  );
}
function ImageIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <circle cx="5.5" cy="5.5" r="1" />
      <path d="M14 10l-3.5-3.5L6 12" />
    </svg>
  );
}
function HeroIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="2" width="14" height="9" rx="1.5" />
      <path d="M5 14h6M8 11v3" />
    </svg>
  );
}
function ArticlesIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M5 6h6M5 8.5h6M5 11h4" />
    </svg>
  );
}
function CtaIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="5" width="14" height="6" rx="1.5" />
      <path d="M6 8h4" />
    </svg>
  );
}
function RichTextIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 4h12M2 7h12M2 10h8M2 13h6" />
    </svg>
  );
}
function ImageTextIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="3" width="6" height="10" rx="1" />
      <path d="M10 5h4M10 8h4M10 11h4" />
    </svg>
  );
}
function TestimonialsIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M14 10a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1h10a1 1 0 011 1v7z" />
    </svg>
  );
}
function NewsletterIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M1 5l7 5 7-5" />
    </svg>
  );
}

function ButtonIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="5" width="14" height="6" rx="2" />
      <path d="M5.5 8h5" strokeLinecap="round" />
    </svg>
  );
}

function NavLinksIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="3" width="14" height="10" rx="1.5" />
      <path d="M4 8h2M7 8h5M4 11h3" />
    </svg>
  );
}
function SubnavIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 4h10M3 8h7M3 12h4" />
    </svg>
  );
}
function SingleNavIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M3 8h10M10 5l3 3-3 3" />
    </svg>
  );
}
function SocialLinksIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="4" cy="8" r="2" />
      <circle cx="12" cy="4" r="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 7l4-2M6 9l4 2" />
    </svg>
  );
}
function SingleSocialIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5v6M5 8h6" />
    </svg>
  );
}

function PresetNavIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="2" width="14" height="5" rx="1" />
      <circle cx="3.5" cy="4.5" r="1" fill="currentColor" stroke="none" />
      <path d="M6 4.5h6M13 4.5h.5" />
      <path d="M1 10h5M8 10h3M13 10h2" strokeOpacity="0.4" />
    </svg>
  );
}

function PresetFooterIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="9" width="14" height="5" rx="1" />
      <path d="M1 6h5M8 6h3M13 6h2" strokeOpacity="0.4" />
      <path d="M3 11h3M7.5 11h2M11 11h2" />
    </svg>
  );
}

function ArticleGridIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="1" width="6" height="6" rx="1" />
      <rect x="9" y="1" width="6" height="6" rx="1" />
      <rect x="1" y="9" width="6" height="6" rx="1" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}

function ArticleCardIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="1" width="14" height="14" rx="2" />
      <rect
        x="1"
        y="1"
        width="14"
        height="6"
        rx="2"
        fill="currentColor"
        fillOpacity="0.15"
      />
      <path d="M3 10h6M3 12.5h4" />
    </svg>
  );
}

function ArticleImageIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="2" width="14" height="10" rx="1" />
      <path d="M1 9l4-3 3 2.5 2-1.5 5 4" strokeOpacity="0.7" />
      <circle cx="5" cy="5.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ArticleTitleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 4h12M2 4v8" />
      <path d="M5 8h6" strokeOpacity="0.5" />
      <path d="M5 11h4" strokeOpacity="0.3" />
    </svg>
  );
}

function ArticleExcerptIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 4h12" />
      <path d="M2 7h12" />
      <path d="M2 10h8" />
    </svg>
  );
}

function ArticleDateIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="2" width="14" height="13" rx="1" />
      <path d="M1 6h14" />
      <path d="M5 1v3M11 1v3" />
      <path d="M4 9h2M7 9h2M10 9h2M4 12h2M7 12h2" strokeOpacity="0.7" />
    </svg>
  );
}

function ArticleTagIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <rect x="1" y="4" width="9" height="8" rx="2" />
      <path d="M10 6l4 2-4 2" />
    </svg>
  );
}

function EyeIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="1.5" />
    </svg>
  );
}
function EyeOffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 2l12 12M6.5 6.5A2 2 0 0011 9.5M4 4.5C2.5 5.8 1 8 1 8s3 5 7 5c1.2 0 2.3-.3 3.3-.9M9 3.2C9.7 3.1 10.3 3 11 3c4 0 4 5 4 5s-.8 1.5-2 2.7" />
    </svg>
  );
}
function GripIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 10 14"
      width={size}
      height={size}
      fill="currentColor"
    >
      <circle cx="3" cy="2" r="1" />
      <circle cx="7" cy="2" r="1" />
      <circle cx="3" cy="6" r="1" />
      <circle cx="7" cy="6" r="1" />
      <circle cx="3" cy="10" r="1" />
      <circle cx="7" cy="10" r="1" />
    </svg>
  );
}

function TrashIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M2 4h12M5 4V3h6v1M6 7v5M10 7v5M3 4l1 9h8l1-9" />
    </svg>
  );
}
