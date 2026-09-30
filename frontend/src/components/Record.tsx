import { Link } from "react-router-dom";
import { Empty, Provenance, Badge, Section } from "./ui";
export const fmt = (d?: string) => (d ? new Date(d).toLocaleDateString() : "");
export function Allergies({ items, lang, title }: { items?: any[]; lang?: string; title: string }) {
  if (!items) return null;
  return <Section title={title} lang={lang} speakText={items.map((a) => `${a.substance}, ${a.severity}`).join(". ")}>{!items.length ? <Empty text="No recorded allergies" /> :
    <ul className="space-y-2">{items.map((a, i) => <li key={i} className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{a.substance}</span>
      <Badge tone={a.severity === "SEVERE" ? "red" : "amber"}>{a.severity}</Badge><span className="text-slate-500">{a.reaction}</span><Provenance value={a.provenance} /></li>)}</ul>}</Section>;
}
export function Diagnoses({ items, title }: { items?: any[]; title: string }) {
  if (!items) return null;
  return <Section title={title}>{!items.length ? <Empty text="None recorded" /> : <ul className="space-y-2">{items.map((d) => <li key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
    <span className="font-medium">{d.name}</span><Badge tone={d.status === "ACTIVE" ? "amber" : d.status === "RESOLVED" ? "green" : "blue"}>{d.status}</Badge><Provenance value={d.provenance} /><span className="text-slate-400">{fmt(d.date)}</span></li>)}</ul>}</Section>;
}
export function Prescriptions({ items, title, lang }: { items?: any[]; title: string; lang?: string }) {
  if (!items) return null;
  return <Section title={title} lang={lang} speakText={items.flatMap((r) => r.items.map((i: any) => `${i.medicine} ${i.dosage} ${i.frequency} for ${i.duration}`)).join(". ")}>
    {!items.length ? <Empty text="None recorded" /> : <div className="space-y-3">{items.map((r) => <div key={r.id} className="rounded-lg border p-3 text-sm">
      <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{fmt(r.date)}</span><Link className="text-brand-700 underline" to={`/doctor/prescription/${r.id}`}>Open / print</Link></div>
      {r.items.map((i: any, k: number) => <div key={k}><b>{i.medicine}</b> — {i.dosage}, {i.frequency}, {i.duration}</div>)}</div>)}</div>}</Section>;
}
export function Notes({ items, title }: { items?: any[]; title: string }) {
  if (!items) return null;
  return <Section title={title}>{!items.length ? <Empty text="No notes" /> : <ul className="space-y-2">{items.map((n, i) => n.type === "IMPORTANT_FOR_FUTURE_DOCTORS" ?
    <li key={i} className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-3 text-sm"><div className="mb-1 text-xs font-bold uppercase text-amber-800">Important for future doctors</div>{n.text}</li> :
    <li key={i} className="rounded-lg bg-slate-50 p-3 text-sm">{n.text}</li>)}</ul>}</Section>;
}
export function TimelineList({ events }: { events?: any[] | null }) {
  if (!Array.isArray(events) || !events.length) return <Empty text="No events yet" />;
  return <ol className="relative ml-3 space-y-5 border-l-2 border-brand-600/30 pl-6">{events.map((e, i) => <li key={i} className="relative">
    <span className="absolute -left-[33px] top-1 h-3 w-3 rounded-full bg-brand-600" /><div className="text-xs text-slate-400">{new Date(e.at).toLocaleString()}</div>
    <div className="flex items-center gap-2 text-sm font-medium">{e.title}<Badge>{e.type}</Badge></div>{e.detail && <div className="text-sm text-slate-500">{e.detail}</div>}</li>)}</ol>;
}
