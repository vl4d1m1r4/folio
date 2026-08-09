import {
  eventField,
  generatedEventPath,
} from "../../lib/events.js";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

function withAnchor(url, elementId) {
  return elementId ? `${url}#${encodeURIComponent(elementId)}` : url;
}

function collectEvents(blocks, lang, sourceUrl, output) {
  if (!Array.isArray(blocks)) return;

  for (const block of blocks) {
    if (!block || block.visible === false) continue;
    if (block.type === "event-list") {
      const config = block.config ?? {};
      const backUrl = withAnchor(sourceUrl, config.elementId);
      const items = Array.isArray(config.items) ? config.items : [];
      for (const item of items) {
        if (!item || item.detailMode === "external") continue;
        const title = eventField(config, item, "title");
        if (!title) continue;
        output.push({
          lang,
          url: generatedEventPath(config, item, lang.code),
          backUrl,
          backLabel: config.backLabel || "Back to events",
          title,
          description: eventField(config, item, "description"),
          details: eventField(config, item, "details"),
          location: eventField(config, item, "location"),
          imageAlt: eventField(config, item, "imageAlt") || title,
          startDate: item.startDate || "",
          endDate: item.endDate || "",
          image: item.image || "",
        });
      }
    }
    collectEvents(block.children, lang, sourceUrl, output);
  }
}

async function fetchJson(path, fallback) {
  try {
    const response = await fetch(`${BACKEND_URL}${path}`);
    return response.ok ? await response.json() : fallback;
  } catch {
    return fallback;
  }
}

export default async function () {
  const languages = await fetchJson("/api/v1/config/languages", [
    { code: "en", label: "English", dir: "ltr", default: true },
  ]);
  const events = [];

  for (const lang of languages) {
    const [home, articleLayout, pages] = await Promise.all([
      fetchJson(`/api/v1/config/home?lang=${encodeURIComponent(lang.code)}`, []),
      fetchJson(
        `/api/v1/config/article-layout?lang=${encodeURIComponent(lang.code)}`,
        [],
      ),
      fetchJson(`/api/v1/pages?lang=${encodeURIComponent(lang.code)}`, []),
    ]);

    collectEvents(home, lang, `/${lang.code}/`, events);
    collectEvents(
      articleLayout,
      lang,
      `/${lang.code}/articles/`,
      events,
    );
    for (const page of Array.isArray(pages) ? pages : []) {
      collectEvents(
        page.sections,
        lang,
        `/${lang.code}/${page.slug}/`,
        events,
      );
    }
  }

  const unique = new Map();
  for (const event of events) {
    if (unique.has(event.url)) {
      console.warn(`[folio] Duplicate generated event URL skipped: ${event.url}`);
      continue;
    }
    unique.set(event.url, event);
  }
  return [...unique.values()];
}
