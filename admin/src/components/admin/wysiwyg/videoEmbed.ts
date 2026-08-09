const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,}$/;
const VIMEO_ID = /^\d+$/;
const VIMEO_HASH = /^[A-Za-z0-9]+$/;

function parseUrl(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return new URL(
      /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
        ? trimmed
        : `https://${trimmed}`,
    );
  } catch {
    return null;
  }
}

export function videoEmbedUrl(
  value: string,
  autoplay = false,
  controls = true,
): string | null {
  const url = parseUrl(value);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:"))
    return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let provider: "youtube" | "vimeo";
  let id = "";
  let vimeoHash = "";

  if (host === "youtu.be") {
    provider = "youtube";
    id = url.pathname.split("/").filter(Boolean)[0] ?? "";
  } else if (
    host === "youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com"
  ) {
    provider = "youtube";
    const parts = url.pathname.split("/").filter(Boolean);
    id =
      url.pathname === "/watch"
        ? (url.searchParams.get("v") ?? "")
        : (["embed", "shorts", "live"].includes(parts[0])
            ? parts[1]
            : "") ?? "";
  } else if (host === "vimeo.com" || host === "player.vimeo.com") {
    provider = "vimeo";
    const parts = url.pathname.split("/").filter(Boolean);
    id = parts[0] === "video" ? (parts[1] ?? "") : (parts[0] ?? "");
    const pathHash = parts[0] === "video" ? "" : (parts[1] ?? "");
    const queryHash = url.searchParams.get("h") ?? "";
    vimeoHash = VIMEO_HASH.test(queryHash)
      ? queryHash
      : VIMEO_HASH.test(pathHash)
        ? pathHash
        : "";
  } else {
    return null;
  }

  if (provider === "youtube" && YOUTUBE_ID.test(id)) {
    const params = new URLSearchParams();
    if (autoplay) {
      params.set("autoplay", "1");
      params.set("mute", "1");
    }
    if (!controls) params.set("controls", "0");
    const query = params.size ? `?${params}` : "";
    return `https://www.youtube-nocookie.com/embed/${id}${query}`;
  }

  if (provider === "vimeo" && VIMEO_ID.test(id)) {
    const params = new URLSearchParams();
    if (vimeoHash) params.set("h", vimeoHash);
    if (autoplay) {
      params.set("autoplay", "1");
      params.set("muted", "1");
    }
    if (!controls) params.set("controls", "0");
    const query = params.size ? `?${params}` : "";
    return `https://player.vimeo.com/video/${id}${query}`;
  }

  return null;
}
