/**
 * Built-in block presets.
 * Each function returns a HomeBlock[] tree ready to be appended to the canvas.
 */
import type { HomeBlock } from "../../../api/types";
import { makeHomeBlock, withNormalizedOrder } from "./blockUtils";

// ── Navigation preset ─────────────────────────────────────────────────────────

/** Full site-header layout: brand name + nav links + CTA button */
export function buildNavPreset(lang: string): HomeBlock[] {
  const outer = makeHomeBlock("container", 0) as HomeBlock;
  outer.config.direction = "row";
  outer.config.wrap = "nowrap";
  outer.config.justify = "between";
  outer.config.align = "center";
  outer.config.paddingTop = 4;
  outer.config.paddingBottom = 4;
  outer.config.paddingLeft = 6;
  outer.config.paddingRight = 6;
  outer.config.width = "w-full";
  outer.config.gapX = 4;
  outer.config.gapY = 0;

  const brand = makeHomeBlock("text", 0) as HomeBlock;
  brand.config.tag = "p";
  brand.config.fontWeight = "bold";
  brand.config.fontSize = 18;
  brand.translations = { [lang]: { content: "Site Name" } };

  const navLinks = makeHomeBlock("nav-links", 1) as HomeBlock;
  navLinks.config.layout = "horizontal";
  navLinks.config.show_dropdown = true;
  navLinks.config.show_mega = false;

  const cta = makeHomeBlock("button", 2) as HomeBlock;
  cta.config.label = "Contact";
  cta.config.href = "/contact";
  cta.config.variant = "filled";
  cta.config.size = "sm";

  outer.children = [brand, navLinks, cta];
  return withNormalizedOrder([outer]) as HomeBlock[];
}

// ── Footer preset ─────────────────────────────────────────────────────────────

/** Full 3-column footer: site info + footer links + social links */
export function buildFooterPreset(lang: string): HomeBlock[] {
  const outer = makeHomeBlock("container", 0) as HomeBlock;
  outer.config.direction = "row";
  outer.config.wrap = "wrap";
  outer.config.justify = "between";
  outer.config.align = "start";
  outer.config.paddingTop = 12;
  outer.config.paddingBottom = 12;
  outer.config.width = "w-page";
  outer.config.gapX = 6;
  outer.config.gapY = 6;

  // Col 1: column container → site name text block
  const col1 = makeHomeBlock("container", 0) as HomeBlock;
  col1.config.direction = "col";
  col1.config.paddingTop = 0;
  col1.config.paddingBottom = 0;
  col1.config.paddingLeft = 0;
  col1.config.paddingRight = 0;
  const siteInfo = makeHomeBlock("text", 0) as HomeBlock;
  siteInfo.config.tag = "p";
  siteInfo.config.fontWeight = "semibold";
  siteInfo.translations = { [lang]: { content: "Site Name" } };
  col1.children = [siteInfo];

  // Col 2: column container → footer-links block
  const col2 = makeHomeBlock("container", 1) as HomeBlock;
  col2.config.direction = "col";
  col2.config.paddingTop = 0;
  col2.config.paddingBottom = 0;
  col2.config.paddingLeft = 0;
  col2.config.paddingRight = 0;
  const footerLinks = makeHomeBlock("subnav-links", 0) as HomeBlock;
  footerLinks.config.source = "footer";
  footerLinks.config.parent_key = "";
  footerLinks.config.layout = "vertical";
  col2.children = [footerLinks];

  // Col 3: column container → social-links block
  const col3 = makeHomeBlock("container", 2) as HomeBlock;
  col3.config.direction = "col";
  col3.config.paddingTop = 0;
  col3.config.paddingBottom = 0;
  col3.config.paddingLeft = 0;
  col3.config.paddingRight = 0;
  const socialLinks = makeHomeBlock("social-links", 0) as HomeBlock;
  socialLinks.config.show_icons = true;
  socialLinks.config.layout = "vertical";
  col3.children = [socialLinks];

  outer.children = [col1, col2, col3];
  return withNormalizedOrder([outer]) as HomeBlock[];
}
