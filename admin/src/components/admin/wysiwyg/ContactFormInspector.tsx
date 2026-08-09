import type { HomeBlock, PageBlock } from "../../../api/types";
import { Field } from "../blockShared";
import { CustomStyleSection, ElementIdSection } from "./InspectorShared";

interface Props {
  block: HomeBlock | PageBlock;
  mode: "home" | "page" | "article";
  activeLang: string;
  onConfigChange: (key: string, value: unknown) => void;
  onTransChange: (key: string, value: string) => void;
}

const textFields = [
  ["title", "Heading"],
  ["intro", "Introduction"],
  ["requiredLabel", "Required-fields note"],
  ["firstNameLabel", "First name label"],
  ["lastNameLabel", "Last name label"],
  ["companyLabel", "Company label"],
  ["emailLabel", "Email label"],
  ["phoneLabel", "Phone label"],
  ["messageLabel", "Message label"],
  ["submitLabel", "Submit button"],
  ["successMessage", "Success message"],
  ["errorMessage", "Error message"],
] as const;

export function ContactFormInspector({
  block,
  mode,
  activeLang,
  onConfigChange,
  onTransChange,
}: Props) {
  const usesTranslations = mode === "home" || mode === "article";
  const value = (key: string): string =>
    usesTranslations
      ? ((block as HomeBlock).translations?.[activeLang]?.[key] ?? "")
      : ((block.config[key] as string) ?? "");
  const setValue = (key: string, next: string) =>
    usesTranslations
      ? onTransChange(key, next)
      : onConfigChange(key, next);

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Contact Form Settings
        </span>
      </div>

      <div className="p-3 space-y-4">
        <div className="space-y-3">
          {textFields.slice(0, 3).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={value(key)}
              onChange={(next) => setValue(key, next)}
            />
          ))}
        </div>

        <div className="border-t border-(--color-border) pt-3 space-y-3">
          <p className="text-xs font-semibold">Fields</p>
          {textFields.slice(3, 9).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={value(key)}
              onChange={(next) => setValue(key, next)}
            />
          ))}

          <div className="space-y-2">
            {[
              ["showLastName", "Show last name"],
              ["showCompany", "Show company"],
              ["showPhone", "Show phone"],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={block.config[key] !== false}
                  onChange={(event) =>
                    onConfigChange(key, event.target.checked)
                  }
                  className="rounded"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="border-t border-(--color-border) pt-3 space-y-3">
          <p className="text-xs font-semibold">Layout</p>
          <div>
            <label className="block text-xs font-medium mb-1">Columns</label>
            <div className="flex rounded border border-(--color-border) overflow-hidden">
              {[1, 2].map((columns) => (
                <button
                  key={columns}
                  type="button"
                  onClick={() => onConfigChange("columns", columns)}
                  className={`flex-1 py-1.5 text-xs border-r last:border-r-0 border-(--color-border) ${
                    Number(block.config.columns ?? 1) === columns
                      ? "bg-(--color-accent) text-white"
                      : "bg-(--color-bg) hover:bg-(--color-bg-surface)"
                  }`}
                >
                  {columns}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Message rows
            </label>
            <input
              type="number"
              min={3}
              max={12}
              value={Number(block.config.messageRows) || 5}
              onChange={(event) =>
                onConfigChange(
                  "messageRows",
                  Math.min(12, Math.max(3, Number(event.target.value) || 5)),
                )
              }
              className="w-24 px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            />
          </div>
        </div>

        <div className="border-t border-(--color-border) pt-3 space-y-3">
          <p className="text-xs font-semibold">Submission</p>
          {textFields.slice(9).map(([key, label]) => (
            <Field
              key={key}
              label={label}
              value={value(key)}
              onChange={(next) => setValue(key, next)}
            />
          ))}
        </div>

        <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
          <ElementIdSection
            config={block.config}
            onChange={onConfigChange}
          />
          <CustomStyleSection
            config={block.config}
            onChange={onConfigChange}
          />
        </div>
      </div>
    </div>
  );
}
