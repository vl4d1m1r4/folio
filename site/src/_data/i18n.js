/**
 * Fetches per-language UI strings from backend settings.
 * Returns { [langCode]: { [key]: string } }
 * Falls back to built-in English defaults if backend is unavailable.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

const EN_DEFAULTS = {
  contact_title: "Contact",
  contact_intro: "Fill in the form below and we'll get back to you.",
  contact_first_name: "First name",
  contact_last_name: "Last name",
  contact_company: "Company",
  contact_email: "Email",
  contact_phone: "Phone",
  contact_message: "Message",
  contact_submit: "Send message",
  contact_success: "Thank you for your message — we'll be in touch soon!",
  contact_error: "Something went wrong. Please try again.",
  unsubscribe_title: "Unsubscribe",
  unsubscribe_intro:
    "Enter your email address below to unsubscribe from the newsletter.",
  unsubscribe_email_placeholder: "Your email address",
  unsubscribe_submit: "Unsubscribe",
  unsubscribe_success: "You have been unsubscribed successfully.",
  articles_title: "Articles",
  articles_intro: "Articles, guides and news.",
  articles_all_filter: "All",
  articles_no_results: "No articles found for this tag.",
  articles_no_articles: "No articles published yet. Check back soon.",
  article_home: "Home",
  article_read_more: "Read more",
  reading_time_suffix: "min read",
};

export default async function () {
  let stored = {};
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/config/ui-strings`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") stored = data;
    }
  } catch {
    console.warn("[folio] Could not fetch ui-strings — using defaults.");
  }

  // Merge each lang on top of EN_DEFAULTS, and ensure "en" always has all defaults
  const enStored = stored["en"] ?? {};
  const merged = { en: { ...EN_DEFAULTS, ...enStored } };

  // For other languages, fall back key-by-key to the merged English values
  for (const [lang, values] of Object.entries(stored)) {
    if (lang === "en") continue;
    merged[lang] = {};
    for (const key of Object.keys(EN_DEFAULTS)) {
      merged[lang][key] = values[key] || merged["en"][key];
    }
  }

  return merged;
}
