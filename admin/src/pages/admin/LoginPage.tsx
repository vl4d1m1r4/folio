import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg)">
      <div className="bg-(--color-bg-surface) rounded-lg shadow p-8 w-full max-w-sm border border-(--color-border)">
        <h1 className="text-2xl font-bold mb-6 text-center">Blog Admin</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-(--color-muted) mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="border border-(--color-border) rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-(--color-accent) bg-(--color-bg) text-(--color-text)"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-(--color-muted) mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-(--color-border) rounded px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-(--color-accent) bg-(--color-bg) text-(--color-text)"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-accent px-4 py-2 rounded disabled:opacity-50 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
