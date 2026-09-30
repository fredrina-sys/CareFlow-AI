import axios from "axios";
export const api = axios.create({ baseURL: ((import.meta as any).env?.VITE_API_URL as string) || "/api" });
api.interceptors.request.use((c) => { const t = localStorage.getItem("cf_token"); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use((r) => r, (e) => {
  const isAuthRequest = e.config?.url?.startsWith("/auth/");
  if (e.response?.status === 401 && localStorage.getItem("cf_token") && localStorage.getItem("cf_logging_out") !== "1" && !isAuthRequest && !location.pathname.startsWith("/login")) { localStorage.removeItem("cf_token"); location.href = "/login"; }
  return Promise.reject(e);
});
export const errMsg = (e: any): string => {
  const d = e?.response?.data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x.msg).join("; ");
  return "Something went wrong. Please try again.";
};
