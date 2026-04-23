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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 60_000 } },
});

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4 p-8 bg-white rounded-lg shadow text-center space-y-4">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-gray-500 font-mono break-all">{message}</p>
        <button
          onClick={() => window.location.assign("/")}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded"
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
