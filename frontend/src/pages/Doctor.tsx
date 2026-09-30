import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Printer, Sparkles, Mic, MicOff, ShieldAlert, CheckCircle2, Zap, MessageSquare, AlertTriangle } from "lucide-react";
import { api, errMsg } from "../services/api";
import { useFetch } from "../hooks/useFetch";
import { useDictation } from "../hooks/useVoice";
import { AlertNote, Badge, Empty, ErrorBox, Loading, Priority, Section, useToast } from "../components/ui";
import { Allergies, Diagnoses, Notes, Prescriptions, TimelineList } from "../components/Record";

const COMMON_DIAGNOSES = [
  "Viral Upper Respiratory Tract Infection",
  "Acute Gastroenteritis",
  "Acute Bronchitis",
  "Essential Hypertension",
  "Tension Headache / Migraine",
  "Allergic Rhinitis",
  "Type 2 Diabetes Mellitus"
];

const PRESCRIPTION_TEMPLATES: Record<string, Array<{ medicine_name: string; dosage: string; route: string; frequency: string; duration: string; instructions: string }>> = {
  "URI / Cold & Cough": [
    { medicine_name: "Paracetamol 650mg", dosage: "650 mg", route: "ORAL", frequency: "TDS (Thrice daily)", duration: "3 days", instructions: "Post meals" },
    { medicine_name: "Cetirizine 10mg", dosage: "10 mg", route: "ORAL", frequency: "HS (At bedtime)", duration: "5 days", instructions: "May cause drowsiness" },
    { medicine_name: "Normal Saline Nasal Spray", dosage: "2 puffs", route: "NASAL", frequency: "BD", duration: "5 days", instructions: "Both nostrils" }
  ],
  "Fever & Body Ache": [
    { medicine_name: "Paracetamol 650mg", dosage: "650 mg", route: "ORAL", frequency: "TDS (Thrice daily)", duration: "3 days", instructions: "Post meals" },
    { medicine_name: "Pantoprazole 40mg", dosage: "40 mg", route: "ORAL", frequency: "OD (Once daily)", duration: "3 days", instructions: "Before breakfast" }
  ],
  "Gastritis / Acidity": [
    { medicine_name: "Pantoprazole 40mg", dosage: "40 mg", route: "ORAL", frequency: "OD (Morning)", duration: "7 days", instructions: "Before breakfast" },
    { medicine_name: "Antacid Gel (Mucaine)", dosage: "10 ml", route: "ORAL", frequency: "TDS", duration: "3 days", instructions: "1 hour after food" }
  ],
  "Allergy / Skin Rash": [
    { medicine_name: "Cetirizine 10mg", dosage: "10 mg", route: "ORAL", frequency: "OD (Night)", duration: "5 days", instructions: "Take at bedtime" },
    { medicine_name: "Calamine Lotion", dosage: "Apply topically", route: "TOPICAL", frequency: "BD", duration: "5 days", instructions: "Apply gently to affected area" }
  ]
};

