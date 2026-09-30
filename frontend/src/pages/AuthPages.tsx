import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { homeFor, useAuth } from "../context/Auth";
import { useI18n } from "../i18n";
import { api, errMsg } from "../services/api";
import { ErrorBox } from "../components/ui";

const Frame = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen items-center justify-center p-4"><div className="card w-full max-w-md space-y-4">
    <div className="flex items-center gap-2 text-xl font-bold text-brand-700"><HeartPulse /> CareFlow AI</div>{children}
    <p className="text-xs text-slate-400">Demo only — synthetic data. AI output is an assistant and always needs doctor verification.</p></div></div>);

export function Login() {
  const { login } = useAuth(); const { t } = useI18n(); const nav = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr("");
    try { const u = await login(email, password); nav(homeFor(u.role)); } catch (x) { setErr(errMsg(x)); } finally { setBusy(false); } };
  return <Frame><h1 className="text-lg font-semibold">{t("login.title")}</h1>
    <form onSubmit={submit} className="space-y-3">
      <div><label className="label" htmlFor="e">{t("login.email")}</label><input id="e" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label" htmlFor="p">{t("login.password")}</label><input id="p" className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {err && <ErrorBox msg={err} />}<button className="btn w-full justify-center" disabled={busy}>{t("login.submit")}</button></form>
    <Link className="text-sm text-brand-700 underline" to="/register">{t("login.register")}</Link></Frame>;
}

export function Register() {
  const nav = useNavigate(); const { t } = useI18n();
  const [f, setF] = useState({ full_name: "", email: "", password: "", dob: "", gender: "F", preferred_language: "en" }); const [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => { e.preventDefault(); setErr("");
    try { await api.post("/auth/register", { ...f, dob: f.dob || null }); nav("/login"); } catch (x) { setErr(errMsg(x)); } };
  return <Frame><h1 className="text-lg font-semibold">{t("login.register")}</h1>
    <form onSubmit={submit} className="space-y-3">
      <input className="input" placeholder="Full name" required value={f.full_name} onChange={set("full_name")} />
      <input className="input" type="email" placeholder="Email" required value={f.email} onChange={set("email")} />
      <input className="input" type="password" minLength={8} placeholder="Password (min 8)" required value={f.password} onChange={set("password")} />
      <div className="grid grid-cols-3 gap-2"><input className="input col-span-2" type="date" value={f.dob} onChange={set("dob")} aria-label="Date of birth" />
        <select className="input" value={f.gender} onChange={set("gender")}><option value="F">F</option><option value="M">M</option><option value="O">Other</option></select></div>
      <select className="input" value={f.preferred_language} onChange={set("preferred_language")}><option value="en">English</option><option value="kn">ಕನ್ನಡ</option></select>
      {err && <ErrorBox msg={err} />}<button className="btn w-full justify-center">{t("login.register")}</button></form>
    <Link className="text-sm text-brand-700 underline" to="/login">{t("login.title")}</Link></Frame>;
}
