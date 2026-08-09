import type { HomeBlock, PageBlock } from "../../../api/types";

export interface EventListItem {
  id: string;
  startDate: string;
  endDate: string;
  image: string;
  detailMode?: "generated" | "external";
  slug?: string;
  title?: string;
  description?: string;
  location?: string;
  detailUrl?: string;
  imageAlt?: string;
  details?: string;
}

export type EventFilter = "all" | "upcoming" | "past";
export type EventSort = "ascending" | "descending";
export type EventTextField =
  | "title"
  | "description"
  | "location"
  | "detailUrl"
  | "imageAlt"
  | "details";

export function eventTextKey(id: string, field: EventTextField): string {
  return `event_${id}_${field}`;
}

export function slugifyEvent(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generatedEventPath(
  item: EventListItem,
  title: string,
  lang: string,
): string {
  const slug = slugifyEvent(item.slug || title) || `event-${item.id}`;
  return `/${encodeURIComponent(lang || "en")}/events/${slug}/`;
}

export function eventItemText(
  block: HomeBlock | PageBlock,
  item: EventListItem,
  field: EventTextField,
  activeLang: string,
  mode: "home" | "page" | "article",
): string {
  if (mode === "home" || mode === "article") {
    return (
      (block as HomeBlock).translations?.[activeLang]?.[
        eventTextKey(item.id, field)
      ] ??
      item[field] ??
      ""
    );
  }
  return item[field] ?? "";
}

export function parseEventDate(value: string): Date | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      )
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function filterAndSortEvents(
  items: EventListItem[],
  filter: EventFilter,
  sort: EventSort,
  maxItems = 0,
  now = Date.now(),
): EventListItem[] {
  const filtered = items.filter((item) => {
    if (filter === "all") return true;
    const start = parseEventDate(item.startDate)?.getTime();
    if (start === undefined) return false;
    const end = parseEventDate(item.endDate)?.getTime() ?? start;
    return filter === "past" ? end < now : end >= now;
  });

  filtered.sort((a, b) => {
    const aTime = parseEventDate(a.startDate)?.getTime();
    const bTime = parseEventDate(b.startDate)?.getTime();
    if (aTime === undefined && bTime === undefined) return 0;
    if (aTime === undefined) return 1;
    if (bTime === undefined) return -1;
    return sort === "descending" ? bTime - aTime : aTime - bTime;
  });

  return maxItems > 0 ? filtered.slice(0, maxItems) : filtered;
}

export function formatEventDateRange(
  startValue: string,
  endValue: string,
  locale: string,
): string {
  const start = parseEventDate(startValue);
  const end = parseEventDate(endValue);
  if (!start) return startValue;

  const hasTime = startValue.includes("T");
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(hasTime ? { hour: "numeric", minute: "2-digit" } : {}),
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat(locale || "en", options);
  } catch {
    formatter = new Intl.DateTimeFormat("en", options);
  }

  if (!end) return formatter.format(start);
  const rangeFormatter = formatter as Intl.DateTimeFormat & {
    formatRange?: (startDate: Date, endDate: Date) => string;
  };
  return typeof rangeFormatter.formatRange === "function"
    ? rangeFormatter.formatRange(start, end)
    : `${formatter.format(start)} - ${formatter.format(end)}`;
}
