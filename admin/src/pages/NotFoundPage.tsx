export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[--color-bg]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[--color-border]">404</h1>
        <p className="mt-4 text-[--color-muted]">Page not found.</p>
        <a
          href="/admin"
          className="mt-6 inline-block px-4 py-2 bg-[--color-accent] text-white text-sm rounded hover:bg-[--color-accent-hover]"
        >
          Back to admin
        </a>
      </div>
    </div>
  );
}
