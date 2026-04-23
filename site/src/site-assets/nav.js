// Mobile nav toggle + language switcher toggle

document.addEventListener("DOMContentLoaded", () => {
  // ── Active nav link ──────────────────────────────────────────────────────
  const path = window.location.pathname;
  const accentColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-accent").trim();
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-text").trim();

  document.querySelectorAll("[data-nav-href]").forEach((link) => {
    const href = link.getAttribute("data-nav-href");
    const normalizedPath = path.replace(/\/index\.html$/, "/");
    // Count path segments to distinguish Home (/{lang}/) from sections (/{lang}/articles/)
    const hrefSegments = href.replace(/^\/|\/$/g, "").split("/").filter(Boolean).length;
    const isHome = hrefSegments <= 1; // e.g. /en/ has 1 segment
    const isActive = isHome
      ? normalizedPath === href || normalizedPath === href.slice(0, -1)
      : normalizedPath.startsWith(href);

    if (isActive) {
      link.dataset.active = "1";
      link.style.color = accentColor || "var(--color-accent)";
      link.style.fontWeight = "600";
    }
  });
  // ── Mobile hamburger ─────────────────────────────────────────────────────
  const toggle = document.querySelector("[data-nav-toggle]");
  const mobileMenu = document.querySelector("[data-mobile-menu]");
  if (toggle && mobileMenu) {
    toggle.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }

  // ── Desktop language switcher ────────────────────────────────────────────
  const langToggle = document.querySelector("[data-lang-toggle]");
  const langMenu = document.querySelector("[data-lang-menu]");
  if (langToggle && langMenu) {
    langToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      langMenu.classList.toggle("hidden");
    });
    document.addEventListener("click", () => langMenu.classList.add("hidden"));
  }
});
