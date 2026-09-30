import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Activity, CalendarClock, FileText, HeartPulse, LayoutDashboard, LogOut, Menu, Mic, MicOff, Pill, Share2, ShieldCheck, Stethoscope, User, Users, X, ClipboardList, Globe2, ShieldAlert } from "lucide-react";
import { useAuth } from "../context/Auth";
import { LANGS, useI18n } from "../i18n";
import { useVoice } from "../hooks/useVoice";
import { api } from "../services/api";
import { EmergencyBypassModal } from "../components/EmergencyBypassModal";

type Item = [string, string, any];
const NAV: Record<string, Item[]> = {
  PATIENT: [
    ["/patient/dashboard", "nav.dashboard", LayoutDashboard],
    ["/patient/timeline", "nav.timeline", Activity],
    ["/patient/prescriptions", "Prescriptions", Pill],
    ["/patient/follow-ups", "Follow-ups", CalendarClock],
    ["/patient/documents", "nav.documents", FileText],
    ["/patient/consent", "nav.consent", Share2],
    ["/profile", "Profile", User]
  ],
  DOCTOR: [
    ["/doctor/dashboard", "nav.dashboard", Stethoscope],
    ["/doctor/patients", "Patients", Users],
    ["/profile", "Profile", User]
  ],
  TRIAGE: [
    ["/triage/dashboard", "Triage Queue", ClipboardList],
    ["/profile", "Profile", User]
  ],
  ADMIN: [
    ["/admin/dashboard", "Audit & Hospitals", ShieldCheck],
    ["/profile", "Profile", User]
  ],
};

const VOICE_ROUTES: [RegExp, string][] = [
  [/prescription|medicine|medication|ಔಷಧ/i, "/patient/prescriptions"],
  [/timeline|history|ಟೈಮ್‌ಲೈನ್/i, "/patient/timeline"],
  [/follow/i, "/patient/follow-ups"],
  [/document|report|upload|ದಾಖಲೆ/i, "/patient/documents"],
  [/consent|shar(e|ing)|ಹಂಚಿಕೆ/i, "/patient/consent"],
  [/home|dashboard|ಡ್ಯಾಶ್/i, "/patient/dashboard"]
];

