import { useEffect } from "react";
import { Navigate, Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { adminApi } from "../api/client";

/** Fetches the saved theme from the DB and writes it to the #folio-theme
 * style tag so the whole admin reflects the user's chosen theme. */
function useThemeSync() {
  useEffect(() => {
    adminApi
      .getSettings()
      .then((settings) => {
        const theme = settings?.theme;
        if (!theme?.colors) return;
        let el = document.getElementById(
          "folio-theme",
        ) as HTMLStyleElement | null;
        if (!el) {
          el = document.createElement("style");
          el.id = "folio-theme";
          document.head.appendChild(el);
        }
        const vars = [
          ...Object.entries(theme.colors).map(
            ([k, v]) => `  --color-${k}: ${v};`,
          ),
          `  --font-body: ${theme.fonts?.body ?? "Inter"};`,
          `  --font-fallback: ${theme.fonts?.fallback ?? "system-ui, sans-serif"};`,
          `  --radius-button: ${theme.radius?.button ?? "8px"};`,
          `  --radius-card: ${theme.radius?.card ?? "12px"};`,
          `  --radius-input: ${theme.radius?.input ?? "6px"};`,
        ].join("\n");
        el.textContent = `:root {\n${vars}\n}`;
      })
      .catch(() => {
        /* ignore — fallback to CSS defaults */
      });
  }, []);
}

const links = [
  { label: "Dashboard", to: "/admin", section: false },
  { label: "Content", to: null, section: true },
  { label: "Articles", to: "/admin/articles", section: false },
  { label: "Pages", to: "/admin/pages", section: false },
  { label: "Media", to: "/admin/media", section: false },
  { label: "Data", to: null, section: true },
  { label: "Contacts", to: "/admin/contacts", section: false },
  { label: "Newsletter", to: "/admin/newsletter", section: false },
  { label: "Customization", to: null, section: true },
  { label: "Home Builder", to: "/admin/home-builder", section: false },
  { label: "Header Builder", to: "/admin/header-builder", section: false },
  { label: "Footer Builder", to: "/admin/footer-builder", section: false },
  { label: "Settings", to: "/admin/settings", section: false },
] as const;

export default function AdminLayout() {
  const { isAuthenticated, logout } = useAuth();
  useThemeSync();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-56 text-white flex flex-col shrink-0"
        style={{ background: "var(--color-nav-from)" }}
      >
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          <Link to="/admin" className="font-bold text-lg tracking-tight">
            Blog Admin
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {links.map((item, i) => {
            if (item.section) {
              return (
                <p
                  key={i}
                  className="px-2 pt-4 pb-1 text-xs font-semibold text-white/40 uppercase tracking-wider"
                >
                  {item.label}
                </p>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === "/admin"}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-white/20 text-white font-medium"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button
            onClick={logout}
            className="w-full px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white rounded text-left transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-(--color-bg)">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
