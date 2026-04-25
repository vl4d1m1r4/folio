import type { HomeBlock, PageBlock, NavLink, SocialLink } from "../../../api/types";
import { ContainerInspector } from "./ContainerInspector";
import { TextInspector } from "./TextInspector";
import { ImageInspector } from "./ImageInspector";
import { ButtonInspector } from "./ButtonInspector";
import { TemplateInspector } from "./TemplateInspector";

interface InspectorPanelProps {
  block: HomeBlock | PageBlock | null;
  mode: "home" | "page";
  activeLang: string;
  onConfigChange: (id: string, key: string, value: unknown) => void;
  onTransChange: (id: string, key: string, value: string) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}

export function InspectorPanel({
  block,
  mode,
  activeLang,
  onConfigChange,
  onTransChange,
  themeColors,
  navSnapshot,
  footerSnapshot,
  socialSnapshot,
}: InspectorPanelProps) {
  if (!block) {
    return (
      <div className="w-80 shrink-0 bg-(--color-bg) border-l border-(--color-border) flex flex-col">
        <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
          <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
            Inspector
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <svg
            viewBox="0 0 24 24"
            width={36}
            height={36}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-(--color-muted) opacity-40"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
          <p className="text-sm text-(--color-muted)">
            Select an element on the canvas to edit its properties.
          </p>
        </div>
      </div>
    );
  }

  const cfgChange = (key: string, value: unknown) =>
    onConfigChange(block.id, key, value);
  const transChange = (key: string, value: string) =>
    onTransChange(block.id, key, value);

  // Derive text content for TextInspector based on mode
  const textContent =
    block.type === "text"
      ? mode === "home"
        ? ((
            (block as HomeBlock).translations[activeLang] as
              | Record<string, string>
              | undefined
          )?.content ?? "")
        : ((block.config.content as string) ?? "")
      : "";

  const handleTextContentChange = (html: string) => {
    if (mode === "home") {
      onTransChange(block.id, "content", html);
    } else {
      onConfigChange(block.id, "content", html);
    }
  };

  return (
    <div className="w-80 shrink-0 bg-(--color-bg) border-l border-(--color-border) flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {block.type === "container" && (
          <ContainerInspector
            config={block.config}
            onConfigChange={cfgChange}
            themeColors={themeColors}
          />
        )}

        {block.type === "text" && (
          <TextInspector
            config={block.config}
            content={textContent}
            onConfigChange={cfgChange}
            onContentChange={handleTextContentChange}
            themeColors={themeColors}
          />
        )}

        {block.type === "image" && (
          <ImageInspector config={block.config} onConfigChange={cfgChange} themeColors={themeColors} />
        )}

        {block.type === "button" && (
          <ButtonInspector config={block.config} onConfigChange={cfgChange} themeColors={themeColors} />
        )}

        {!["container", "text", "image", "button"].includes(block.type) && (
          <TemplateInspector
            block={block}
            mode={mode}
            activeLang={activeLang}
            onConfigChange={cfgChange}
            onTransChange={transChange}
            themeColors={themeColors}
            navSnapshot={navSnapshot}
            footerSnapshot={footerSnapshot}
            socialSnapshot={socialSnapshot}
          />
        )}
      </div>

      {/* Block ID footer (for debugging / element ID feature) */}
      <div className="shrink-0 px-4 py-2 border-t border-(--color-border) bg-(--color-bg-surface)">
        <p className="text-[10px] text-(--color-muted) font-mono truncate">
          id: {block.id}
        </p>
      </div>
    </div>
  );
}