export default function Shell() {
  const { user, logout } = useAuth();
  const { lang, setLang, t } = useI18n();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState(false);
  const [result, setResult] = useState("");
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  const changeLang = (l: string) => {
    setLang(l);
    if (user?.role === "PATIENT") {
      api.patch("/me/language", null, { params: { lang: l } }).catch(() => {});
    }
  };

  const v = useVoice(lang, (text) => {
    if (user?.role !== "PATIENT") {
      setResult("Voice navigation is available on the patient screens.");
      return;
    }
    const hit = VOICE_ROUTES.find(([re]) => re.test(text));
    if (hit) {
      setResult(`Opening “${hit[1].split("/").pop()}”`);
      nav(hit[1]);
    } else {
      setResult(lang === "kn" 
        ? "ನಾನು ತೆರೆಯಬಲ್ಲೆ: ಡ್ಯಾಶ್‌ಬೋರ್ಡ್, ಟೈಮ್‌ಲೈನ್, ಔಷಧಿಗಳು, ಅಥವಾ ದಾಖಲೆಗಳು."
        : "I can open: dashboard, timeline, prescriptions, follow-ups, documents, or sharing.");
    }
  });

  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
      isActive
        ? "bg-brand-50 text-teal-800 shadow-sm border border-teal-100"
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    }`;

  const listening = v.state === "listening";

  const handleLogout = async () => {
    await logout();
    nav("/"); // Navigate to home page instead of login page
  };

  const userInitial = user?.full_name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-slate-50/70 lg:flex">
      {/* Sidebar Navigation */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 w-64 transform border-r border-slate-200/90 bg-white p-5 transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        } shadow-[2px_0_12px_rgba(0,0,0,0.02)]`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white shadow-md">
              <HeartPulse size={20} />
            </span>
            <span className="tracking-tight">{t("app.name")}</span>
          </Link>
          <button className="lg:hidden rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close menu" onClick={() => setOpen(false)}>
            <X size={20} />
          </button>
        </div>

        <nav className="space-y-1.5" onClick={() => setOpen(false)}>
          {NAV[user!.role].map(([to, k, Icon]) => (
            <NavLink key={to} to={to} className={link}>
              <Icon size={18} className="shrink-0 text-slate-500" />
              <span>{k.includes(".") ? t(k) : k}</span>
            </NavLink>
          ))}
        </nav>

        {/* Language selector in sidebar bottom */}
        <div className="absolute bottom-5 left-5 right-5 space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
            <Globe2 size={14} className="text-teal-600" />
            <span>Language / ಭಾಷೆ</span>
          </div>
          <select
            id="lang"
            className="input !py-1.5 !text-xs bg-white"
            value={lang}
            onChange={(e) => changeLang(e.target.value)}
          >
            {Object.entries(LANGS).map(([k, l]) => (
              <option key={k} value={k}>{l.label}</option>
            ))}
          </select>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main Content Area */}
      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/90 bg-white/95 px-6 py-3.5 backdrop-blur shadow-sm">
          <div className="flex items-center gap-3">
            <button className="lg:hidden rounded-lg p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <span className="inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-bold text-teal-800 border border-teal-100">
                {user!.role}
              </span>
              <span className="text-xs text-slate-400">Workspace</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Prominent Emergency Bypass Header Action */}
            <button
              onClick={() => setEmergencyOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-3 py-1.5 text-xs font-black text-white shadow-sm hover:from-red-700 hover:to-rose-800 transition-all animate-pulse"
              title="Immediate ER casualty admission without OPD wait"
            >
              <ShieldAlert size={15} />
              <span className="hidden sm:inline">{lang === "kn" ? "🚨 ತುರ್ತು ಬೈಪಾಸ್" : "🚨 Emergency Bypass"}</span>
              <span className="sm:hidden">ER Bypass</span>
            </button>

            {/* Voice Navigation Quick Button */}
            <button
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                listening
                  ? "border-red-400 bg-red-50 text-red-700 animate-pulse"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              aria-pressed={listening}
              aria-label="Voice navigation"
              onClick={() => setPanel(!panel)}
            >
              {listening ? <Mic size={15} /> : <MicOff size={15} />}
              <span className="hidden md:inline">{t("voice.idle")}</span>
            </button>

            {/* User Profile Badge */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-teal-800 text-xs font-bold shadow-inner">
                {userInitial}
              </div>
              <span className="hidden text-sm font-semibold text-slate-800 md:inline">{user!.full_name}</span>
            </div>

            {/* Logout -> Navigates to Home / */}
            <button
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all"
              onClick={handleLogout}
              title="Log out and return to Home"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">{t("nav.logout")}</span>
            </button>
          </div>
        </header>

        {/* Global Voice Panel Drawer */}
        {panel && (
          <div className="no-print border-b border-teal-100 bg-teal-50/70 px-6 py-4 shadow-inner" aria-live="polite">
            <div className="mx-auto max-w-4xl space-y-2 text-sm">
              {!v.supported ? (
                <p className="text-amber-800 text-xs">{t("voice.unsupported")} Try Chrome or Edge on localhost/HTTPS.</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {!listening ? (
                      <button className="btn text-xs py-1.5" onClick={() => { setResult(""); v.start(); }}>
                        <Mic size={15} /> Start Voice Navigation
                      </button>
                    ) : (
                      <>
                        <button className="btn bg-red-600 hover:bg-red-700 text-xs py-1.5" onClick={v.stop}>
                          Stop
                        </button>
                        <button className="btn-ghost text-xs py-1.5" onClick={v.cancel}>
                          Cancel
                        </button>
                      </>
                    )}
                    <button className="btn-ghost text-xs py-1.5" onClick={() => { v.clear(); setResult(""); }}>
                      Clear
                    </button>
                    <span className={`text-xs font-bold ${listening ? "text-red-600" : "text-slate-500"}`}>
                      {listening ? "● " + t("voice.listening") : v.state === "error" ? "Mic Issue" : "Idle"}
                    </span>
                  </div>
                  {v.transcript && <p className="text-xs">Recognized: <b>“{v.transcript}”</b></p>}
                  {result && <p className="text-xs font-semibold text-teal-800">{result}</p>}
                  {v.error && <p role="alert" className="text-xs text-red-700">{v.error}</p>}
                </>
              )}
              <p className="text-[11px] text-slate-500">{t("voice.disclaimer")}</p>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-6xl p-5 md:p-8">
          <Outlet />
        </main>

        <footer className="no-print p-6 text-center text-xs text-slate-400 border-t border-slate-200/60 mt-8">
          CareFlow AI · Longitudinal Health Records & Digital OPD · All demo data synthetic.
        </footer>

        {/* Global Emergency Casualty Bypass Modal */}
        <EmergencyBypassModal
          isOpen={emergencyOpen}
          onClose={() => setEmergencyOpen(false)}
          lang={lang === "kn" ? "kn" : "en"}
          onSuccess={() => {
            if (user?.role === "PATIENT") {
              nav("/patient/dashboard");
            }
          }}
        />
      </div>
    </div>
  );
}
