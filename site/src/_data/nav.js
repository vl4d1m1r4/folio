/**
 * Fetches nav links from the backend settings API, resolved per language.
 * Returns { byLang: { [langCode]: NavLink[] } }
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

const FALLBACK = [
  { type: "builtin", label: "Home", url: "/", order: 0 },
  { type: "builtin", label: "Articles", url: "/articles/", order: 1 },
  { type: "builtin", label: "Contact", url: "/contact/", order: 2 },
];

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];
  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn("[folio] Could not fetch languages for nav data");
  }

  const byLang = {};
  for (const lang of languages) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/v1/config/nav?lang=${lang.code}`,
      );
      if (res.ok) {
        const links = await res.json();
        byLang[lang.code] = Array.isArray(links)
          ? links.sort((a, b) => a.order - b.order)
          : FALLBACK;
      } else {
        byLang[lang.code] = FALLBACK;
      }
    } catch {
      console.warn(
        `[folio] Could not fetch nav links for lang ${lang.code}`,
      );
      byLang[lang.code] = FALLBACK;
    }
  }
  return { byLang };
}
