export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-200">404</h1>
        <p className="mt-4 text-gray-500">Page not found.</p>
        <a
          href="/admin"
          className="mt-6 inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded"
        >
          Back to admin
        </a>
      </div>
    </div>
  );
}
