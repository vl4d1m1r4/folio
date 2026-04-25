/**
 * Fetches published custom pages for every configured language.
 * Exports:
 *   pages.byLang  — { [langCode]: PublicPage[] }
 *   pages.items   — Array<{ lang, page }> for page.njk pagination
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn("[folio] Could not fetch language config for pages data");
  }

  const byLang = {};
  const items = [];

  // Reserved slugs that would conflict with built-in Eleventy templates.
  const RESERVED_SLUGS = new Set(["", "index"]);

  for (const lang of languages) {
    let pages = [];
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/pages?lang=${lang.code}`);
      if (res.ok) pages = await res.json();
    } catch {
      console.warn(`[folio] Could not fetch pages for lang ${lang.code}`);
    }
    // Filter out pages whose slug would collide with index.njk or other reserved paths.
    pages = pages.filter(
      (p) => !RESERVED_SLUGS.has((p.slug ?? "").toLowerCase()),
    );
    byLang[lang.code] = pages;
    for (const page of pages) {
      items.push({ lang, page });
    }
  }

  // Fallback: for non-default languages, include pages that have no
  // translation in that language, using the default language's content.
  const defaultLang = languages.find((l) => l.default) ?? languages[0];
  const defaultPages = byLang[defaultLang.code] ?? [];

  for (const lang of languages) {
    if (lang.code === defaultLang.code) continue;
    const existingIds = new Set((byLang[lang.code] ?? []).map((p) => p.id));
    const fallbacks = defaultPages.filter(
      (p) =>
        !existingIds.has(p.id) &&
        !RESERVED_SLUGS.has((p.slug ?? "").toLowerCase()),
    );
    if (fallbacks.length === 0) continue;
    console.log(
      `[folio] Falling back ${fallbacks.length} page(s) to "${defaultLang.code}" for lang "${lang.code}"`,
    );
    byLang[lang.code] = [...(byLang[lang.code] ?? []), ...fallbacks];
    for (const page of fallbacks) {
      items.push({ lang, page });
    }
  }

  return { byLang, items };
}
