import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../services/api";
import { User } from "../types";
const Ctx = createContext<{ user: User | null; loading: boolean; login: (e: string, p: string) => Promise<User>; logout: () => Promise<void> }>(null as any);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!localStorage.getItem("cf_token")) { setLoading(false); return; }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => localStorage.removeItem("cf_token")).finally(() => setLoading(false));
  }, []);
  const login = async (email: string, password: string) => {
    const r = await api.post("/auth/login", { email, password }); localStorage.setItem("cf_token", r.data.access_token); setUser(r.data.user); return r.data.user as User;
  };
  const logout = async () => {
    localStorage.setItem("cf_logging_out", "1");
    try { await api.post("/auth/logout"); } catch {}
    localStorage.removeItem("cf_token");
    setUser(null);
    localStorage.removeItem("cf_logging_out");
  };
  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
export const homeFor = (r: string) => ({ PATIENT: "/patient/dashboard", DOCTOR: "/doctor/dashboard", TRIAGE: "/triage/dashboard", ADMIN: "/admin/dashboard" } as Record<string, string>)[r] || "/login";
