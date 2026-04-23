/**
 * Fetches social links from the backend settings API.
 * Each entry: { platform, url }
 */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

export default async function () {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/config/social`);
    if (res.ok) {
      const links = await res.json();
      return Array.isArray(links) ? links : [];
    }
  } catch {
    console.warn("[openblog] Could not fetch social links — using fallback.");
  }
  return [];
}
