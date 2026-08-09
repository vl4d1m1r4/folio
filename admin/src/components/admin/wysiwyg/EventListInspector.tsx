import { useState } from "react";
import {
  CalendarPlus,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import type { HomeBlock, PageBlock } from "../../../api/types";
import { Field } from "../blockShared";
import { MediaPickerModal } from "../MediaPickerModal";
import { CustomStyleSection, ElementIdSection } from "./InspectorShared";
import {
  eventItemText,
  eventTextKey,
  generatedEventPath,
  parseEventDate,
  slugifyEvent,
  type EventListItem,
  type EventTextField,
} from "./eventList";

interface Props {
  block: HomeBlock | PageBlock;
  mode: "home" | "page" | "article";
  activeLang: string;
  onConfigChange: (key: string, value: unknown) => void;
  onTransChange: (key: string, value: string) => void;
}

function newEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function EventListInspector({
  block,
  mode,
  activeLang,
  onConfigChange,
  onTransChange,
}: Props) {
  const [mediaTarget, setMediaTarget] = useState<string | null>(null);
  const items = Array.isArray(block.config.items)
    ? (block.config.items as EventListItem[])
    : [];
  const usesTranslations = mode === "home" || mode === "article";

  const localizedValue = (key: string): string =>
    usesTranslations
      ? ((block as HomeBlock).translations?.[activeLang]?.[key] ?? "")
      : ((block.config[key] as string) ?? "");

  const setLocalizedValue = (key: string, value: string) =>
    usesTranslations ? onTransChange(key, value) : onConfigChange(key, value);

  const updateItems = (next: EventListItem[]) =>
    onConfigChange("items", next);

  const updateItem = (id: string, patch: Partial<EventListItem>) =>
    updateItems(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));

  const updateItemText = (
    item: EventListItem,
    field: EventTextField,
    value: string,
  ) => {
    if (usesTranslations) {
      onTransChange(eventTextKey(item.id, field), value);
    } else {
      updateItem(item.id, { [field]: value });
    }
  };

  const addEvent = () => {
    const item: EventListItem = {
      id: newEventId(),
      startDate: "",
      endDate: "",
      image: "",
      detailMode: "generated",
      slug: "",
      title: "New event",
      description: "",
      location: "",
      detailUrl: "",
      imageAlt: "",
      details: "",
    };
    updateItems([...items, item]);
  };

  return (
    <div>
      <div className="px-4 py-3 border-b border-(--color-border) bg-(--color-bg-surface)">
        <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">
          Event List Settings
        </span>
      </div>
      <div className="p-3 space-y-4">
        <Field
          label="Section title"
          value={localizedValue("title")}
          onChange={(value) => setLocalizedValue("title", value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Show</label>
            <select
              value={(block.config.filter as string) ?? "all"}
              onChange={(event) => onConfigChange("filter", event.target.value)}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="all">All events</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Order</label>
            <select
              value={(block.config.sort as string) ?? "ascending"}
              onChange={(event) => onConfigChange("sort", event.target.value)}
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            >
              <option value="ascending">Oldest first</option>
              <option value="descending">Newest first</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Columns</label>
            <div className="flex rounded border border-(--color-border) overflow-hidden">
              {[1, 2, 3].map((columns) => (
                <button
                  key={columns}
                  type="button"
                  onClick={() => onConfigChange("columns", columns)}
                  className={`flex-1 py-1.5 text-xs border-r last:border-r-0 border-(--color-border) ${
                    Number(block.config.columns) === columns ||
                    (!block.config.columns && columns === 1)
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
              Maximum items
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={Number(block.config.maxItems) || 0}
              onChange={(event) =>
                onConfigChange(
                  "maxItems",
                  Math.max(0, Number(event.target.value) || 0),
                )
              }
              className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={block.config.showImages !== false}
            onChange={(event) =>
              onConfigChange("showImages", event.target.checked)
            }
            className="rounded"
          />
          Show event images
        </label>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Events</span>
            <button
              type="button"
              onClick={addEvent}
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-(--color-border) hover:bg-(--color-bg-surface)"
            >
              <CalendarPlus size={14} />
              Add event
            </button>
          </div>

          {items.length === 0 && (
            <p className="py-5 text-center text-xs text-(--color-muted) border border-dashed border-(--color-border) rounded">
              No events added
            </p>
          )}

          {items.map((item, index) => {
            const start = parseEventDate(item.startDate);
            const end = parseEventDate(item.endDate);
            const invalidRange = !!(start && end && end < start);
            const eventTitle = eventItemText(
              block,
              item,
              "title",
              activeLang,
              mode,
            );
            const detailMode = item.detailMode ?? "generated";
            const generatedPath = generatedEventPath(
              item,
              eventTitle,
              activeLang,
            );
            return (
              <div
                key={item.id}
                className="border border-(--color-border) rounded-lg p-3 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase text-(--color-muted)">
                    Event {index + 1}
                  </span>
                  <div className="flex items-center">
                    <button
                      type="button"
                      title="Remove event"
                      aria-label="Remove event"
                      onClick={() =>
                        updateItems(items.filter((entry) => entry.id !== item.id))
                      }
                      className="p-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <Field
                  label="Title"
                  value={eventTitle}
                  onChange={(value) => updateItemText(item, "title", value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Starts
                    </label>
                    <input
                      type="datetime-local"
                      value={item.startDate ?? ""}
                      onChange={(event) =>
                        updateItem(item.id, { startDate: event.target.value })
                      }
                      className="w-full min-w-0 px-2 py-1.5 border border-(--color-border) rounded text-xs bg-(--color-bg)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Ends
                    </label>
                    <input
                      type="datetime-local"
                      min={item.startDate || undefined}
                      value={item.endDate ?? ""}
                      onChange={(event) =>
                        updateItem(item.id, { endDate: event.target.value })
                      }
                      className="w-full min-w-0 px-2 py-1.5 border border-(--color-border) rounded text-xs bg-(--color-bg)"
                    />
                  </div>
                </div>
                {invalidRange && (
                  <p className="text-xs text-red-600">
                    End date must be after the start date.
                  </p>
                )}

                <Field
                  label="Location"
                  value={eventItemText(block, item, "location", activeLang, mode)}
                  onChange={(value) => updateItemText(item, "location", value)}
                />

                <div>
                  <label className="block text-xs font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={eventItemText(
                      block,
                      item,
                      "description",
                      activeLang,
                      mode,
                    )}
                    onChange={(event) =>
                      updateItemText(item, "description", event.target.value)
                    }
                    className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) resize-y"
                  />
                </div>

                <div className="space-y-2 pt-2 border-t border-(--color-border)">
                  <div>
                    <label className="block text-xs font-medium mb-1">
                      Details destination
                    </label>
                    <select
                      value={detailMode}
                      onChange={(event) =>
                        updateItem(item.id, {
                          detailMode: event.target.value as
                            | "generated"
                            | "external",
                        })
                      }
                      className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
                    >
                      <option value="generated">Generated event page</option>
                      <option value="external">External or custom URL</option>
                    </select>
                  </div>

                  {detailMode === "generated" ? (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Page slug
                        </label>
                        <input
                          type="text"
                          value={item.slug ?? ""}
                          placeholder={slugifyEvent(eventTitle) || `event-${item.id}`}
                          onChange={(event) =>
                            updateItem(item.id, {
                              slug: slugifyEvent(event.target.value),
                            })
                          }
                          className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)"
                        />
                      </div>
                      <p className="text-[11px] text-(--color-muted) break-all">
                        Page URL: {generatedPath}
                      </p>
                      <div>
                        <label className="block text-xs font-medium mb-1">
                          Full event details
                        </label>
                        <textarea
                          rows={5}
                          value={eventItemText(
                            block,
                            item,
                            "details",
                            activeLang,
                            mode,
                          )}
                          onChange={(event) =>
                            updateItemText(item, "details", event.target.value)
                          }
                          className="w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg) resize-y"
                        />
                      </div>
                    </>
                  ) : (
                    <Field
                      label="Details URL"
                      value={eventItemText(
                        block,
                        item,
                        "detailUrl",
                        activeLang,
                        mode,
                      )}
                      onChange={(value) =>
                        updateItemText(item, "detailUrl", value)
                      }
                    />
                  )}
                </div>

                {block.config.showImages !== false && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium">Image</label>
                    {item.image ? (
                      <div className="flex items-center gap-2">
                        <img
                          src={item.image}
                          alt=""
                          className="w-16 h-12 object-cover rounded border border-(--color-border)"
                        />
                        <button
                          type="button"
                          onClick={() => setMediaTarget(item.id)}
                          className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded border border-(--color-border)"
                        >
                          <ImageIcon size={13} /> Change
                        </button>
                        <button
                          type="button"
                          onClick={() => updateItem(item.id, { image: "" })}
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMediaTarget(item.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs rounded border border-dashed border-(--color-border) hover:bg-(--color-bg-surface)"
                      >
                        <ImageIcon size={14} /> Select image
                      </button>
                    )}
                    {item.image && (
                      <Field
                        label="Image alt text"
                        value={eventItemText(
                          block,
                          item,
                          "imageAlt",
                          activeLang,
                          mode,
                        )}
                        onChange={(value) =>
                          updateItemText(item, "imageAlt", value)
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Field
          label="Details link label"
          value={localizedValue("detailLabel") || "Details"}
          onChange={(value) => setLocalizedValue("detailLabel", value)}
        />
        <Field
          label="Detail page back label"
          value={localizedValue("backLabel") || "Back to events"}
          onChange={(value) => setLocalizedValue("backLabel", value)}
        />
        <Field
          label="Empty state message"
          value={localizedValue("emptyText") || "No events found."}
          onChange={(value) => setLocalizedValue("emptyText", value)}
        />

        <div className="pt-2 border-t border-(--color-border) divide-y divide-(--color-border)">
          <ElementIdSection config={block.config} onChange={onConfigChange} />
          <CustomStyleSection config={block.config} onChange={onConfigChange} />
        </div>
      </div>

      {mediaTarget && (
        <MediaPickerModal
          mode="image"
          onSelect={(file) => {
            updateItem(mediaTarget, { image: `/uploads/${file.filename}` });
            setMediaTarget(null);
          }}
          onClose={() => setMediaTarget(null)}
        />
      )}
    </div>
  );
}
