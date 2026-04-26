import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { HomeBlock, Language, NavLink, SocialLink } from "../../api/types";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";
import type { NavSnapshot } from "../../components/admin/wysiwyg/iframeRenderer";
import { buildFooterPreset } from "../../components/admin/wysiwyg/presets";

function buildDefaultFooterTemplate(lang: string) {
  return buildFooterPreset(lang);
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
      onLoadDefaultTemplate={
        blocks.length === 0 ? loadDefaultTemplate : undefined
      }
    />
  );
}
