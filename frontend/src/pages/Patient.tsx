import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mic, Sparkles, Clock, CheckCircle, Ticket, Stethoscope, Users, RefreshCw, AlertCircle, Copy, Check, FileText, ShieldAlert, PhoneCall, Building2 } from "lucide-react";
import { api, errMsg } from "../services/api";
import { useFetch, useMyPatientId } from "../hooks/useFetch";
import { useI18n } from "../i18n";
import { AlertNote, Badge, Empty, ErrorBox, Loading, Section, useToast } from "../components/ui";
import { Allergies, Diagnoses, Notes, Prescriptions, TimelineList, fmt } from "../components/Record";
import { VoiceOpdModal } from "../components/VoiceOpdModal";
import { EmergencyBypassModal } from "../components/EmergencyBypassModal";

export function PatientDashboard() {
  const { t, lang } = useI18n(); const toast = useToast();
  const patientLookup = useFetch<{ id: string; full_name: string }[]>("/patients");
  const pid = patientLookup.data?.[0]?.id ?? null;
  const rec = useFetch(pid ? `/patients/${pid}` : null);
  const hosp = useFetch<any[]>("/hospitals");
  const activeEnc = useFetch<any>(pid ? `/patients/${pid}/active-encounter` : null);
  const [hospital, setHospital] = useState(""); const [cc, setCc] = useState("");
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false);
  const [recentBooking, setRecentBooking] = useState<any>(null);
  const [recordIdCopied, setRecordIdCopied] = useState(false);
  const [alternativeDoctors, setAlternativeDoctors] = useState<any[]>([]);
  const [loadingAlternatives, setLoadingAlternatives] = useState(false);
  const [reassigningDoctor, setReassigningDoctor] = useState<string | null>(null);

  const currentEncounter = recentBooking || activeEnc.data;
  const isEncounterActive = currentEncounter && ["WAITING", "TRIAGED", "IN_CONSULT"].includes(currentEncounter.status);

  // Keep hooks above the loading/error returns so the hook order stays stable
  // when patient data finishes loading.
  useEffect(() => {
    const timer = window.setInterval(() => activeEnc.reload(), 10000);
    return () => window.clearInterval(timer);
  }, [activeEnc.reload]);

  useEffect(() => {
    if (activeEnc.data?.id) setRecentBooking(activeEnc.data);
  }, [activeEnc.data]);

  useEffect(() => {
    if (!currentEncounter?.doctor_assignment_pending) {
      setAlternativeDoctors([]);
      return;
    }
    let cancelled = false;
    setLoadingAlternatives(true);
    api.post("/triage/recommend", {
      chief_complaint: currentEncounter.chief_complaint,
      symptoms: currentEncounter.symptoms,
      preferred_hospital_id: currentEncounter.hospital_id,
      exclude_doctor_ids: currentEncounter.unavailable_doctor_id ? [currentEncounter.unavailable_doctor_id] : []
    }).then(({ data }) => {
      if (!cancelled) setAlternativeDoctors(data.candidate_doctors || []);
    }).catch(() => {
      if (!cancelled) setAlternativeDoctors([]);
    }).finally(() => {
      if (!cancelled) setLoadingAlternatives(false);
    });
    return () => { cancelled = true; };
  }, [currentEncounter?.id, currentEncounter?.doctor_assignment_pending]);

  if (patientLookup.loading) return <Loading text={t("common.loading")} />;
  if (patientLookup.error) return <ErrorBox msg={patientLookup.error} retry={patientLookup.reload} />;
  if (!pid) return <Empty text="No patient record is linked to this account. Please log out and sign in again, or contact the clinic administrator." />;
  if (rec.loading || !rec.data && !rec.error) return <Loading text={t("common.loading")} />;
  if (rec.error) return <ErrorBox msg={rec.error} retry={rec.reload} />;
  const p = rec.data;

  const chooseReplacementDoctor = async (doctorId: string) => {
    if (!currentEncounter?.id) return;
    setReassigningDoctor(doctorId);
    try {
      const { data } = await api.post(`/encounters/${currentEncounter.id}/reassign-doctor`, { doctor_id: doctorId });
      setRecentBooking(data);
      activeEnc.reload();
      toast(lang === "kn" ? "ಹೊಸ ವೈದ್ಯರನ್ನು ನಿಯೋಜಿಸಲಾಗಿದೆ" : "Your new doctor has been assigned");
    } catch (x) {
      toast(errMsg(x), true);
    } finally {
      setReassigningDoctor(null);
    }
  };

  const book = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payloadHosp = hospital.trim() ? hospital : null;
      const res = await api.post("/encounters", { patient_id: pid, hospital_id: payloadHosp, chief_complaint: cc });
      toast(lang === "kn" ? "ಒಪಿಡಿ ವಿನಂತಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ — ಎಐ ಆಸ್ಪತ್ರೆ & ವೈದ್ಯರನ್ನು ನಿಯೋಜಿಸಿದೆ" : "Visit requested — AI has assigned your hospital and specialist queue");
      setRecentBooking(res.data);
      activeEnc.reload();
      setCc("");
    } catch (x) {
      toast(errMsg(x), true);
    }
  };

  return (
    <div className="space-y-4">
      {/* Patient Header Card with Emergency Bypass & Voice Assistant */}
      <div className="card flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{p.full_name}</h1>
          <p className="text-sm text-slate-500">
            {p.gender} · DOB {p.dob ?? "—"} · Preferred: {p.preferred_language === "kn" ? "ಕನ್ನಡ" : "English"}
          </p>
          <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700" onClick={async () => { await navigator.clipboard.writeText(p.id); setRecordIdCopied(true); window.setTimeout(() => setRecordIdCopied(false), 2000); }} title="Share this ID with a treating doctor during an emergency">
            <Copy size={12} /> Patient record ID: {p.id} · {recordIdCopied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setEmergencyModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-md transition-all hover:from-red-700 hover:to-rose-800 hover:shadow-lg animate-pulse"
            title="Direct ER casualty admission without routine OPD wait"
          >
            <ShieldAlert size={18} />
            <span>{lang === "kn" ? "🚨 ತುರ್ತು ಬೈಪಾಸ್" : "🚨 Emergency Bypass (Direct ER)"}</span>
          </button>
          <button
            type="button"
            onClick={() => setVoiceModalOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:from-teal-700 hover:to-emerald-700 hover:shadow-lg"
          >
            <Mic size={18} />
            <span>{lang === "kn" ? "ಧ್ವನಿ ಒಪಿಡಿ ಸಹಾಯಕ" : "Voice OPD Assistant"}</span>
          </button>
        </div>
      </div>

      {/* PROMINENT LIVE OPD OR EMERGENCY BYPASS TOKEN & QUEUE STATUS CARD */}
      {isEncounterActive && (
        (currentEncounter.is_emergency_bypass || currentEncounter.priority === "EMERGENCY" || (currentEncounter.token_number && currentEncounter.token_number.includes("EMERGENCY"))) ? (
          <div className="rounded-2xl border-2 border-red-500 bg-gradient-to-br from-red-50 via-rose-50/70 to-white p-5 shadow-lg animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-red-200 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600 text-white shadow animate-pulse">
                  <ShieldAlert size={26} />
                </span>
                <div>
                  <span className="text-[11px] font-black uppercase tracking-wider text-red-700 flex items-center gap-1.5">
                    ● {lang === "kn" ? "ಸಕ್ರಿಯ ತುರ್ತು ಬೈಪಾಸ್ ಪಾಸ್" : "ACTIVE EMERGENCY BYPASS PASS"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-wide text-red-950">
                      {currentEncounter.token_number || "EMERGENCY-BYPASS-01"}
                    </span>
                    <span className="rounded-full bg-red-600 px-3 py-0.5 text-xs font-black text-white shadow-xs">
                      {lang === "kn" ? "ನೇರ ಕ್ಯಾಶುಯಲ್ಟಿ ಪ್ರವೇಶ (0 ಕಾಯುವಿಕೆ)" : "DIRECT ER ADMISSION (0 Wait)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="tel:108"
                  className="rounded-lg bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs px-3 py-1.5 flex items-center gap-1 shadow-xs transition-colors"
                >
                  <PhoneCall size={13} /> {lang === "kn" ? "108 ಆಂಬ್ಯುಲೆನ್ಸ್" : "Call 108 Ambulance"}
                </a>
                <button
                  onClick={() => activeEnc.reload()}
                  className="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-bold text-red-800 shadow-xs hover:bg-red-50 transition-colors"
                  title="Refresh ER status"
                >
                  <RefreshCw size={13} className={activeEnc.loading ? "animate-spin" : ""} />
                  <span>{lang === "kn" ? "ನವೀಕರಿಸಿ" : "Refresh"}</span>
                </button>
              </div>
            </div>

            <div className="grid gap-3 pt-3.5 sm:grid-cols-3">
              {/* Emergency Facility */}
              <div className="rounded-xl border border-red-200 bg-white p-3.5 shadow-xs">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Building2 size={12} className="text-red-600" />
                  {lang === "kn" ? "ತುರ್ತು ಚಿಕಿತ್ಸಾ ಆಸ್ಪತ್ರೆ" : "Emergency Facility"}
                </div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  {currentEncounter.hospital_name || "Emergency Trauma Center"}
                </div>
                <div className="text-xs text-red-700 font-semibold">
                  {currentEncounter.hospital_city || "Mangaluru"} · Level-1 24x7 ER
                </div>
              </div>

              {/* On-Duty ER Physician */}
              <div className="rounded-xl border border-red-200 bg-white p-3.5 shadow-xs">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Stethoscope size={12} className="text-red-600" />
                  {lang === "kn" ? "ಆನ್‌-ಕಾಲ್ ತುರ್ತು ವೈದ್ಯರು" : "On-Duty ER Physician"}
                </div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  {currentEncounter.doctor_name || "Emergency Care Specialist"}
                </div>
                <div className="text-xs text-teal-700 font-semibold">
                  {currentEncounter.doctor_specialty || "Emergency & Critical Care"}
                </div>
              </div>

              {/* Queue Status: Bypassed */}
              <div className="rounded-xl border border-red-200 bg-white p-3.5 shadow-xs">
                <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Clock size={12} className="text-red-600" />
                  {lang === "kn" ? "ಕ್ಯೂ ಸ್ಥಾನ" : "Queue Status"}
                </div>
                <div className="text-sm font-black text-red-700 mt-1">
                  0 Patients Ahead (Bypassed)
                </div>
                <div className="text-xs text-red-600 font-bold">
                  Immediate Bay Entry
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-red-950 font-medium pt-2 border-t border-red-100">
              <span>
                <b>Reason:</b> {currentEncounter.chief_complaint || "Acute Emergency"}
              </span>
              <span className="text-[11px] font-extrabold bg-red-100 text-red-800 px-2 py-0.5 rounded-md">
                {lang === "kn" ? "ಆಸ್ಪತ್ರೆ ತಲುಪಿದ ತಕ್ಷಣ ಈ ಸ್ಕ್ರೀನ್ ತೋರಿಸಿ" : "Show this screen at casualty entry for priority access"}
              </span>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/90 via-teal-50/60 to-white p-5 shadow-md animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200/60 pb-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow">
                  <Ticket size={22} />
                </span>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                    {lang === "kn" ? "ಲೈವ್ ಒಪಿಡಿ ಟೋಕನ್" : "Live OPD Token & Queue Status"}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tracking-wide text-emerald-900">
                      {currentEncounter.token_number || "TK-OPD-01"}
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      currentEncounter.status === "IN_CONSULT"
                        ? "bg-purple-100 text-purple-800 border border-purple-200"
                        : currentEncounter.status === "TRIAGED"
                        ? "bg-blue-100 text-blue-800 border border-blue-200"
                        : "bg-amber-100 text-amber-800 border border-amber-200"
                    }`}>
                      {currentEncounter.status === "WAITING"
                        ? (lang === "kn" ? "ಟ್ರಯೇಜ್ ಕ್ಯೂನಲ್ಲಿದೆ" : "Waiting in Triage")
                        : currentEncounter.status === "TRIAGED"
                        ? (lang === "kn" ? "ವೈದ್ಯರ ಭೇಟಿಗೆ ಕಾಯುತ್ತಿದೆ" : "Waiting for Doctor")
                        : (lang === "kn" ? "ವೈದ್ಯರ ಕೊಠಡಿಯಲ್ಲಿದೆ" : "In Doctor Consult")}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => activeEnc.reload()}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-xs hover:bg-emerald-50 transition-colors"
                title="Refresh queue status"
              >
                <RefreshCw size={14} className={activeEnc.loading ? "animate-spin" : ""} />
                <span>{lang === "kn" ? "ಕ್ಯೂ ಪರಿಶೀಲಿಸಿ" : "Refresh Queue"}</span>
              </button>
            </div>

            <div className="grid gap-3 pt-3.5 sm:grid-cols-3">
              {/* Specialist & Department */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Stethoscope size={13} className="text-teal-600" />
                  {currentEncounter.doctor_assignment_pending
                    ? (lang === "kn" ? "ವೈದ್ಯರ ಆಯ್ಕೆ ಅಗತ್ಯ" : "Doctor choice needed")
                    : (lang === "kn" ? "ನಿಯೋಜಿತ ತಜ್ಞ ವೈದ್ಯರು" : "Assigned Specialist")}
                </div>
                <div className="text-sm font-bold text-slate-900 mt-1">
                  {currentEncounter.doctor_assignment_pending
                    ? (lang === "kn" ? "ಹಿಂದಿನ ವೈದ್ಯರು ಲಭ್ಯವಿಲ್ಲ" : "Previous doctor is unavailable")
                    : currentEncounter.doctor_name || "Specialist Doctor"}
                </div>
                <div className="text-xs font-semibold text-teal-700">
                  {currentEncounter.doctor_assignment_pending
                    ? (lang === "kn" ? "ನಿಮ್ಮ ಸರದಿ ಉಳಿಸಲಾಗಿದೆ" : "Your queue place is saved")
                    : currentEncounter.doctor_specialty || currentEncounter.department_name || "Specialty Clinic"}
                </div>
              </div>

              {/* Waiting in Front */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Users size={13} className="text-teal-600" />
                  {lang === "kn" ? "ಮುಂದಿರುವ ರೋಗಿಗಳು" : "Patients Waiting Ahead"}
                </div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  {currentEncounter.waiting_ahead === 0
                    ? (lang === "kn" ? "ಮುಂದಿನ ಸರದಿ ನಿಮ್ಮದೇ! (೦ ಮುಂದೆ)" : "You are next in line! (0 ahead)")
                    : `${currentEncounter.waiting_ahead} ${lang === "kn" ? "ರೋಗಿಗಳು ನಿಮ್ಮ ಮುಂದಿದ್ದಾರೆ" : "patient(s) ahead of you"}`}
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  {lang === "kn" ? `ಕ್ಯೂ ಸ್ಥಾನ: #${currentEncounter.queue_position || 1}` : `Queue Position: #${currentEncounter.queue_position || 1}`}
                </div>
              </div>

              {/* Estimated Wait */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1">
                  <Clock size={13} className="text-teal-600" />
                  {lang === "kn" ? "ಅಂದಾಜು ಕಾಯುವ ಸಮಯ" : "Estimated Wait Time"}
                </div>
                <div className="text-sm font-extrabold text-slate-900 mt-1">
                  ~{currentEncounter.estimated_wait_mins ?? (currentEncounter.waiting_ahead * 10 || 10)} mins
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Priority: {currentEncounter.priority || "ROUTINE"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-emerald-800 font-medium pt-2 border-t border-emerald-100">
              <span>
                <b>Reason:</b> {currentEncounter.chief_complaint || "OPD Consultation"}
              </span>
              <span className="text-[11px] text-slate-500">
                Please watch the OPD display screen for your token call.
              </span>
            </div>
          </div>
        )
      )}

      {isEncounterActive && currentEncounter.doctor_assignment_pending && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm" aria-live="polite">
          <h2 className="font-bold text-amber-950">{lang === "kn" ? "ನಿಮ್ಮ ವೈದ್ಯರು ಈಗ ಲಭ್ಯವಿಲ್ಲ" : "Your assigned doctor is unavailable"}</h2>
          <p className="mt-1 text-sm text-amber-900">{lang === "kn" ? "ನಿಮ್ಮ ಟೋಕನ್ ಮತ್ತು ಸರದಿಯ ಸ್ಥಾನ ಉಳಿದಿವೆ. ಕೆಳಗಿನ ಲಭ್ಯ ವೈದ್ಯರಲ್ಲಿ ಒಬ್ಬರನ್ನು ಆಯ್ಕೆಮಾಡಿ." : "Your token and place in the queue are saved. Choose another available doctor below."}</p>
          <p className="mt-1 text-xs text-amber-800">{lang === "kn" ? "ಹೊಸ ಮಾಹಿತಿ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ." : "This page checks for updates automatically."}</p>
          {loadingAlternatives ? <Loading text={lang === "kn" ? "ವೈದ್ಯರ ಲಭ್ಯತೆ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…" : "Checking available doctors…"} /> : alternativeDoctors.length ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {alternativeDoctors.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white p-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{d.name}</div>
                    <div className="text-xs text-slate-600">{d.specialty || "Specialist"} · {d.active_queue} patient(s) waiting</div>
                  </div>
                  <button type="button" className="btn shrink-0 bg-teal-700 px-3 py-1.5 text-xs text-white" disabled={!!reassigningDoctor} onClick={() => chooseReplacementDoctor(d.id)}>
                    {reassigningDoctor === d.id ? (lang === "kn" ? "ಆಯ್ಕೆಮಾಡುತ್ತಿದೆ…" : "Choosing…") : (lang === "kn" ? "ಆಯ್ಕೆ" : "Choose")}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-amber-900">{lang === "kn" ? "ಈ ಆಸ್ಪತ್ರೆಯಲ್ಲಿ ಪರ್ಯಾಯ ವೈದ್ಯರು ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಆಸ್ಪತ್ರೆಯ ಸಹಾಯಮೇಜನ್ನು ಸಂಪರ್ಕಿಸಿ." : "No other doctors are available at this hospital. Please contact the hospital desk."}</p>}
        </section>
      )}

      {/* Voice Assistant Promo / Quick Banner (shown if not currently waiting) */}
      {!isEncounterActive && (
        <div className="rounded-xl border border-teal-200 bg-gradient-to-r from-teal-50/80 via-emerald-50/50 to-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow">
                <Sparkles size={20} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  {lang === "kn" ? "ಧ್ವನಿ ಸಂಭಾಷಣಾ ಒಪಿಡಿ ನೋಂದಣಿ" : "Conversational Voice OPD Check-In"}
                </h2>
                <p className="text-xs text-slate-600">
                  {lang === "kn"
                    ? "ನಮ್ಮ ಧ್ವನಿ ಸಹಾಯಕ ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ಕೇಳಿ ಸೂಕ್ತ ತಜ್ಞ ವೈದ್ಯರಿಗೆ ಟೋಕನ್ ನೀಡುತ್ತದೆ."
                    : "Spoken interactive intake: our assistant asks how you feel and prepares your specialist token."}
                </p>
              </div>
            </div>
            <button
              onClick={() => setVoiceModalOpen(true)}
              className="btn bg-brand-600 text-xs py-2 shadow-sm hover:bg-brand-700"
            >
              {lang === "kn" ? "ಧ್ವನಿ ನೋಂದಣಿ ಪ್ರಾರಂಭಿಸಿ" : "Start Spoken Intake"} <Mic size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Medical History Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Allergies items={p.allergies} title={t("patient.allergies")} lang={lang} />
        <Diagnoses items={p.diagnoses} title={t("patient.diagnoses")} />
        <Prescriptions items={p.prescriptions} title={t("patient.prescriptions")} lang={lang} />
        <Notes items={p.notes} title={t("patient.notes")} />
      </div>

      {/* Manual Booking Alternative */}
      <Section title={lang === "kn" ? "ಹಸ್ತಚಾಲಿತ ಒಪಿಡಿ ಬುಕಿಂಗ್ (ಫಾರ್ಮ್)" : "Manual OPD Booking (Text Form)"}>
        <form onSubmit={book} className="grid gap-3 md:grid-cols-4">
          <select className="input" value={hospital} onChange={(e) => setHospital(e.target.value)}>
            <option value="">
              {lang === "kn" ? "🤖 ಎಐ ಸ್ವಯಂಚಾಲಿತ ನಿಯೋಜನೆ (ಶಿಫಾರಸು)" : "🤖 AI Auto-Assign Hospital & Doctor (Recommended)"}
            </option>
            {hosp.data?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name} ({h.city || "Karnataka"})
              </option>
            ))}
          </select>
          <input
            className="input md:col-span-2"
            placeholder={lang === "kn" ? "ಭೇಟಿಗೆ ಕಾರಣ (ಉದಾ: ಕಿವಿ ನೋವು, ನಿಯಮಿತ ತಪಾಸಣೆ)" : "Reason for visit (e.g. Ear pain, regular checkup)"}
            value={cc}
            onChange={(e) => setCc(e.target.value)}
          />
          <button className="btn justify-center">{t("patient.book")}</button>
        </form>
      </Section>

      {/* Voice OPD Assistant Modal */}
      <VoiceOpdModal
        isOpen={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        patientId={pid!}
        hospitals={hosp.data || []}
        lang={lang}
        onOpenEmergency={() => setEmergencyModalOpen(true)}
        onSuccess={(enc) => {
          setRecentBooking(enc);
          activeEnc.reload();
          toast(lang === "kn" ? "ಧ್ವನಿ ಮೂಲಕ ಒಪಿಡಿ ಯಶಸ್ವಿಯಾಗಿ ಬುಕ್ ಆಗಿದೆ!" : "Visit booked successfully via voice!");
        }}
      />

      {/* Emergency Casualty Bypass Modal */}
      <EmergencyBypassModal
        isOpen={emergencyModalOpen}
        onClose={() => setEmergencyModalOpen(false)}
        patientId={pid!}
        lang={lang === "kn" ? "kn" : "en"}
        onSuccess={(enc) => {
          setRecentBooking(enc);
          activeEnc.reload();
          toast(lang === "kn" ? "🚨 ತುರ್ತು ಬೈಪಾಸ್ ಸಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ! ನೇರವಾಗಿ ಕ್ಯಾಶುಯಲ್ಟಿಗೆ ತೆರಳಿ." : "🚨 Emergency Bypass Activated! Report directly to ER Casualty.");
        }}
      />

      <p className="text-xs text-slate-400">{t("voice.disclaimer")}</p>
    </div>
  );
}

export function PatientTimeline() {
  const pid = useMyPatientId(); const tl = useFetch<any[]>(pid ? `/patients/${pid}/timeline` : null); const { t } = useI18n();
  const waiting = !pid || tl.loading;
  return <Section title={t("nav.timeline")}>{waiting ? <Loading text={t("common.loading")} /> : tl.error ? <ErrorBox msg={tl.error} retry={tl.reload} /> : !tl.data?.length ? <Empty text="No records available." /> : <TimelineList events={tl.data} />}</Section>;
}

export function PatientDocuments() {
  const { t } = useI18n();
  const toast = useToast();
  const pid = useMyPatientId();
  const docs = useFetch<any[]>(pid ? `/patients/${pid}/documents` : null);
  const [type, setType] = useState("LAB_REPORT");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  const upload = async (file?: File) => {
    if (!file || !pid) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("patient_id", pid);
    fd.append("doc_type", type);
    try {
      const r = await api.post("/documents", fd);
      setOpen(r.data);
      toast("Medical document uploaded and scanned with OCR!");
      docs.reload();
    } catch (x) {
      toast(errMsg(x), true);
    } finally {
      setBusy(false);
    }
  };

  const view = async (id: string) => {
    try {
      setOpen((await api.get(`/documents/${id}`)).data);
    } catch (x) {
      toast(errMsg(x), true);
    }
  };

  const rerunOcr = async (id: string) => {
    setBusy(true);
    try {
      const r = await api.post(`/documents/${id}/ocr`);
      setOpen(r.data);
      toast("OCR re-processed successfully!");
      docs.reload();
    } catch (x) {
      toast(errMsg(x), true);
    } finally {
      setBusy(false);
    }
  };

  const copyText = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <Section title={t("docs.upload")}>
        <div className="flex flex-wrap gap-2">
          <select className="input !w-auto" value={type} onChange={(e) => setType(e.target.value)}>
            {["LAB_REPORT", "PRESCRIPTION", "DISCHARGE_SUMMARY", "OTHER"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0])}
            aria-label="Choose file"
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          PDF/PNG/JPG, max 10 MB. Scanned reports and photos are automatically processed using OCR.
        </p>
      </Section>

      <Section title={t("nav.documents")}>
        {docs.loading ? (
          <Loading />
        ) : !docs.data?.length ? (
          <Empty text={t("common.empty")} />
        ) : (
          <ul className="divide-y">
            {docs.data.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5 text-sm">
                <FileText size={16} className="text-teal-600 shrink-0" />
                <span className="flex-1 font-medium text-slate-900">{d.filename}</span>
                <Badge>{d.doc_type}</Badge>
                <Badge tone={d.ocr_status === "DONE" ? "green" : "amber"}>
                  OCR {d.ocr_status ?? "—"}
                </Badge>
                <Badge tone={d.review_status === "PENDING_REVIEW" ? "purple" : "green"}>
                  {d.review_status ?? "PENDING"}
                </Badge>
                <span className="text-xs text-slate-400">{fmt(d.at)}</span>
                <button className="btn-ghost text-xs font-semibold" onClick={() => view(d.id)}>
                  View
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {open && (
        <Section title={open.filename}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="text-slate-500">Document Type:</span>
                <Badge>{open.doc_type}</Badge>
                {open.ocr && (
                  <Badge tone={open.ocr.status === "DONE" ? "green" : "amber"}>
                    OCR {open.ocr.status}
                  </Badge>
                )}
                {open.ocr?.confidence && (
                  <span className="text-xs text-slate-400 font-medium">
                    Confidence: {open.ocr.confidence}%
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => rerunOcr(open.id)}
                  disabled={busy}
                  className="btn-ghost text-xs flex items-center gap-1.5"
                  title="Re-run OCR extraction on this document"
                >
                  <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
                  <span>Rerun OCR</span>
                </button>
                {open.ocr?.text && (
                  <button
                    type="button"
                    onClick={() => copyText(open.ocr.text)}
                    className="btn-ghost text-xs flex items-center gap-1"
                  >
                    {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copied ? "Copied" : "Copy Text"}</span>
                  </button>
                )}
              </div>
            </div>

            {open.ocr ? (
              <div className="space-y-2">
                <AlertNote
                  text={
                    open.ocr.status === "DONE"
                      ? t("docs.ocrNotice")
                      : t("docs.ocrUnavailable")
                  }
                />
                {open.ocr.text ? (
                  <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-relaxed text-slate-800 shadow-inner">
                    {open.ocr.text}
                  </pre>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
                    No text extracted yet. Click "Rerun OCR" above to process this file.
                  </div>
                )}
              </div>
            ) : (
              <Empty text="No OCR result recorded." />
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

const SCOPES = ["ALLERGIES", "DIAGNOSES", "PRESCRIPTIONS", "LAB_RESULTS", "NOTES", "DOCUMENTS"];
export function PatientConsent() {
  const { t } = useI18n(); const toast = useToast(); const cons = useFetch<any[]>("/consents"); const hosp = useFetch<any[]>("/hospitals"); const logs = useFetch<any[]>("/audit-logs");
  const [hospital, setHospital] = useState(""); const [scope, setScope] = useState<string[]>(["ALLERGIES", "DIAGNOSES"]);
  const hname = (id: string) => hosp.data?.find((h) => h.id === id)?.name ?? id;
  const grant = async (e: FormEvent) => { e.preventDefault();
    try { let c = cons.data?.find((x) => x.status === "ACTIVE")?.id; if (!c) c = (await api.post("/consents", {})).data.id;
      await api.post("/sharing/permissions", { consent_id: c, hospital_id: hospital, scope }); toast("Access granted"); cons.reload(); logs.reload(); } catch (x) { toast(errMsg(x), true); } };
  const revoke = async (id: string) => { try { await api.delete(`/sharing/permissions/${id}`); toast("Access revoked"); cons.reload(); logs.reload(); } catch (x) { toast(errMsg(x), true); } };
  return <div className="space-y-4">
    <Section title={t("consent.title")}><form onSubmit={grant} className="space-y-3">
      <select className="input" required value={hospital} onChange={(e) => setHospital(e.target.value)}><option value="">{t("consent.hospital")}…</option>{hosp.data?.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</select>
      <fieldset><legend className="label">{t("consent.scope")}</legend><div className="flex flex-wrap gap-3">{SCOPES.map((s) => <label key={s} className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={scope.includes(s)} onChange={(e) => setScope(e.target.checked ? [...scope, s] : scope.filter((x) => x !== s))} />{s}</label>)}</div></fieldset>
      <button className="btn" disabled={!scope.length}>{t("consent.grant")}</button></form></Section>
    <Section title="Current permissions">{cons.loading ? <Loading /> : (() => { const perms = cons.data?.flatMap((c) => c.permissions) ?? []; return !perms.length ? <Empty text="You have not shared your record with any hospital." /> :
      <ul className="divide-y">{perms.map((m) => <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><b className="flex-1">{hname(m.hospital_id)}</b>
        {m.scope.map((s: string) => <Badge key={s}>{s}</Badge>)}{m.is_active ? <button className="btn-ghost" onClick={() => revoke(m.id)}>{t("consent.revoke")}</button> : <Badge tone="red">REVOKED</Badge>}</li>)}</ul>; })()}</Section>
    <Section title="Who accessed my record">{!logs.data?.length ? <Empty text={t("common.empty")} /> : <ul className="space-y-1 text-xs text-slate-600">{logs.data.slice(0, 15).map((l, i) => <li key={i}>{new Date(l.at).toLocaleString()} — {l.action}</li>)}</ul>}</Section></div>;
}

export function PatientPrescriptions() {
  const { t, lang } = useI18n(); const pid = useMyPatientId(); const rec = useFetch(pid ? `/patients/${pid}` : null);
  if (!pid || rec.loading) return <Loading text={t("common.loading")} />; if (rec.error) return <ErrorBox msg={rec.error} retry={rec.reload} />;
  return <Prescriptions items={rec.data?.prescriptions} title={t("patient.prescriptions")} lang={lang} />;
}

export function PatientFollowUps() {
  const { t } = useI18n(); const pid = useMyPatientId(); const fu = useFetch<any[]>(pid ? `/patients/${pid}/follow-ups` : null);
  return <Section title="Follow-ups">{!pid || fu.loading ? <Loading text={t("common.loading")} /> : fu.error ? <ErrorBox msg={fu.error} retry={fu.reload} /> : !fu.data?.length ? <Empty text="No records available." /> :
    <ul className="divide-y">{fu.data.map((f) => <li key={f.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><b>{fmt(f.due_date)}</b><span className="flex-1 text-slate-600">{f.reason ?? "Follow-up visit"}</span><Badge tone={f.status === "SCHEDULED" ? "blue" : "green"}>{f.status}</Badge></li>)}</ul>}</Section>;
}
