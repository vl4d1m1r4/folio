import { useEffect, useState } from "react";
import { Navigate, Outlet, Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { adminApi } from "../api/client";
import { applyThemeToDocument } from "../utils/theme";

/** Fetches the saved theme from the DB and applies it to the document on mount. */
function useThemeSync() {
  useEffect(() => {
    adminApi
      .getSettings()
      .then((settings) => {
        const theme = settings?.theme;
        if (!theme?.colors) return;
        applyThemeToDocument(theme);
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
  { label: "Home Layout", to: "/admin/home-builder", section: false },
  { label: "Header Layout", to: "/admin/header-builder", section: false },
  { label: "Footer Layout", to: "/admin/footer-builder", section: false },
  { label: "Article Layout", to: "/admin/article-builder", section: false },
  { label: "Settings", to: "/admin/settings", section: false },
] as const;

/** Grouped navigation (Content / Data / Customization) shared by the desktop
 *  sidebar and the mobile drawer. */
function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
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
            onClick={onNavigate}
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
  );
}

function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="p-4 border-t border-white/10">
      <button
        onClick={onLogout}
        className="w-full px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white rounded text-left transition-colors"
      >
        Logout
      </button>
    </div>
  );
}

/** Label of the nav entry matching the current route, shown in the mobile top bar. */
function currentPageLabel(pathname: string): string {
  let best: string = "Dashboard";
  let bestLen = 0;
  for (const item of links) {
    if (!item.to) continue;
    const match =
      item.to === "/admin"
        ? pathname === "/admin" || pathname === "/admin/"
        : pathname === item.to || pathname.startsWith(item.to + "/");
    if (match && item.to.length > bestLen) {
      best = item.label;
      bestLen = item.to.length;
    }
  }
  return best;
}

export default function AdminLayout() {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  useThemeSync();

  // Close the mobile menu on route change (covers browser back/forward too)
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // While the mobile menu is open: Escape closes it and the page behind doesn't scroll
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  if (!isAuthenticated) {
    const redirect = location.pathname + location.search;
    return (
      <Navigate
        to={`/admin/login?redirect=${encodeURIComponent(redirect)}`}
        replace
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* ── Mobile top bar (below md) ── */}
      <header
        className="md:hidden sticky top-0 z-40 h-14 shrink-0 flex items-center gap-3 px-3 text-white"
        style={{ background: "var(--color-nav-from)" }}
      >
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="p-2 -ml-1 rounded hover:bg-white/10 transition-colors"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="admin-mobile-menu"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <Link to="/admin" className="font-bold tracking-tight">
          Blog Admin
        </Link>
        <span className="ml-auto text-sm text-white/70 truncate">
          {currentPageLabel(location.pathname)}
        </span>
      </header>

      {/* ── Mobile drawer ── */}
      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="admin-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="relative w-64 max-w-[80vw] h-full text-white flex flex-col shadow-xl"
            style={{ background: "var(--color-nav-from)" }}
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
              <span className="font-bold text-lg tracking-tight">
                Blog Admin
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="p-2 -mr-2 rounded hover:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <SidebarNav onNavigate={() => setMenuOpen(false)} />
            <LogoutButton onLogout={logout} />
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar (md and up) ── */}
      <aside
        className="hidden md:flex w-56 text-white flex-col shrink-0"
        style={{ background: "var(--color-nav-from)" }}
      >
        <div className="h-16 flex items-center px-4 border-b border-white/10">
          <Link to="/admin" className="font-bold text-lg tracking-tight">
            Blog Admin
          </Link>
        </div>

        <SidebarNav />
        <LogoutButton onLogout={logout} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-(--color-bg)">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
