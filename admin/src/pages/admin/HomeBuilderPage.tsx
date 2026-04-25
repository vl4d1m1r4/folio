import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { adminApi } from "../../api/client";
import type { HomeBlock, Language } from "../../api/types";
import { WysiwygShell } from "../../components/admin/wysiwyg/WysiwygShell";

export default function HomeBuilderPage() {
  const [blocks, setBlocks] = useState<HomeBlock[]>([]);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState("en");
  const [themeVars, setThemeVars] = useState<Record<string, string>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: adminApi.getSettings,
  });

  const { data: languages = [] } = useQuery<Language[]>({
    queryKey: ["languages"],
    queryFn: adminApi.getLanguages,
  });

  useEffect(() => {
    if (settings?.home_sections) setBlocks(settings.home_sections);
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

  const saveMutation = useMutation({
    mutationFn: (home_sections: HomeBlock[]) =>
      adminApi.saveSettings({ home_sections } as any),
    onSuccess: () => {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      adminApi.triggerRebuild().catch(() => {});
    },
    onError: (e: Error) => setServerError(e.message),
  });

  function handleCopyBlocksFrom(fromLang: string) {
    // In home mode blocks are shared; copy each block's translation from
    // fromLang into activeLang.
    setBlocks((prev) =>
      prev.map((block) => ({
        ...block,
        translations: {
          ...block.translations,
          [activeLang]: JSON.parse(
            JSON.stringify(
              block.translations?.[fromLang] ??
                block.translations?.[activeLang] ??
                {},
            ),
          ),
        },
      })),
    );
  }

  if (isLoading)
    return <div className="p-6 text-(--color-muted)">Loading…</div>;

  return (
    <WysiwygShell
      mode="home"
      title="Home Page Builder"
      themeVars={themeVars}
      languages={languages}
      activeLang={activeLang}
      onActiveLangChange={setActiveLang}
      blocks={blocks}
      onBlocksChange={(updated) => setBlocks(updated as HomeBlock[])}
      onSave={() => saveMutation.mutate(blocks)}
      saving={saveMutation.isPending}
      saved={saved}
      serverError={serverError}
      onCopyBlocksFrom={languages.length > 1 ? handleCopyBlocksFrom : undefined}
    />
  );
}
