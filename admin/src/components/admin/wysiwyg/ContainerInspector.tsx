import { ContainerBlockEditor } from "../blockShared";

interface ContainerInspectorProps {
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
}

export function ContainerInspector({
  config,
  onConfigChange,
  themeColors,
}: ContainerInspectorProps) {
  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Container Settings
        </span>
      </div>
      <div className="p-3 overflow-y-auto">
        <ContainerBlockEditor
          config={config}
          setConfig={onConfigChange}
          themeColors={themeColors}
        />
      </div>
    </div>
  );
}
