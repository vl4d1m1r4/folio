import { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useRouteError,
  isRouteErrorResponse,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import AdminLayout from "./layouts/AdminLayout";
import NotFoundPage from "./pages/NotFoundPage";

const LoginPage = lazy(() => import("./pages/admin/LoginPage"));
const Dashboard = lazy(() => import("./pages/admin/DashboardPage"));
const ArticlesPage = lazy(() => import("./pages/admin/ArticlesPage"));
const ArticleEdit = lazy(() => import("./pages/admin/ArticleEditPage"));
const MediaPage = lazy(() => import("./pages/admin/MediaPage"));
const ContactsPage = lazy(() => import("./pages/admin/ContactsPage"));
const NewsletterPage = lazy(() => import("./pages/admin/NewsletterPage"));
const PagesPage = lazy(() => import("./pages/admin/PagesPage"));
const PageEditPage = lazy(() => import("./pages/admin/PageEditPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const HomeBuilderPage = lazy(() => import("./pages/admin/HomeBuilderPage"));
const HeaderBuilderPage = lazy(() => import("./pages/admin/HeaderBuilderPage"));
const FooterBuilderPage = lazy(() => import("./pages/admin/FooterBuilderPage"));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-(--color-muted)">
      Loading…
    </div>
  );
}

function RouteError() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404)
    return <NotFoundPage />;
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred.";
  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg)">
      <div className="max-w-md w-full mx-4 p-8 bg-(--color-bg-surface) rounded-lg shadow text-center space-y-4 border border-(--color-border)">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-(--color-muted) font-mono break-all">
          {message}
        </p>
        <button
          onClick={() => window.location.assign("/")}
          className="px-4 py-2 bg-(--color-accent) text-white text-sm rounded hover:bg-(--color-accent-hover)"
        >
          Go home
        </button>
      </div>
    </div>
  );
}

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/admin" replace />,
    errorElement: <RouteError />,
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<Loading />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: "articles",
        element: (
          <Suspense fallback={<Loading />}>
            <ArticlesPage />
          </Suspense>
        ),
      },
      {
        path: "articles/:id",
        element: (
          <Suspense fallback={<Loading />}>
            <ArticleEdit />
          </Suspense>
        ),
      },
      {
        path: "media",
        element: (
          <Suspense fallback={<Loading />}>
            <MediaPage />
          </Suspense>
        ),
      },
      {
        path: "contacts",
        element: (
          <Suspense fallback={<Loading />}>
            <ContactsPage />
          </Suspense>
        ),
      },
      {
        path: "newsletter",
        element: (
          <Suspense fallback={<Loading />}>
            <NewsletterPage />
          </Suspense>
        ),
      },
      {
        path: "pages",
        element: (
          <Suspense fallback={<Loading />}>
            <PagesPage />
          </Suspense>
        ),
      },
      {
        path: "pages/:id",
        element: (
          <Suspense fallback={<Loading />}>
            <PageEditPage />
          </Suspense>
        ),
      },
      {
        path: "settings",
        element: (
          <Suspense fallback={<Loading />}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: "home-builder",
        element: (
          <Suspense fallback={<Loading />}>
            <HomeBuilderPage />
          </Suspense>
        ),
      },
      {
        path: "header-builder",
        element: (
          <Suspense fallback={<Loading />}>
            <HeaderBuilderPage />
          </Suspense>
        ),
      },
      {
        path: "footer-builder",
        element: (
          <Suspense fallback={<Loading />}>
            <FooterBuilderPage />
          </Suspense>
        ),
      },
    ],
  },
  {
    path: "/admin/login",
    element: (
      <Suspense fallback={<Loading />}>
        <LoginPage />
      </Suspense>
    ),
    errorElement: <RouteError />,
  },
  { path: "*", element: <NotFoundPage /> },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
