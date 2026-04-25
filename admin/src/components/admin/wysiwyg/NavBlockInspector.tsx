/**
 * Inspector fields for the five navigation-aware block types.
 * Receives nav/footer/social snapshots so dropdowns show real link labels.
 */
import type { NavLink, SocialLink } from "../../../api/types";
import { ColorRow } from "./InspectorShared";

interface NavBlockInspectorProps {
  type:
    | "nav-links"
    | "subnav-links"
    | "single-nav-item"
    | "social-links"
    | "single-social-link";
  config: Record<string, unknown>;
  onConfigChange: (key: string, value: unknown) => void;
  themeColors?: Record<string, string>;
  navSnapshot?: NavLink[];
  footerSnapshot?: NavLink[];
  socialSnapshot?: SocialLink[];
}

export function NavBlockInspector({
  type,
  config: c,
  onConfigChange,
  themeColors,
  navSnapshot = [],
  footerSnapshot = [],
  socialSnapshot = [],
}: NavBlockInspectorProps) {
  const sel =
    "w-full px-2 py-1.5 border border-(--color-border) rounded text-sm bg-(--color-bg)";

  switch (type) {
    case "nav-links":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Dropdown Style
            </label>
            <select
              value={(c.dropdown_style as string) ?? "simple"}
              onChange={(e) => onConfigChange("dropdown_style", e.target.value)}
              className={sel}
            >
              <option value="simple">Simple dropdown</option>
              <option value="mega">Mega menu (wide panel)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.show_language_switcher ?? true)}
              onChange={(e) =>
                onConfigChange("show_language_switcher", e.target.checked)
              }
              className="w-4 h-4 accent-(--color-accent)"
            />
            Show language switcher
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.sticky ?? true)}
              onChange={(e) => onConfigChange("sticky", e.target.checked)}
              className="w-4 h-4 accent-(--color-accent)"
            />
            Sticky (fixed to top)
          </label>
          <ColorRow
            label="Link Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
          <ColorRow
            label="Background Color"
            value={c.bg_color as string | null}
            placeholder="var(--color-bg-surface)"
            onChange={(v) => onConfigChange("bg_color", v)}
            themeColors={themeColors}
          />
        </div>
      );

    case "subnav-links": {
      const source = (c.source as string) ?? "nav";
      const links = source === "footer" ? footerSnapshot : navSnapshot;
      const parents = links.filter((l) => l.children && l.children.length > 0);

      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Link Source
            </label>
            <select
              value={source}
              onChange={(e) => {
                onConfigChange("source", e.target.value);
                onConfigChange("parent_key", "");
              }}
              className={sel}
            >
              <option value="nav">Navigation (nav_links)</option>
              <option value="footer">Footer (footer_links)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Parent Link (renders its children)
            </label>
            <select
              value={(c.parent_key as string) ?? ""}
              onChange={(e) => onConfigChange("parent_key", e.target.value)}
              className={sel}
            >
              <option value="">— Select a parent link —</option>
              {parents.map((l) => (
                <option key={l.label} value={l.label}>
                  {l.label}
                </option>
              ))}
            </select>
            {parents.length === 0 && (
              <p className="text-xs text-(--color-muted) mt-1">
                No links with children found in the selected source. Add
                dropdown children in Settings → Navigation.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Layout</label>
            <select
              value={(c.layout as string) ?? "vertical"}
              onChange={(e) => onConfigChange("layout", e.target.value)}
              className={sel}
            >
              <option value="vertical">Vertical list</option>
              <option value="horizontal">Horizontal row</option>
              <option value="grid">Grid (2 columns)</option>
            </select>
          </div>
          <ColorRow
            label="Link Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
        </div>
      );
    }

    case "single-nav-item": {
      const source = (c.source as string) ?? "nav";
      const links = source === "footer" ? footerSnapshot : navSnapshot;
      const flatLinks = links.flatMap((l) => [
        l,
        ...(l.children?.filter((ch) => ch.type !== "divider") ?? []),
      ]);

      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">
              Link Source
            </label>
            <select
              value={source}
              onChange={(e) => {
                onConfigChange("source", e.target.value);
                onConfigChange("link_key", "");
              }}
              className={sel}
            >
              <option value="nav">Navigation (nav_links)</option>
              <option value="footer">Footer (footer_links)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Link</label>
            <select
              value={(c.link_key as string) ?? ""}
              onChange={(e) => onConfigChange("link_key", e.target.value)}
              className={sel}
            >
              <option value="">— Select a link —</option>
              {flatLinks.map((l) => (
                <option key={l.label} value={l.label}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Render as</label>
            <select
              value={(c.render_as as string) ?? "link"}
              onChange={(e) => onConfigChange("render_as", e.target.value)}
              className={sel}
            >
              <option value="link">Plain link</option>
              <option value="button">Styled button</option>
            </select>
          </div>
          <ColorRow
            label="Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
        </div>
      );
    }

    case "social-links":
      return (
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.show_icons ?? true)}
              onChange={(e) => onConfigChange("show_icons", e.target.checked)}
              className="w-4 h-4 accent-(--color-accent)"
            />
            Show platform icons
          </label>
          <div>
            <label className="block text-xs font-medium mb-1">Icon Style</label>
            <select
              value={(c.icon_style as string) ?? "outline"}
              onChange={(e) => onConfigChange("icon_style", e.target.value)}
              className={sel}
            >
              <option value="outline">Outline</option>
              <option value="filled">Filled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Layout</label>
            <select
              value={(c.layout as string) ?? "horizontal"}
              onChange={(e) => onConfigChange("layout", e.target.value)}
              className={sel}
            >
              <option value="horizontal">Horizontal row</option>
              <option value="vertical">Vertical list</option>
            </select>
          </div>
          <ColorRow
            label="Link Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
          {socialSnapshot.length === 0 && (
            <p className="text-xs text-(--color-muted)">
              No social links configured. Add them in Settings → Footer & Social.
            </p>
          )}
        </div>
      );

    case "single-social-link":
      return (
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Platform</label>
            <select
              value={(c.platform as string) ?? ""}
              onChange={(e) => onConfigChange("platform", e.target.value)}
              className={sel}
            >
              <option value="">— Select a platform —</option>
              {socialSnapshot.map((s) => (
                <option key={s.platform} value={s.platform}>
                  {s.platform}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <input
              type="checkbox"
              checked={!!(c.show_icon ?? true)}
              onChange={(e) => onConfigChange("show_icon", e.target.checked)}
              className="w-4 h-4 accent-(--color-accent)"
            />
            Show icon
          </label>
          <ColorRow
            label="Color"
            value={c.link_color as string | null}
            placeholder="inherit"
            onChange={(v) => onConfigChange("link_color", v)}
            themeColors={themeColors}
          />
        </div>
      );

    default:
      return null;
  }
}
