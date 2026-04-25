import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { HomeBlock, Language, NavLink, SocialLink } from "../../api/types";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";
import type { NavSnapshot } from "../../components/admin/wysiwyg/iframeRenderer";
import {
  makeHomeBlock,
  withNormalizedOrder,
} from "../../components/admin/wysiwyg/blockUtils";

function buildDefaultFooterTemplate(lang: string): HomeBlock[] {
  // Outer container: horizontal 3-column layout
  const outer = makeHomeBlock("container", 0) as HomeBlock;
  outer.config.direction = "row";
  outer.config.wrap = "wrap";
  outer.config.justify = "between";
  outer.config.align = "start";
  outer.config.paddingTop = 12;
  outer.config.paddingBottom = 12;
  outer.config.width = "w-page";

  // Col 1: site name text block
  const siteInfo = makeHomeBlock("text", 0) as HomeBlock;
  siteInfo.config.tag = "p";
  siteInfo.config.fontWeight = "semibold";
  siteInfo.translations = { [lang]: { content: "Site Name" } };

  // Col 2: footer-links block
  const footerLinks = makeHomeBlock("subnav-links", 1) as HomeBlock;
  footerLinks.config.source = "footer";
  footerLinks.config.parent_key = "";
  footerLinks.config.layout = "vertical";

  // Col 3: social-links block
  const socialLinks = makeHomeBlock("social-links", 2) as HomeBlock;
  socialLinks.config.show_icons = true;
  socialLinks.config.layout = "vertical";

  outer.children = [siteInfo, footerLinks, socialLinks];

  return withNormalizedOrder([outer]) as HomeBlock[];
}

export default function FooterBuilderPage() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en");
  const [themeVars, setThemeVars] = useState<Record<string, string>>({});
  const [navSnapshot, setNavSnapshot] = useState<NavSnapshot>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  useEffect(() => {
    if (settings?.footer_sections) setBlocks(settings.footer_sections);
  }, [settings]);

  useEffect(() => {
    if (languages.length > 0)
      setActiveLang(
        languages.find((l) => l.default)?.code ?? languages[0].code,
      );
  }, [languages]);

  useEffect(() => {
    const theme = settings?.theme;
    if (!theme?.colors) return;
    const vars: Record<string, string> = {};
    for (const [k, v] of Object.entries(theme.colors)) {
      vars[`--color-${k}`] = v;
    }
    if (theme.fonts?.body) vars["--font-body"] = theme.fonts.body;
    if (theme.fonts?.fallback) vars["--font-fallback"] = theme.fonts.fallback;
    setThemeVars(vars);
  }, [settings]);

  useEffect(() => {
    if (!settings) return;
    setNavSnapshot({
      navLinks: (settings.nav_links ?? []) as NavLink[],
      footerLinks: (settings.footer_links ?? []) as NavLink[],
      socialLinks: (settings.social_links ?? []) as SocialLink[],
    });
  }, [settings]);

  const themeColors = themeVars;

  const saveMutation = useMutation({
    mutationFn: (footer_sections: HomeBlock[]) =>
      adminApi.saveSettings({ footer_sections } as any),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  function loadDefaultTemplate() {
    setBlocks(buildDefaultFooterTemplate(activeLang));
  }

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <WysiwygShell
      mode="home"
      title="Footer Builder"
      subtitle={
        blocks.length === 0
          ? "Canvas is empty — load the default template to start"
          : "Compose the site footer with blocks"
      }
      themeVars={themeVars}
      themeColors={themeColors}
      languages={languages}
      activeLang={activeLang}
      onActiveLangChange={setActiveLang}
      blocks={blocks}
      onBlocksChange={(updated) => setBlocks(updated as HomeBlock[])}
      onSave={() => saveMutation.mutate(blocks)}
      saving={saveMutation.isPending}
      saved={saved}
      serverError={serverError}
      navSnapshot={navSnapshot}
      onLoadDefaultTemplate={blocks.length === 0 ? loadDefaultTemplate : undefined}
    />
  );
}
