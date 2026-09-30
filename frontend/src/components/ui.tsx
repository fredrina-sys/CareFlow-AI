import { ReactNode, useState, createContext, useContext, useCallback } from "react";
import { Volume2 } from "lucide-react";
import { speak } from "../hooks/useVoice";
const TONES: Record<string, string> = { green: "bg-emerald-100 text-emerald-800", amber: "bg-amber-100 text-amber-800", red: "bg-red-100 text-red-800", blue: "bg-sky-100 text-sky-800", slate: "bg-slate-100 text-slate-700", purple: "bg-violet-100 text-violet-800" };
const PROV: Record<string, [string, string]> = { PATIENT_PROVIDED: ["Patient-provided", "slate"], OCR_EXTRACTED: ["OCR-extracted", "amber"], AI_GENERATED: ["AI-generated · unverified", "purple"], DOCTOR_ENTERED: ["Doctor-entered", "blue"], DOCTOR_VERIFIED: ["Doctor-verified", "green"] };
export const Badge = ({ children, tone = "slate" }: { children: ReactNode; tone?: string }) => <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{children}</span>;
export const Provenance = ({ value }: { value: string }) => { const [l, t] = PROV[value] || [value, "slate"]; return <Badge tone={t}>{l}</Badge>; };
export const Priority = ({ v }: { v: string }) => <Badge tone={v === "EMERGENCY" ? "red" : v === "URGENT" ? "amber" : "green"}>{v}</Badge>;
export const Loading = ({ text = "Loading…" }: { text?: string }) => <p role="status" className="p-6 text-sm text-slate-500">{text}</p>;
export const Empty = ({ text }: { text: string }) => <p className="py-6 text-center text-sm text-slate-400">{text}</p>;
export const ErrorBox = ({ msg, retry }: { msg: string; retry?: () => void }) => <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{msg} {retry && <button className="ml-2 underline" onClick={retry}>Retry</button>}</div>;
export const Section = ({ title, children, speakText, lang }: { title: string; children: ReactNode; speakText?: string; lang?: string }) => (
  <section className="card"><div className="mb-3 flex items-center justify-between"><h2 className="text-base font-semibold">{title}</h2>
    {speakText && <button aria-label="Read aloud" className="text-slate-400 hover:text-brand-600" onClick={() => speak(speakText, lang || "en")}><Volume2 size={18} /></button>}</div>{children}</section>);
export const AlertNote = ({ text }: { text: string }) => <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900">{text}</div>;
const ToastCtx = createContext<(m: string, err?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ m: string; err?: boolean } | null>(null);
  const show = useCallback((m: string, err?: boolean) => { setT({ m, err }); setTimeout(() => setT(null), 4000); }, []);
  return <ToastCtx.Provider value={show}>{children}{t && <div role="status" className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.err ? "bg-red-600" : "bg-slate-900"}`}>{t.m}</div>}</ToastCtx.Provider>;
}
