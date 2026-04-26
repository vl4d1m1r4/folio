import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { HomeBlock, Language, NavLink, SocialLink } from "../../api/types";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";
import type { NavSnapshot } from "../../components/admin/wysiwyg/iframeRenderer";
import { buildNavPreset } from "../../components/admin/wysiwyg/presets";

export default function HeaderBuilderPage() {
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
    if (settings?.header_sections) setBlocks(settings.header_sections);
  }, [settings]);

  useEffect(() => {
    if (languages.length > 0)
      setActiveLang(
        languages.find((l) => l.default)?.code ?? languages[0].code,
      );
  }, [languages]);

  // Build theme CSS vars for the iframe canvas
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

  // Build nav snapshot from settings
  useEffect(() => {
    if (!settings) return;
    setNavSnapshot({
      navLinks: (settings.nav_links ?? []) as NavLink[],
      footerLinks: (settings.footer_links ?? []) as NavLink[],
      socialLinks: (settings.social_links ?? []) as SocialLink[],
    });
  }, [settings]);

  // Derive themeColors (resolved values) from themeVars for ColorRow swatches
  const themeColors = themeVars;

  const saveMutation = useMutation({
    mutationFn: (header_sections: HomeBlock[]) =>
      adminApi.saveSettings({ header_sections } as any),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <WysiwygShell
      mode="home"
      title="Header Builder"
      subtitle="Compose the site header with blocks"
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
      onLoadDefaultTemplate={() => setBlocks(buildNavPreset(activeLang))}
    />
  );
}
