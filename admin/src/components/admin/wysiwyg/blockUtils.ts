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
  return config;
}

function uniqueId(type: BlockType): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function makePageBlock(type: BlockType, order: number): PageBlock {
  return {
    id: uniqueId(type),
    type,
    visible: true,
    order,
    config: baseConfig(type),
    children: type === "container" ? [] : undefined,
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
    children: type === "container" ? [] : undefined,
  };
}
