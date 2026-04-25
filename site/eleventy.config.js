import path from "node:path";
import fs from "node:fs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";

// System font stacks that don't need to be loaded from Google Fonts.
const SYSTEM_FONTS = new Set([
  "system-ui",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "helvetica",
  "arial",
  "sans-serif",
  "serif",
  "monospace",
  "inherit",
  "initial",
  "unset",
  "georgia",
  "times new roman",
  "times",
  "courier new",
  "courier",
  "verdana",
  "trebuchet ms",
  "impact",
  "comic sans ms",
]);

/**
 * Given a list of font family names from the theme, return a Google Fonts
 * stylesheet URL for those that aren't system fonts, or null if none needed.
 */
function buildGoogleFontsUrl(fontNames) {
  const toLoad = [...new Set(fontNames)]
    .map((f) => f.trim())
    .filter((f) => f && !SYSTEM_FONTS.has(f.toLowerCase()));

  if (toLoad.length === 0) return null;

  const families = toLoad
    .map(
      (f) =>
        `family=${encodeURIComponent(f)}:ital,wght@0,400;0,600;0,700;1,400`,
    )
    .join("&");
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

/** Fetch theme JSON from the backend settings API (falls back to theme.json on disk). */
async function loadTheme() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/config/theme`);
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") return data;
    }
  } catch {
    // backend not yet up during first build — fall through to file
  }
  try {
    const themePath = path.resolve(process.cwd(), "..", "theme.json");
    if (fs.existsSync(themePath))
      return JSON.parse(fs.readFileSync(themePath, "utf8"));
  } catch {
    // ignore
  }
  return {};
}

export default function (eleventyConfig) {
  // ── Passthrough copies ──────────────────────────────────────────────────────
  eleventyConfig.addPassthroughCopy("src/fonts");
  eleventyConfig.addPassthroughCopy("src/site-assets");

  // ── Nunjucks environment ────────────────────────────────────────────────────
  eleventyConfig.setNunjucksEnvironmentOptions({ throwOnUndefined: false });

  // ── Date filter ─────────────────────────────────────────────────────────────
  // Usage: {{ article.published_at | localizedDate(lang.code) }}
  eleventyConfig.addFilter("localizedDate", (dateStr, langCode) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString(langCode, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  });

  // ── Limit filter — return first N items of an array ─────────────────────────
  eleventyConfig.addFilter("limit", (arr, n) => {
    if (!Array.isArray(arr)) return arr;
    return arr.slice(0, n);
  });

  // ── Reading time filter ─────────────────────────────────────────────────────
  eleventyConfig.addFilter("readingTime", (body, langCodeOrSuffix, suffix) => {
    if (!body) return "";
    const words = body
      .replace(/<[^>]+>/g, "")
      .split(/\s+/)
      .filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    // If a custom suffix string is passed as the second arg, use it directly
    if (suffix !== undefined) return `${minutes} ${suffix}`;
    // Legacy lang-code branch
    const langCode = langCodeOrSuffix;
    if (langCode === "de") return `${minutes} Min. Lesezeit`;
    if (langCode === "fr") return `${minutes} min de lecture`;
    if (langCode === "es") return `${minutes} min de lectura`;
    return `${minutes} min read`;
  });

  eleventyConfig.addFilter("socialIcon", function(platform) {
    const p = (platform || "").toLowerCase();
    const icons = {
      github: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>`,
      twitter: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      x: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
      linkedin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
      instagram: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.98-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>`,
      facebook: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>`,
      youtube: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
      mastodon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 0 0 .023-.043v-1.809a.052.052 0 0 0-.02-.041.053.053 0 0 0-.046-.01 20.282 20.282 0 0 1-4.709.545c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 0 1-.319-1.433.053.053 0 0 1 .066-.054c1.517.363 3.072.546 4.632.546.376 0 .75 0 1.125-.01 1.57-.044 3.224-.124 4.768-.422.038-.008.077-.015.11-.024 2.435-.464 4.753-1.92 4.989-5.604.008-.145.03-1.52.03-1.67.002-.512.167-3.63-.024-5.545zm-3.748 9.195h-2.561V8.29c0-1.309-.55-1.976-1.67-1.976-1.23 0-1.846.79-1.846 2.35v3.403h-2.546V8.663c0-1.56-.617-2.35-1.848-2.35-1.112 0-1.668.668-1.67 1.977v6.218H4.822V8.102c0-1.31.337-2.35 1.011-3.12.696-.77 1.608-1.164 2.74-1.164 1.311 0 2.302.5 2.962 1.498l.638 1.06.638-1.06c.66-.999 1.65-1.498 2.96-1.498 1.13 0 2.043.395 2.74 1.164.675.77 1.012 1.81 1.012 3.12z"/></svg>`,
      bluesky: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.812 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.204-.659-.299-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8z"/></svg>`,
    };
    return icons[p] || `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="10"/></svg>`;
  });



  // ── Theme injection transform ────────────────────────────────────────────────
  // Fetches theme from backend API (falls back to theme.json on disk) and injects
  // CSS custom properties into every HTML page.
  let _cachedTheme = null;
  eleventyConfig.addTransform(
    "theme-inject",
    async function (content, outputPath) {
      if (!outputPath || !outputPath.endsWith(".html")) return content;

      if (!_cachedTheme) _cachedTheme = await loadTheme();
      const theme = _cachedTheme;

      // Flatten nested objects into prefixed CSS custom properties.
      const prefixMap = { colors: "color", fonts: "font", radius: "radius" };
      const lines = [];
      for (const [k, v] of Object.entries(theme)) {
        if (k.startsWith("_") || k === "preset") continue;
        if (v !== null && typeof v === "object") {
          const prefix = prefixMap[k] ?? k;
          for (const [sub, val] of Object.entries(v)) {
            lines.push(`  --${prefix}-${sub}: ${val};`);
          }
        } else {
          lines.push(`  --${k}: ${v};`);
        }
      }
      const vars = lines.join("\n");
      if (!vars) return content;

      // Build Google Fonts link tags for non-system fonts that aren't self-hosted.
      const fontsNeedingGoogle = [
        theme.fonts?.body_url ? null : theme.fonts?.body,
        theme.fonts?.heading_url ? null : theme.fonts?.heading,
      ].filter((v) => typeof v === "string" && !v.includes(","));
      const googleFontsUrl = buildGoogleFontsUrl(fontsNeedingGoogle);
      const fontLinks = googleFontsUrl
        ? [
            `<link rel="preconnect" href="https://fonts.googleapis.com">`,
            `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
            `<link rel="stylesheet" href="${googleFontsUrl}">`,
          ].join("\n")
        : "";

      // Build @font-face rules for self-hosted uploaded fonts.
      const fontFaceRules = [];
      if (theme.fonts?.body_url) {
        fontFaceRules.push(
          `@font-face { font-family: '${theme.fonts.body}'; src: url('${theme.fonts.body_url}') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }`,
        );
      }
      if (
        theme.fonts?.heading_url &&
        theme.fonts.heading_url !== theme.fonts.body_url
      ) {
        fontFaceRules.push(
          `@font-face { font-family: '${theme.fonts.heading}'; src: url('${theme.fonts.heading_url}') format('woff2'); font-weight: 100 900; font-style: normal; font-display: swap; }`,
        );
      }
      const fontFaceTag =
        fontFaceRules.length > 0
          ? `<style id="folio-fonts-face">${fontFaceRules.join(" ")}</style>`
          : "";

      const tag = `<style id="folio-theme">:root {\n${vars}\n}</style>`;
      const parts = [fontLinks, fontFaceTag, tag].filter(Boolean);
      return content.replace("</head>", `${parts.join("\n")}\n</head>`);
    },
  );

  // ── User theme overrides ────────────────────────────────────────────────────
  // Files in src/user-theme/ shadow src/_includes/partials/.
  // This ensures user overrides are picked up by Nunjucks automatically
  // because we add user-theme/ as an additional includes dir.
  eleventyConfig.addNunjucksGlobal("userThemeDir", "user-theme");

  // ── Dev server: proxy /uploads/* to the Go backend ───────────────────────────
  // In production Caddy serves uploads directly from the volume mount.
  // In dev the 11ty server needs to forward the requests to http://localhost:8080.
  eleventyConfig.setServerOptions({
    middleware: [
      function proxyBackend(req, res, next) {
        if (!req.url.startsWith("/uploads/") && !req.url.startsWith("/api/"))
          return next();
        import("node:http")
          .then(({ default: http }) => {
            const backendBase =
              process.env.BACKEND_URL ?? "http://localhost:8080";
            const target = new URL(req.url, backendBase);
            const proxyReq = http.request(
              {
                host: target.hostname,
                port: target.port || 80,
                path: target.pathname,
                method: req.method,
                headers: req.headers,
              },
              (proxyRes) => {
                res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
                proxyRes.pipe(res, { end: true });
              },
            );
            proxyReq.on("error", () => next());
            req.pipe(proxyReq, { end: true });
          })
          .catch(() => next());
      },
    ],
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
