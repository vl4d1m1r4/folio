function parseEventDate(value) {
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

export function eventField(config, item, field) {
  if (!item || typeof item !== "object") return "";
  const translated = config?.[`event_${item.id}_${field}`];
  return typeof translated === "string" && translated
    ? translated
    : typeof item[field] === "string"
      ? item[field]
      : "";
}

export function slugifyEvent(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generatedEventPath(config, item, lang = "en") {
  const title = eventField(config, item, "title");
  const slug = slugifyEvent(item?.slug || title) || `event-${item?.id || "item"}`;
  return `/${encodeURIComponent(lang || "en")}/events/${slug}/`;
}

export function eventDetailUrl(config, item, lang = "en") {
  if (item?.detailMode === "external") {
    return safeEventUrl(eventField(config, item, "detailUrl"));
  }
  return generatedEventPath(config, item, lang);
}

export function formatEventDateRange(startValue, endValue, locale = "en") {
  const start = parseEventDate(startValue);
  const end = parseEventDate(endValue);
  if (!start) return startValue || "";

  const options = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(String(startValue).includes("T")
      ? { hour: "numeric", minute: "2-digit" }
      : {}),
  };
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat(locale || "en", options);
  } catch {
    formatter = new Intl.DateTimeFormat("en", options);
  }

  if (!end) return formatter.format(start);
  try {
    return formatter.formatRange(start, end);
  } catch {
    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }
}

export function safeEventUrl(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("./") ||
    trimmed.startsWith("../") ||
    trimmed.startsWith("#")
  ) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}
