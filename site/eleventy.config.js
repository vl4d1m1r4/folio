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
