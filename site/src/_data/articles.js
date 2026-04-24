/**
 * Fetches all published articles for every configured language.
 *
 * Exports:
 *   articles.byLang  — { [langCode]: PublicArticle[] }
 *   articles.pages   — Array<{ lang: Language, article: PublicArticle }>  (for article.njk pagination)
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const LIMIT = 200;

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const langRes = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (langRes.ok) languages = await langRes.json();
  } catch {
    console.warn(
      "[folio] Could not fetch language config for articles data",
    );
  }

  const byLang = {};
  const pages = [];

  for (const lang of languages) {
    let items = [];
    try {
      let page = 1;
      while (true) {
        const res = await fetch(
          `${BACKEND_URL}/api/v1/articles?lang=${lang.code}&limit=${LIMIT}&page=${page}`,
        );
        if (!res.ok) break;
        const data = await res.json();
        items = items.concat(data.items ?? []);
        if (items.length >= data.total || (data.items ?? []).length === 0)
          break;
        page++;
      }
    } catch {
      console.warn(
        `[folio] Could not fetch articles for lang: ${lang.code}`,
      );
    }

    byLang[lang.code] = items;
    for (const article of items) {
      pages.push({ lang, article });
    }
  }

  // Fallback: for non-default languages, include articles that have no
  // translation in that language, using the default language's content.
  const defaultLang = languages.find((l) => l.default) ?? languages[0];
  const defaultArticles = byLang[defaultLang.code] ?? [];

  for (const lang of languages) {
    if (lang.code === defaultLang.code) continue;
    const existingIds = new Set((byLang[lang.code] ?? []).map((a) => a.id));
    const fallbacks = defaultArticles.filter((a) => !existingIds.has(a.id));
    if (fallbacks.length === 0) continue;
    console.log(
      `[folio] Falling back ${fallbacks.length} article(s) to "${defaultLang.code}" for lang "${lang.code}"`,
    );
    byLang[lang.code] = [...(byLang[lang.code] ?? []), ...fallbacks];
    for (const article of fallbacks) {
      pages.push({ lang, article });
    }
  }

  return { byLang, pages };
}
