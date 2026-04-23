/**
 * Fetches site metadata (name, tagline, social links, etc.) from the backend.
 * Falls back to sensible defaults if the backend is unavailable.
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/config/site`);
    if (res.ok) return await res.json();
  } catch {
    console.warn(
      "[folio] Could not reach backend for site config — using fallback.",
    );
  }

  return {
    name: "My Blog",
    tagline: "",
    url: "",
    bookingUrl: "",
    social: {},
  };
}
