/**
 * Fetches configured languages from the running backend.
 * Falls back to a single English language if the backend is unavailable.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  let languages = [{ code: "en", label: "English", dir: "ltr", default: true }];

  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/config/languages`);
    if (res.ok) languages = await res.json();
  } catch {
    console.warn(
      "[openblog] Could not reach backend for language config — using fallback: en",
    );
  }

  return { languages };
}
