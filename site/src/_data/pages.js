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

  for (const lang of languages) {
    let pages = [];
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/pages?lang=${lang.code}`);
      if (res.ok) pages = await res.json();
    } catch {
      console.warn(`[folio] Could not fetch pages for lang ${lang.code}`);
    }
    byLang[lang.code] = pages;
    for (const page of pages) {
      items.push({ lang, page });
    }
  }

  return { byLang, items };
}
