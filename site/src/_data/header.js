/**
 * Fetches header builder block data from the backend.
 * Returns a per-language map: header.byLang[langCode] = HomeBlock[]
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn("[folio] Could not fetch language config for header data");
  }

  const byLang = {};

  for (const lang of languages) {
    try {
      const res = await fetch(
        `${BACKEND_URL}/api/v1/config/header?lang=${lang.code}`,
      );
      if (res.ok) {
        const blocks = await res.json();
        byLang[lang.code] = Array.isArray(blocks)
          ? blocks
              .filter((b) => b.visible !== false)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          : [];
      } else {
        byLang[lang.code] = [];
      }
    } catch {
      console.warn(`[folio] Could not fetch header data for lang ${lang.code}`);
      byLang[lang.code] = [];
    }
  }

  return { byLang };
}
