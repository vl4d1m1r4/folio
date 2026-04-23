import path from "node:path";
import fs from "node:fs";

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
  eleventyConfig.addFilter("readingTime", (body, langCode) => {
    if (!body) return "";
    const words = body
      .replace(/<[^>]+>/g, "")
      .split(/\s+/)
      .filter(Boolean).length;
    const minutes = Math.max(1, Math.round(words / 200));
    if (langCode === "de") return `${minutes} Min. Lesezeit`;
    if (langCode === "fr") return `${minutes} min de lecture`;
    if (langCode === "es") return `${minutes} min de lectura`;
    return `${minutes} min read`;
  });

  // ── Theme injection transform ────────────────────────────────────────────────
  // Reads theme.json from repo root and injects CSS custom properties into
  // every HTML page inside a <style id="openblog-theme"> tag in the <head>.
  eleventyConfig.addTransform("theme-inject", function (content, outputPath) {
    if (!outputPath || !outputPath.endsWith(".html")) return content;

    let theme = {};
    try {
      const themePath = path.resolve(process.cwd(), "..", "theme.json");
      if (fs.existsSync(themePath))
        theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
    } catch {
      // theme.json missing or invalid — use defaults
    }

    // Flatten nested objects into prefixed CSS custom properties.
    // { colors: { accent: "#fff" } } → --color-accent: #fff
    // { fonts: { body: "Inter" } }   → --font-body: Inter
    // { radius: { button: "8px" } }  → --radius-button: 8px
    // Top-level scalar keys are passed through as-is (skipping _ comments).
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

    const tag = `<style id="openblog-theme">:root {\n${vars}\n}</style>`;
    return content.replace("</head>", `${tag}\n</head>`);
  });

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
