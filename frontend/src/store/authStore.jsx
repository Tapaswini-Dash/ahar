
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchCurrentUser, login as loginApi, loginWithGoogle as loginWithGoogleApi, register as registerApi } from "../api/authApi";

const AuthContext = createContext(null);
const STORAGE_KEY = "ahar_access_token";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState("");

  // On first load, if a token was saved from a previous session, verify it
  // and load the user — otherwise treat it as logged out.
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    fetchCurrentUser(token)
      .then(setUser)
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleAuthSuccess = useCallback(async (tokens) => {
    localStorage.setItem(STORAGE_KEY, tokens.access_token);
    setToken(tokens.access_token);
    const me = await fetchCurrentUser(tokens.access_token);
    setUser(me);
  }, []);

  const login = useCallback(
    async (email, password) => {
      setError("");
      try {
        const tokens = await loginApi({ email, password });
        await handleAuthSuccess(tokens);
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [handleAuthSuccess],
  );

  const register = useCallback(
    async (email, password, fullName) => {
      setError("");
      try {
        const tokens = await registerApi({ email, password, fullName });
        await handleAuthSuccess(tokens);
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [handleAuthSuccess],
  );

  const loginWithGoogle = useCallback(async (credential) => {
    setError("");
    try {
      const tokens = await loginWithGoogleApi(credential);
      await handleAuthSuccess(tokens);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }, [handleAuthSuccess]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, loading, error, login, register, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
