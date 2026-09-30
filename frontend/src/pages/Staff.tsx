import { FormEvent, useState } from "react";
import { Building2, ShieldAlert, Users, History, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api, errMsg } from "../services/api";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/Auth";
import { Badge, Empty, ErrorBox, Loading, Priority, Section, useToast } from "../components/ui";

export function TriageDashboard() {
  const q = useFetch<any[]>("/queue");
  const toast = useToast();
  const [sel, setSel] = useState<any>(null);
  const [v, setV] = useState<any>({});
  const [walk, setWalk] = useState({ full_name: "", complaint: "" });

  const pick = (e: any) => {
    setSel(e);
    setV({
      temperature_c: e.temperature_c ?? "",
      bp_systolic: e.bp_systolic ?? "",
      bp_diastolic: e.bp_diastolic ?? "",
      pulse: e.pulse ?? "",
      spo2: e.spo2 ?? "",
      symptoms: e.symptoms ?? "",
      priority: e.priority
    });
  };

  const save = async (ev: FormEvent) => {
    ev.preventDefault();
    const body: any = { status: "TRIAGED", priority: v.priority, symptoms: v.symptoms };
    for (const k of ["temperature_c", "bp_systolic", "bp_diastolic", "pulse", "spo2"]) {
      if (v[k] !== "") body[k] = Number(v[k]);
    }
    try {
      await api.patch(`/encounters/${sel.id}`, body);
      toast("Triage saved");
      setSel(null);
      q.reload();
    } catch (x) {
      toast(errMsg(x), true);
    }
  };

  const register = async (ev: FormEvent) => {
    ev.preventDefault();
    try {
      const p = await api.post("/patients", { full_name: walk.full_name });
      await api.post("/encounters", { patient_id: p.data.id, chief_complaint: walk.complaint });
      toast("Walk-in patient registered and queued");
      setWalk({ full_name: "", complaint: "" });
      q.reload();
    } catch (x) {
      toast(errMsg(x), true);
    }
  };

  return (
    <div className="space-y-4">
      <Section title="Waiting Patients (Triage Queue)">
        {q.loading ? <Loading /> : q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : !q.data?.length ? <Empty text="Queue is empty" /> :
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b">
                <tr><th>Patient</th><th>Chief Complaint</th><th>Priority</th><th>Vitals</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {q.data.map((e) => {
                  const isEm = e.priority === "EMERGENCY" || (e.token_number && e.token_number.includes("EMERGENCY"));
                  const spo2Low = e.spo2 && e.spo2 < 92;
                  const tempHigh = e.temperature_c && e.temperature_c >= 38.0;
                  return (
                    <tr key={e.id} className={`border-b transition-colors ${isEm ? "bg-red-50/80 hover:bg-red-100/70 border-red-200" : "hover:bg-slate-50"}`}>
                      <td className="py-3 font-semibold text-slate-900">
                        <div className="flex items-center gap-1.5">
                          {isEm && <span className="flex h-2 w-2 rounded-full bg-red-600 animate-ping" />}
                          <span>{e.patient_name}</span>
                        </div>
                        {isEm && <div className="text-[10px] font-black text-red-700 tracking-wider">🚨 EMERGENCY BYPASS ({e.token_number})</div>}
                      </td>
                      <td className="text-slate-700">{e.chief_complaint || "—"}</td>
                      <td>
                        {isEm ? (
                          <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-black text-white shadow-xs animate-pulse">
                            EMERGENCY
                          </span>
                        ) : (
                          <Priority v={e.priority} />
                        )}
                      </td>
                      <td className="text-xs">
                        <span className={tempHigh ? "font-bold text-red-600" : "text-slate-600"}>
                          {e.temperature_c ? `${e.temperature_c}°C ` : "— "}
                        </span>
                        · 
                        <span className={spo2Low ? "font-bold text-red-600" : "text-slate-600"}>
                          {e.spo2 ? ` SpO₂ ${e.spo2}% ` : " SpO₂ — "}
                        </span>
                        · <span className="text-slate-500">{e.pulse ? `HR ${e.pulse}` : "HR —"}</span>
                      </td>
                      <td><Badge tone={e.status === "TRIAGED" ? "green" : isEm ? "red" : "slate"}>{e.status}</Badge></td>
                      <td className="text-right">
                        <button className={`btn-ghost text-xs ${isEm ? "text-red-700 font-bold hover:bg-red-100" : ""}`} onClick={() => pick(e)}>
                          {isEm ? "🚨 ER Vitals" : "Enter Vitals"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
      </Section>

      {sel && (
        <Section title={`Triage Assessment: ${sel.patient_name}`}>
          <form onSubmit={save} className="grid gap-3 md:grid-cols-4">
            {[
              ["temperature_c", "Temp °C (Normal: 36.5–37.5)"],
              ["bp_systolic", "BP systolic (mmHg)"],
              ["bp_diastolic", "BP diastolic (mmHg)"],
              ["pulse", "Pulse (bpm)"],
              ["spo2", "SpO₂ % (Normal: >95%)"]
            ].map(([k, l]) => (
              <div key={k}>
                <label className="label">{l}</label>
                <input
                  className="input"
                  type="number"
                  step="any"
                  value={v[k]}
                  onChange={(x) => setV({ ...v, [k]: x.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="label">Triage Priority</label>
              <select className="input" value={v.priority} onChange={(x) => setV({ ...v, priority: x.target.value })}>
                {["ROUTINE", "URGENT", "EMERGENCY"].map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Basic Triage Symptoms / Notes</label>
              <input className="input" value={v.symptoms} onChange={(x) => setV({ ...v, symptoms: x.target.value })} />
            </div>
            <div className="md:col-span-4 flex gap-2">
              <button className="btn">Save & Complete Triage</button>
              <button type="button" className="btn-ghost" onClick={() => setSel(null)}>Cancel</button>
            </div>
          </form>
        </Section>
      )}

      <Section title="Register Walk-in Patient">
        <form onSubmit={register} className="flex flex-wrap gap-2">
          <input
            className="input flex-1"
            required
            placeholder="Patient full name"
            value={walk.full_name}
            onChange={(x) => setWalk({ ...walk, full_name: x.target.value })}
          />
          <input
            className="input flex-1"
            placeholder="Presenting complaint"
            value={walk.complaint}
            onChange={(x) => setWalk({ ...walk, complaint: x.target.value })}
          />
          <button className="btn">Register & Queue for OPD</button>
        </form>
      </Section>
    </div>
  );
}

export function AdminDashboard() {
  const logs = useFetch<any[]>("/audit-logs");
  const hosp = useFetch<any[]>("/hospitals");
  const [filterEmergency, setFilterEmergency] = useState(false);

  const allLogs = logs.data || [];
  const displayLogs = filterEmergency
    ? allLogs.filter((l) => l.action.includes("EMERGENCY") || l.action.includes("BREAK_GLASS"))
    : allLogs;

  const emergencyCount = allLogs.filter((l) => l.action.includes("EMERGENCY") || l.action.includes("BREAK_GLASS")).length;

  return (
    <div className="space-y-4">
      {/* Admin Governance Banner */}
      <div className="card border-slate-200 bg-gradient-to-r from-slate-50 via-teal-50/30 to-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Hospital Administration & Regulatory Oversight</h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl">
              Administrators maintain multi-hospital facility settings, credential licensed medical staff, and monitor HIPAA / ABDM compliance audit logs for emergency break-glass data transfers.
            </p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            <CheckCircle2 size={14} /> System Secure
          </span>
        </div>
      </div>

      {/* Facilities Overview */}
      <Section title="Configured Hospital Facilities">
        <div className="grid gap-3 md:grid-cols-2">
          {hosp.data?.map((h) => (
            <div key={h.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-800">
                <Building2 size={20} />
              </div>
              <div className="flex-1">
                <div className="font-semibold text-slate-900">{h.name}</div>
                <div className="text-xs text-slate-500">{h.city} · Full OPD & Emergency enabled</div>
              </div>
              <Badge tone="green">Active</Badge>
            </div>
          ))}
        </div>
      </Section>

      {/* Compliance & Emergency Break-Glass Audit Trail */}
      <Section title="Regulatory Audit Log">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            Immutable system logs tracking record access, consent revocations, and cross-hospital emergency break-glass overrides.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterEmergency(false)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                !filterEmergency ? "bg-slate-900 text-white" : "btn-ghost"
              }`}
            >
              All Events ({allLogs.length})
            </button>
            <button
              onClick={() => setFilterEmergency(true)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                filterEmergency ? "bg-red-600 text-white" : "border border-red-300 bg-red-50 text-red-700"
              }`}
            >
              <AlertTriangle size={13} />
              Emergency Break-Glass ({emergencyCount})
            </button>
          </div>
        </div>

        {logs.loading ? <Loading /> : logs.error ? <ErrorBox msg={logs.error} retry={logs.reload} /> : !displayLogs.length ? <Empty text="No log events match filter" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="uppercase text-slate-400 border-b">
                <tr>
                  <th className="py-2">Timestamp</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Actor ID</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayLogs.map((l, i) => {
                  const isEmergency = l.action.includes("EMERGENCY") || l.action.includes("BREAK_GLASS");
                  return (
                    <tr key={i} className={`hover:bg-slate-50 ${isEmergency ? "bg-red-50/50" : ""}`}>
                      <td className="py-2.5 font-mono text-slate-600">
                        {new Date(l.at).toLocaleString()}
                      </td>
                      <td>
                        <Badge tone={isEmergency ? "red" : l.action.startsWith("SHARED") ? "amber" : "slate"}>
                          {l.action}
                        </Badge>
                      </td>
                      <td className="font-medium text-slate-800">{l.resource}</td>
                      <td className="font-mono text-slate-500">{l.actor_id?.slice(0, 8)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

export function Profile() {
  const { user } = useAuth();
  return (
    <Section title="User Profile">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <dt className="text-slate-500">Full Name</dt>
        <dd className="font-semibold text-slate-900">{user?.full_name}</dd>
        <dt className="text-slate-500">Email Address</dt>
        <dd className="text-slate-900">{user?.email}</dd>
        <dt className="text-slate-500">System Role</dt>
        <dd><Badge tone="blue">{user?.role}</Badge></dd>
        {user?.hospital_id && (
          <>
            <dt className="text-slate-500">Assigned Facility</dt>
            <dd className="font-mono text-xs text-slate-600">{user.hospital_id}</dd>
          </>
        )}
      </dl>
    </Section>
  );
}
