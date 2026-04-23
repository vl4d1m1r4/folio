import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";

/** Reads theme.json from the repo root and returns a <style> tag with
 * flattened CSS custom properties — mirrors the Eleventy transform. */
function themeInjectPlugin() {
  function buildStyleTag(): string {
    const themePath = path.resolve(__dirname, "..", "theme.json");
    let theme: Record<string, unknown> = {};
    try {
      if (fs.existsSync(themePath))
        theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
    } catch {
      // ignore — fall back to CSS defaults
    }

    const prefixMap: Record<string, string> = {
      colors: "color",
      fonts: "font",
      radius: "radius",
    };
    const lines: string[] = [];
    for (const [k, v] of Object.entries(theme)) {
      if (k.startsWith("_") || k === "preset") continue;
      if (v !== null && typeof v === "object") {
        const prefix = prefixMap[k] ?? k;
        for (const [sub, val] of Object.entries(v as Record<string, string>)) {
          lines.push(`  --${prefix}-${sub}: ${val};`);
        }
      } else {
        lines.push(`  --${k}: ${v};`);
      }
    }
    if (!lines.length) return "";
    return `<style id="openblog-theme">:root {\n${lines.join("\n")}\n}</style>`;
  }

  return {
    name: "openblog-theme-inject",
    transformIndexHtml(html: string) {
      const tag = buildStyleTag();
      if (!tag) return html;
      return html.replace("</head>", `${tag}\n</head>`);
    },
  };
}

export default defineConfig({
  // base must match the path the admin is served from in production (/admin/)
  // so all asset references (JS, CSS) are prefixed correctly.
  base: "/admin/",
  plugins: [react(), tailwindcss(), themeInjectPlugin()],
  server: {
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
      "/uploads": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
});
