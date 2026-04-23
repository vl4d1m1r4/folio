import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { getToken, setToken, clearToken, adminApi } from "../api/client";

interface AuthContextValue {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  isAuthenticated: false,
  login: async () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(!!getToken());

  async function login(username: string, password: string) {
    const { token } = await adminApi.login(username, password);
    setToken(token);
    setIsAuthenticated(true);
  }

  function logout() {
    clearToken();
    setIsAuthenticated(false);
  }

  useEffect(() => {
    function handleUnauthorized() {
      clearToken();
      setIsAuthenticated(false);
    }
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