export function DoctorDashboard() {
  const q = useFetch<any[]>("/queue"); const pts = useFetch<any[]>("/patients"); const nav = useNavigate(); const toast = useToast(); const [search, setSearch] = useState("");
  const [recordId, setRecordId] = useState("");
  const open = async (e: any) => { try { if (e.status !== "IN_CONSULT") await api.patch(`/encounters/${e.id}`, { status: "IN_CONSULT" }); nav(`/doctor/consultation/${e.id}`); } catch (x) { toast(errMsg(x), true); } };
  const markUnavailable = async (e: any) => {
    const prompt = e.status === "IN_CONSULT"
      ? "This will stop your consultation and return the patient to the waiting queue with their token kept. They can choose another doctor. Continue?"
      : "You will be removed from this waiting patient. Their token and queue place will be kept, and they can choose another doctor. Continue?";
    if (!window.confirm(prompt)) return;
    try {
      await api.post(`/encounters/${e.id}/doctor-unavailable`, { reason: "Assigned doctor became unavailable before consultation" });
      toast("Patient notified in their dashboard. Their queue place is saved for reassignment.");
      q.reload();
    } catch (x) { toast(errMsg(x), true); }
  };
  const list = pts.data?.filter((p) => p.full_name.toLowerCase().includes(search.toLowerCase())) ?? [];
  return (
    <div className="space-y-4">
      <Section title="Today's OPD Queue">
        {q.loading ? <Loading /> : q.error ? <ErrorBox msg={q.error} retry={q.reload} /> : !q.data?.length ? <Empty text="No patients currently in queue" /> :
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b">
                <tr><th>Patient</th><th>Chief Complaint</th><th>Vitals</th><th>Priority</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {q.data.map((e) => {
                  const isEm = e.priority === "EMERGENCY" || (e.token_number && e.token_number.includes("EMERGENCY"));
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
                      <td className="text-xs text-slate-500">
                        {e.temperature_c ? `${e.temperature_c}°C ` : ""}
                        {e.spo2 ? `SpO₂ ${e.spo2}% ` : ""}
                        {e.pulse ? `HR ${e.pulse}` : ""}
                      </td>
                      <td>
                        {isEm ? (
                          <span className="rounded-md bg-red-600 px-2 py-0.5 text-xs font-black text-white shadow-xs animate-pulse">
                            EMERGENCY
                          </span>
                        ) : (
                          <Priority v={e.priority} />
                        )}
                      </td>
                      <td>
                        <Badge tone={e.status === "IN_CONSULT" ? "purple" : isEm ? "red" : "slate"}>{e.status}</Badge>
                        {e.doctor_name && <div className="mt-1 text-[10px] text-slate-500">Dr. {e.doctor_name}{e.assigned_to_me ? " · Assigned to you" : ""}</div>}
                      </td>
                      <td className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <button className={`btn ${isEm ? "bg-red-600 hover:bg-red-700 font-bold" : ""}`} onClick={() => open(e)}>
                            {e.status === "IN_CONSULT" ? "Continue" : isEm ? "🚨 Attend ER" : "Start Consult"}
                          </button>
                          {["WAITING", "TRIAGED", "IN_CONSULT"].includes(e.status) && (
                            <button
                              disabled={!e.assigned_to_me}
                              title={e.assigned_to_me ? "Release this patient to choose another doctor" : "Only the assigned doctor can release this patient"}
                              className={`text-[11px] font-semibold underline ${e.assigned_to_me ? "text-amber-700" : "cursor-not-allowed text-slate-400"}`}
                              onClick={() => e.assigned_to_me && markUnavailable(e)}
                            >
                              {e.status === "IN_CONSULT" ? "Can't continue" : "Can't consult"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
      </Section>

      <Section title="Search Patient Records">
        <form className="mb-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const id = recordId.trim(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) { toast("Enter a valid patient record ID", true); return; } nav(`/doctor/patients/${id}`); }}>
          <input className="input min-w-64 flex-1" placeholder="Emergency record lookup · patient record ID" value={recordId} onChange={(e) => setRecordId(e.target.value)} />
          <button className="btn border border-red-200 text-red-700" type="submit">Open emergency record</button>
        </form>
        <input className="input mb-3" placeholder="Search registered patients by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        {list.length ? (
          <ul className="divide-y border-t">
            {list.map((p) => (
              <li key={p.id} className="py-2.5 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-900">{p.full_name}</span>
                <Link className="btn-ghost text-xs text-brand-700" to={`/doctor/patients/${p.id}`}>
                  View Medical Record
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty text="No matching patient records found" />}
      </Section>
    </div>
  );
}

export const DoctorPatients = () => {
  const pts = useFetch<any[]>("/patients");
  return (
    <Section title="My Patients">
      {pts.loading ? <Loading /> : !pts.data?.length ? <Empty text="No patients yet" /> :
        <ul className="divide-y">
          {pts.data.map((p) => (
            <li key={p.id} className="py-2.5 flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900">{p.full_name}</span>
              <Link className="btn-ghost text-xs" to={`/doctor/patients/${p.id}`}>Open Record</Link>
            </li>
          ))}
        </ul>}
    </Section>
  );
};

export function DoctorPatient() {
  const { id } = useParams();
  const rec = useFetch(`/patients/${id}`);
  const tl = useFetch<any[]>(`/patients/${id}/timeline`);
  const docs = useFetch<any[]>(`/patients/${id}/documents`);
  const toast = useToast();
  const [ocr, setOcr] = useState<any>(null);

  // Emergency Break-Glass Access State
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState("");
  const [emergencyBusy, setEmergencyBusy] = useState(false);

  const view = async (d: string) => {
    try { setOcr({ id: d, ...(await api.get(`/documents/${d}`)).data }); }
    catch (x) { toast(errMsg(x), true); }
  };

  const review = async (action: string) => {
    const edited = action === "EDIT" ? prompt("Edit extracted text", ocr.ocr.text ?? "") : undefined;
    if (action === "EDIT" && !edited) return;
    try {
      setOcr({ id: ocr.id, ...(await api.post(`/documents/${ocr.id}/ocr/review`, { action, edited_text: edited })).data });
      toast(`OCR ${action.toLowerCase()}ed`);
      docs.reload();
    } catch (x) { toast(errMsg(x), true); }
  };

  const handleUnlockEmergency = async () => {
    if (!emergencyReason.trim()) {
      toast("Please enter a clinical emergency justification", true);
      return;
    }
    setEmergencyBusy(true);
    try {
      await api.post("/sharing/emergency-access", { patient_id: id, reason: emergencyReason });
      toast("Emergency Break-Glass Access verified and granted. Logged for regulatory audit.");
      setEmergencyOpen(false);
      rec.reload();
      tl.reload();
    } catch (x) {
      toast(errMsg(x), true);
    } finally {
      setEmergencyBusy(false);
    }
  };

  if (rec.loading) return <Loading />;

  // Cross-Hospital Locked Access Fallback
  if (rec.error) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-slate-800">
          <div className="flex items-center gap-3 text-red-700 mb-2">
            <ShieldAlert size={28} />
            <h2 className="text-lg font-bold">Cross-Hospital Access Restricted</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            This patient is registered at another hospital and has not granted advance data sharing consent to your facility.
          </p>

          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 font-semibold text-amber-900 mb-1">
              <AlertTriangle size={18} />
              <span>Emergency Break-Glass Protocol</span>
            </div>
            <p className="text-xs text-amber-800 mb-3">
              If this patient has presented in an acute emergency (e.g. trauma, cardiac arrest, unconscious transfer), treating doctors may verify and unlock full clinical records. Every emergency access is immutably logged for hospital compliance audit.
            </p>
            <div className="space-y-2">
              <input
                className="input bg-white text-sm"
                placeholder="Doctor verification reason (e.g. Acute trauma / unconscious in ER)..."
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
              />
              <button
                disabled={emergencyBusy}
                onClick={handleUnlockEmergency}
                className="btn bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {emergencyBusy ? "Verifying..." : "Verify as Doctor & Unlock Emergency Access"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const p = rec.data;

  return (
    <div className="space-y-4">
      {/* Patient Header */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{p.full_name}</h1>
            <p className="text-sm text-slate-500">{p.gender} · DOB {p.dob ?? "—"}</p>
          </div>
          <div className="flex gap-2">
            {p.access === "SHARED" && (
              <Badge tone={p.emergency_access ? "red" : "amber"}>{p.emergency_access ? "Emergency Access · Audited" : "Consent-Shared View"}</Badge>
            )}
            {p.access === "FULL" && (
              <Badge tone="green">Full Hospital Access</Badge>
            )}
          </div>
        </div>

        {p.access === "SHARED" && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
          <span>{p.emergency_access ? "Emergency break-glass access is time-limited and audited." : "Shared record: limited to scopes consented by the patient. All access is logged."}</span>
            <button
              onClick={() => setEmergencyOpen(!emergencyOpen)}
              className="font-semibold text-red-700 underline hover:text-red-800"
            >
              Emergency Override?
            </button>
          </div>
        )}

        {emergencyOpen && (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 space-y-2 text-xs">
            <b className="text-red-800">Doctor Emergency Break-Glass Access:</b>
            <input
              className="input bg-white text-xs"
              placeholder="Clinical reason (e.g. Unconscious patient / drug allergy verification)..."
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
            />
            <button onClick={handleUnlockEmergency} disabled={emergencyBusy} className="btn bg-red-600 text-xs">
              Confirm Emergency Break-Glass
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Allergies items={p.allergies} title="Allergies" />
        <Diagnoses items={p.diagnoses} title="Previous Diagnoses" />
        <Prescriptions items={p.prescriptions} title="Previous Prescriptions" />
        <Notes items={p.notes} title="Doctor Notes & Alerts" />
      </div>

      {(p.access === "FULL" || p.emergency_access) && (
        <Section title="Longitudinal Medical Timeline">
          {tl.loading ? <Loading /> : tl.error ? <ErrorBox msg={tl.error} /> : <TimelineList events={tl.data!} />}
        </Section>
      )}

      <Section title="Uploaded Medical Documents">
        {!docs.data?.length ? <Empty text="No documents uploaded or shared" /> : (
          <ul className="divide-y">
            {docs.data.map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2.5 text-sm">
                <span className="flex-1 font-medium">{d.filename}</span>
                <Badge tone="amber">OCR {d.ocr_status}</Badge>
                <Badge tone={d.review_status === "PENDING_REVIEW" ? "purple" : "green"}>{d.review_status}</Badge>
                <button className="btn-ghost text-xs" onClick={() => view(d.id)}>Review</button>
              </li>
            ))}
          </ul>
        )}

        {ocr?.ocr && (
          <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <AlertNote text={ocr.ocr.notice} />
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded bg-white p-3 text-xs border border-slate-200">
              {ocr.ocr.text ?? "(no text extracted)"}
            </pre>
            {p.access === "FULL" && (
              <div className="flex gap-2 pt-2">
                <button className="btn text-xs" onClick={() => review("ACCEPT")}>Accept Text</button>
                <button className="btn-ghost text-xs" onClick={() => review("EDIT")}>Edit Text</button>
                <button className="btn-ghost text-xs" onClick={() => review("REJECT")}>Reject</button>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

const DX = ["ACTIVE", "IMPROVING", "RESOLVED", "CHRONIC", "RULED_OUT"];
const blankMed = { medicine_name: "", dosage: "", route: "ORAL", frequency: "", duration: "", instructions: "" };

export function Consultation() {
  const { id } = useParams();
  const toast = useToast();
  const nav = useNavigate();
  const enc = useFetch(`/encounters/${id}`);
  const rec = useFetch(enc.data ? `/patients/${enc.data.patient_id}` : null);

  const [f, setF] = useState<any>({});
  const [dx, setDx] = useState({ name: "", status: "ACTIVE" });
  const [meds, setMeds] = useState([{ ...blankMed }]);
  const [note, setNote] = useState({ text: "", note_type: "CLINICAL_NOTE", visible_to_patient: false });
  const [fu, setFu] = useState({ due_date: "", reason: "" });
  const [ai, setAi] = useState<any>(null);
  const [rxId, setRxId] = useState("");

  // Doctor speech dictation hooks
  const examDictation = useDictation("en", (text) => {
    setF((prev: any) => ({
      ...prev,
      exam_findings: prev.exam_findings ? `${prev.exam_findings}. ${text}` : text
    }));
  });

  const noteDictation = useDictation("en", (text) => {
    setNote((prev) => ({
      ...prev,
      text: prev.text ? `${prev.text}. ${text}` : text
    }));
  });

  const act = async (fn: () => Promise<any>, ok: string) => {
    try {
      const r = await fn();
      toast(ok);
      enc.reload();
      return r;
    } catch (x) {
      toast(errMsg(x), true);
    }
  };

  if (enc.loading || rec.loading) return <Loading />;
  if (enc.error) return <ErrorBox msg={enc.error} retry={enc.reload} />;

  const e = enc.data, p = rec.data;
  const val = (k: string) => f[k] ?? e[k] ?? "";

  const saveExam = (ev: FormEvent) => {
    ev.preventDefault();
    act(() => api.patch(`/encounters/${id}`, {
      chief_complaint: val("chief_complaint"),
      symptoms: val("symptoms"),
      exam_findings: val("exam_findings")
    }), "Consultation notes saved");
  };

  const genAi = async () => {
    const r = await act(() => api.post("/ai/clinical-summary", { encounter_id: id }), "AI draft generated");
    if (r) setAi(r.data);
  };

  const reviewAi = async (a: "confirm" | "reject") => {
    const r = await act(() => api.post(`/ai/clinical-summary/${ai.id}/${a}`), a === "confirm" ? "Summary verified" : "Summary rejected");
    if (r) setAi({ ...ai, ...r.data });
  };

  const applyPrescriptionTemplate = (name: string) => {
    const tpl = PRESCRIPTION_TEMPLATES[name];
    if (tpl) {
      setMeds(tpl.map((item) => ({ ...item })));
      toast(`Loaded ${name} template`);
    }
  };

  const c = ai?.content;

  return (
    <div className="space-y-4">
      {/* Consultation Header */}
      <div className="card flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{p?.full_name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Priority v={e.priority} />
            <Badge tone="purple">{e.status}</Badge>
            <span className="text-xs text-slate-400">Encounter ID: {e.id.slice(0, 8)}</span>
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Link className="btn-ghost" to={`/doctor/patients/${e.patient_id}`}>Full Record</Link>
          <button
            className="btn bg-brand-600 hover:bg-brand-700"
            onClick={async () => {
              if (await act(() => api.patch(`/encounters/${id}`, { status: "COMPLETED" }), "Encounter completed")) {
                nav("/doctor/dashboard");
              }
            }}
          >
            Complete Encounter
          </button>
        </div>
      </div>

      {/* Voice Intake Summary (Saves Doctor Time!) */}
      {(e.chief_complaint || e.symptoms || e.interview?.length > 0) && (
        <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50/70 to-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2 font-bold text-teal-900">
            <MessageSquare size={18} className="text-teal-700" />
            <span>Spoken Patient Intake Summary (Pre-filled from Voice Assistant)</span>
          </div>
          <div className="grid gap-2 text-sm text-slate-800">
            <div><b>Reported Chief Complaint:</b> <span className="font-semibold text-teal-950">{e.chief_complaint}</span></div>
            {e.symptoms && <div><b>Duration & Reported Details:</b> {e.symptoms}</div>}

            {e.interview && e.interview.length > 0 && (
              <div className="mt-2 space-y-1.5 border-t border-teal-200/60 pt-2 text-xs">
                <span className="font-semibold uppercase tracking-wider text-teal-800">Spoken Q&A Transcript:</span>
                {e.interview.map((qa: any, idx: number) => (
                  <div key={idx} className="rounded-md bg-white/80 p-2 border border-teal-100">
                    <span className="font-semibold text-slate-700">Q: {qa.question}</span>
                    <div className="text-slate-900 mt-0.5">A: {qa.answer}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {e.red_flags?.length > 0 && (
        <div role="alert" className="card border-red-300 bg-red-50/90 shadow-sm">
          <div className="mb-1 font-bold text-red-900 flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>Clinical Red Flag Alerts</span>
          </div>
          {e.red_flags.map((r: any, i: number) => (
            <div key={i} className="text-sm text-red-800 font-medium">• {r.message}</div>
          ))}
          <div className="mt-2 text-xs text-red-700">{e.red_flags[0].disclaimer}</div>
        </div>
      )}

      {/* Triage Vitals */}
      <Section title="Triage Vitals">
        <div className="flex flex-wrap gap-6 text-sm">
          <span>Temperature: <b>{e.temperature_c ?? "—"} °C</b></span>
          <span>Blood Pressure: <b>{e.bp_systolic ?? "—"}/{e.bp_diastolic ?? "—"}</b></span>
          <span>Pulse: <b>{e.pulse ?? "—"} bpm</b></span>
          <span>SpO₂: <b>{e.spo2 ?? "—"}%</b></span>
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Allergies items={p?.allergies} title="Known Allergies" />
        <Diagnoses items={p?.diagnoses} title="Previous Diagnoses" />
      </div>

      {/* Consultation Notes with Doctor Voice Dictation */}
      <Section title="Clinical Consultation & Examination">
        <form onSubmit={saveExam} className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label">Chief Complaint</label>
            <textarea className="input" rows={3} value={val("chief_complaint")} onChange={(x) => setF({ ...f, chief_complaint: x.target.value })} />
          </div>
          <div>
            <label className="label">Symptoms & History</label>
            <textarea className="input" rows={3} value={val("symptoms")} onChange={(x) => setF({ ...f, symptoms: x.target.value })} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">Examination Findings</label>
              <button
                type="button"
                onClick={() => (examDictation.isRecording ? examDictation.stop() : examDictation.start())}
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded ${
                  examDictation.isRecording ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {examDictation.isRecording ? <MicOff size={12} /> : <Mic size={12} />}
                <span>{examDictation.isRecording ? "Listening..." : "Dictate"}</span>
              </button>
            </div>
            <textarea className="input" rows={3} placeholder="Speak or type findings..." value={val("exam_findings")} onChange={(x) => setF({ ...f, exam_findings: x.target.value })} />
          </div>
          <div className="md:col-span-3">
            <button className="btn">Save Examination Notes</button>
          </div>
        </form>
      </Section>

      {/* Diagnosis Section with 1-Click Chips */}
      <Section title="Diagnosis">
        <div className="mb-3">
          <label className="label">Quick-add common diagnosis:</label>
          <div className="flex flex-wrap gap-2">
            {COMMON_DIAGNOSES.map((cd) => (
              <button
                key={cd}
                type="button"
                onClick={() => setDx({ ...dx, name: cd })}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 transition-colors"
              >
                + {cd}
              </button>
            ))}
          </div>
        </div>

        <form
          className="flex flex-wrap gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            act(() => api.post("/diagnoses", { encounter_id: id, ...dx }), "Diagnosis added").then(() => {
              setDx({ name: "", status: "ACTIVE" });
              rec.reload();
            });
          }}
        >
          <input
            className="input flex-1"
            required
            placeholder="Type or click chip above for diagnosis"
            value={dx.name}
            onChange={(x) => setDx({ ...dx, name: x.target.value })}
          />
          <select className="input !w-auto" value={dx.status} onChange={(x) => setDx({ ...dx, status: x.target.value })}>
            {DX.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn">Add Diagnosis</button>
        </form>
      </Section>

      {/* Prescription with 1-Click Template Bundles */}
      <Section title="Prescription">
        <div className="mb-3">
          <div className="flex items-center gap-1.5 label">
            <Zap size={14} className="text-amber-500" />
            <span>1-Click Preset Prescription Bundles:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESCRIPTION_TEMPLATES).map((tplName) => (
              <button
                key={tplName}
                type="button"
                onClick={() => applyPrescriptionTemplate(tplName)}
                className="flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 transition-colors"
              >
                <span>⚡ {tplName}</span>
              </button>
            ))}
          </div>
        </div>

        <form
          className="space-y-3"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const r = await act(() => api.post("/prescriptions", { encounter_id: id, items: meds }), "Prescription issued");
            if (r) {
              setRxId(r.data.id);
              setMeds([{ ...blankMed }]);
              r.data.alerts?.forEach((a: any) => toast(a.message, true));
            }
          }}
        >
          {meds.map((m, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/50 p-2.5 md:grid-cols-6">
              {(["medicine_name", "dosage", "route", "frequency", "duration", "instructions"] as const).map((k) => (
                <input
                  key={k}
                  className="input bg-white text-xs"
                  placeholder={k.replace("_", " ")}
                  required={k !== "instructions"}
                  value={m[k]}
                  onChange={(x) => setMeds(meds.map((mm, j) => (j === i ? { ...mm, [k]: x.target.value } : mm)))}
                />
              ))}
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button type="button" className="btn-ghost text-xs" onClick={() => setMeds([...meds, { ...blankMed }])}>
              + Add Medicine Row
            </button>
            <button className="btn bg-brand-600 hover:bg-brand-700">Issue Prescription</button>
            {rxId && (
              <Link className="btn-ghost text-xs text-brand-700 font-semibold" to={`/doctor/prescription/${rxId}`}>
                <Printer size={16} /> Print Prescription
              </Link>
            )}
          </div>
        </form>
      </Section>

      {/* Doctor Notes & Dictation */}
      <Section title="Doctor Notes">
        <form
          className="space-y-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            act(() => api.post("/notes", { encounter_id: id, ...note }), "Note saved").then(() => {
              setNote({ ...note, text: "" });
              rec.reload();
            });
          }}
        >
          <div className="relative">
            <textarea
              className="input pr-12"
              required
              rows={2}
              placeholder="Clinical impression or recommendations..."
              value={note.text}
              onChange={(x) => setNote({ ...note, text: x.target.value })}
            />
            <button
              type="button"
              onClick={() => (noteDictation.isRecording ? noteDictation.stop() : noteDictation.start())}
              className={`absolute top-2 right-2 rounded p-1.5 text-xs ${
                noteDictation.isRecording ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
              title="Dictate note"
            >
              {noteDictation.isRecording ? <MicOff size={14} /> : <Mic size={14} />}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <select className="input !w-auto text-xs" value={note.note_type} onChange={(x) => setNote({ ...note, note_type: x.target.value })}>
              <option value="CLINICAL_NOTE">Clinical note</option>
              <option value="IMPORTANT_FOR_FUTURE_DOCTORS">Important for future doctors</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs text-slate-700">
              <input type="checkbox" checked={note.visible_to_patient} onChange={(x) => setNote({ ...note, visible_to_patient: x.target.checked })} />
              Visible to patient
            </label>
            <button className="btn text-xs">Save Note</button>
          </div>
        </form>
      </Section>

      {/* Follow-up Scheduling */}
      <Section title="Schedule Follow-up">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            act(() => api.post("/follow-ups", { encounter_id: id, ...fu }), "Follow-up scheduled");
          }}
        >
          <input className="input !w-auto text-sm" type="date" required value={fu.due_date} onChange={(x) => setFu({ ...fu, due_date: x.target.value })} />
          <input className="input flex-1 text-sm" placeholder="Reason (e.g. Review blood pressure / symptom check)" value={fu.reason} onChange={(x) => setFu({ ...fu, reason: x.target.value })} />
          <button className="btn">Schedule</button>
        </form>
      </Section>

      {/* AI Clinical Summary */}
      <Section title="AI Clinical Summary (Assistant Draft)">
        <div className="space-y-3">
          <AlertNote text="AI summary is an assistive draft and requires professional verification before entry into permanent record." />
          {!ai && (
            <button className="btn bg-brand-600" onClick={genAi}>
              <Sparkles size={16} /> Generate AI Summary Draft
            </button>
          )}
          {c && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center gap-2">
                <Badge tone={ai.status === "CONFIRMED" ? "green" : ai.status === "REJECTED" ? "red" : "purple"}>
                  {ai.status}
                </Badge>
              </div>
              <div><b>Patient Context:</b> {c.patient_context}</div>
              {(["relevant_history", "current_complaints", "known_allergies", "active_medications", "previous_diagnoses", "important_notes", "potential_red_flags", "suggested_questions_for_doctor"] as const).map((k) =>
                c[k]?.length > 0 && (
                  <div key={k}>
                    <b className="capitalize text-slate-800">{k.replace(/_/g, " ")}:</b>
                    <ul className="ml-5 list-disc text-slate-700">
                      {c[k].map((x: string, i: number) => <li key={i}>{x}</li>)}
                    </ul>
                  </div>
                )
              )}
              {ai.status === "PENDING_REVIEW" && (
                <div className="flex gap-2 pt-2">
                  <button className="btn text-xs" onClick={() => reviewAi("confirm")}>Confirm as Verified</button>
                  <button className="btn-ghost text-xs" onClick={() => reviewAi("reject")}>Reject Draft</button>
                </div>
              )}
            </div>
          )}
        </div>
      </Section>
    </div>
  );
}

export function PrescriptionPrint() {
  const { id } = useParams(); const rx = useFetch(`/prescriptions/${id}`);
  if (rx.loading) return <Loading />; if (rx.error) return <ErrorBox msg={rx.error} retry={rx.reload} />;
  const r = rx.data;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-3 flex justify-end">
        <button className="btn" onClick={() => window.print()}><Printer size={16} />Print Prescription</button>
      </div>
      <div className="card space-y-4 !p-8 shadow-md">
        <div className="border-b pb-3">
          <h1 className="text-xl font-bold text-slate-900">{r.hospital}</h1>
          <p className="text-sm text-slate-500">{r.doctor} · Reg. no. {r.registration_no}</p>
        </div>
        <div className="flex justify-between text-sm">
          <span>Patient: <b>{r.patient}</b></span>
          <span>Date: {r.date}</span>
        </div>
        <div className="text-sm">Diagnosis: <b>{r.diagnoses.join(", ") || "—"}</b></div>
        <table className="w-full text-left text-sm">
          <thead className="border-b text-xs uppercase text-slate-500">
            <tr><th>Medicine</th><th>Dosage</th><th>Route</th><th>Frequency</th><th>Duration</th></tr>
          </thead>
          <tbody>
            {r.items.map((i: any, k: number) => (
              <tr key={k} className="border-b align-top">
                <td className="py-2.5 font-medium text-slate-900">
                  {i.medicine}
                  {i.instructions && <div className="text-xs font-normal text-slate-500">{i.instructions}</div>}
                </td>
                <td>{i.dosage}</td>
                <td>{i.route}</td>
                <td>{i.frequency}</td>
                <td>{i.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {r.instructions && <div className="text-sm"><b>Doctor's Instructions:</b> {r.instructions}</div>}
        {r.follow_up && <div className="text-sm"><b>Next Follow-up:</b> {r.follow_up}</div>}
        <p className="border-t pt-3 text-xs text-slate-400">DEMO prescription — synthetic clinical data. Verified by treating doctor.</p>
      </div>
    </div>
  );
}
