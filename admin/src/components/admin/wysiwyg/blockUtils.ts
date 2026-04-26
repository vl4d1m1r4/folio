/**
 * Generic block-tree utilities shared by both the Home builder (HomeBlock)
 * and the Page builder (PageBlock).
 *
 * Both block types satisfy the same structural shape for the fields used in
 * tree operations, so a single generic AnyBlock interface covers both.
 */
import type { BlockType, HomeBlock, PageBlock } from "../../../api/types";
import {
  applyContainerDefaults,
  applyTextDefaults,
  applyImageDefaults,
  applyButtonDefaults,
  applyNavLinksDefaults,
  applySubnavLinksDefaults,
  applySingleNavItemDefaults,
  applySocialLinksDefaults,
  applySingleSocialLinkDefaults,
  applyArticleGridDefaults,
  applyArticleCardDefaults,
  applyArticleImageDefaults,
  applyArticleTitleDefaults,
  applyArticleExcerptDefaults,
  applyArticleDateDefaults,
  applyArticleTagDefaults,
} from "../blockShared";

// ── Shared structural interface ────────────────────────────────────────────────

export interface AnyBlock {
  id: string;
  type: BlockType;
  visible: boolean;
  order: number;
  config: Record<string, unknown>;
  children?: AnyBlock[];
}

// ── Tree operations ────────────────────────────────────────────────────────────

export function withNormalizedOrder<T extends AnyBlock>(blocks: T[]): T[] {
  return blocks.map((b, i) => ({ ...b, order: i }));
}

export function findBlock<T extends AnyBlock>(
  blocks: T[],
  id: string,
): T | null {
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      const found = findBlock(b.children as T[], id);
      if (found) return found;
    }
  }
  return null;
}

export function patchBlocks<T extends AnyBlock>(
  blocks: T[],
  id: string,
  patch: Partial<T>,
): T[] {
  return blocks.map((b) => {
    if (b.id === id) return { ...b, ...patch };
    if (b.children)
      return { ...b, children: patchBlocks(b.children as T[], id, patch) };
    return b;
  });
}

export function removeFromBlocks<T extends AnyBlock>(
  blocks: T[],
  id: string,
): T[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) =>
      b.children
        ? { ...b, children: removeFromBlocks(b.children as T[], id) }
        : b,
    );
}

export function moveInBlocks<T extends AnyBlock>(
  blocks: T[],
  id: string,
  dir: "up" | "down",
): T[] {
  const idx = blocks.findIndex((b) => b.id === id);
  if (idx !== -1) {
    const ni = dir === "up" ? idx - 1 : idx + 1;
    if (ni < 0 || ni >= blocks.length) return blocks;
    const next = [...blocks];
    [next[idx], next[ni]] = [next[ni], next[idx]];
    return next;
  }
  return blocks.map((b) =>
    b.children
      ? { ...b, children: moveInBlocks(b.children as T[], id, dir) }
      : b,
  );
}

/**
 * Inserts `block` before or after the element with `targetId` anywhere in the
 * block tree. Used by reorderInTree after the source block has been removed.
 */
function insertNearBlock<T extends AnyBlock>(
  blocks: T[],
  block: T,
  targetId: string,
  before: boolean,
): T[] {
  const toIdx = blocks.findIndex((b) => b.id === targetId);
  if (toIdx !== -1) {
    const arr = [...blocks];
    arr.splice(before ? toIdx : toIdx + 1, 0, block);
    return withNormalizedOrder(arr);
  }
  return blocks.map((b) => {
    if (!b.children) return b;
    return {
      ...b,
      children: insertNearBlock(b.children as T[], block, targetId, before),
    };
  });
}

/**
 * Moves `fromId` to just before/after `toId` anywhere in the block tree.
 * Works whether the two blocks are siblings, in different containers, or at
 * different nesting levels.
 * @param before – true = insert before toId, false = insert after toId
 */
export function reorderInTree<T extends AnyBlock>(
  blocks: T[],
  fromId: string,
  toId: string,
  before: boolean,
): T[] {
  const fromBlock = findBlock(blocks, fromId);
  if (!fromBlock) return blocks;
  const without = removeFromBlocks(blocks, fromId);
  return insertNearBlock(without, { ...fromBlock } as T, toId, before);
}

// ── Block factories ────────────────────────────────────────────────────────────

function baseConfig(type: BlockType): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (type === "featured-articles" || type === "latest-articles")
    config.max_count = 6;
  if (type === "image-text") config.image_position = "left";
  if (type === "container") applyContainerDefaults(config);
  if (type === "text") applyTextDefaults(config);
  if (type === "image") applyImageDefaults(config);
  if (type === "button") applyButtonDefaults(config);
  if (type === "nav-links") applyNavLinksDefaults(config);
  if (type === "subnav-links") applySubnavLinksDefaults(config);
  if (type === "single-nav-item") applySingleNavItemDefaults(config);
  if (type === "social-links") applySocialLinksDefaults(config);
  if (type === "single-social-link") applySingleSocialLinkDefaults(config);
  if (type === "article-grid") applyArticleGridDefaults(config);
  if (type === "article-card") applyArticleCardDefaults(config);
  if (type === "article-image") applyArticleImageDefaults(config);
  if (type === "article-title") applyArticleTitleDefaults(config);
  if (type === "article-excerpt") applyArticleExcerptDefaults(config);
  if (type === "article-date") applyArticleDateDefaults(config);
  if (type === "article-tag") applyArticleTagDefaults(config);
  return config;
}

function uniqueId(type: BlockType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
/**
 * Builds a default article-card block with the standard field children.
 * structure: article-card → [article-image, content container → [article-tag, article-title, article-excerpt, article-date]]
 */
function buildDefaultArticleCard(order: number): HomeBlock {
  const card = makeHomeBlock("article-card", order);

  const img = makeHomeBlock("article-image", 0);

  const content = makeHomeBlock("container", 1);
  content.config.direction = "col";
  content.config.wrap = "nowrap";
  content.config.width = "w-full";
  content.config.paddingTop = 4;
  content.config.paddingBottom = 4;
  content.config.paddingLeft = 4;
  content.config.paddingRight = 4;
  content.config.gapX = 0;
  content.config.gapY = 2;

  const tag = makeHomeBlock("article-tag", 0);
  const title = makeHomeBlock("article-title", 1);
  const excerpt = makeHomeBlock("article-excerpt", 2);
  const date = makeHomeBlock("article-date", 3);

  content.children = withNormalizedOrder([
    tag,
    title,
    excerpt,
    date,
  ]) as HomeBlock[];
  card.children = withNormalizedOrder([img, content]) as HomeBlock[];

  return card;
}

/**
 * Builds the default children for an article-grid block:
 *   [0] article-card block (the card template)
 */
export function buildDefaultArticleGridChildren(): HomeBlock[] {
  return [buildDefaultArticleCard(0)];
}

export function makePageBlock(type: BlockType, order: number): PageBlock {
  return {
    id: uniqueId(type),
    type,
    visible: true,
    order,
    config: baseConfig(type),
    children:
      type === "container"
        ? []
        : type === "article-grid"
          ? (buildDefaultArticleGridChildren() as unknown as PageBlock[])
          : undefined,
  };
}

export function makeHomeBlock(type: BlockType, order: number): HomeBlock {
  return {
    id: uniqueId(type),
    type,
    visible: true,
    order,
    config: baseConfig(type),
    translations: {},
    children:
      type === "container"
        ? []
        : type === "article-grid"
          ? buildDefaultArticleGridChildren()
          : undefined,
  };
}
