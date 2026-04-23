import { Navigate, Outlet, Link, NavLink } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const links = [
  { label: "Dashboard", to: "/admin", section: false },
  { label: "Content", to: null, section: true },
  { label: "Articles", to: "/admin/articles", section: false },
  { label: "Media", to: "/admin/media", section: false },
  { label: "Data", to: null, section: true },
  { label: "Contacts", to: "/admin/contacts", section: false },
  { label: "Newsletter", to: "/admin/newsletter", section: false },
] as const;

export default function AdminLayout() {
  const { isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-gray-900 text-white flex flex-col shrink-0">
        <div className="h-16 flex items-center px-4 border-b border-gray-700">
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
                  className="px-2 pt-4 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider"
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
                      ? "bg-gray-700 text-white font-medium"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="w-full px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white rounded text-left transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
