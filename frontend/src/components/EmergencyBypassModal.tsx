import { useState } from "react";
import { AlertTriangle, PhoneCall, ShieldAlert, CheckCircle2, ArrowRight, X, Clock, Stethoscope, Building2 } from "lucide-react";
import { api, errMsg } from "../services/api";
import { useFetch } from "../hooks/useFetch";
import { useAuth } from "../context/Auth";

interface EmergencyBypassModalProps {
  patientId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (encounter: any) => void;
  lang?: "en" | "kn";
}

const RED_FLAGS = [
  { en: "Severe chest pain, tightness, or pressure radiating to arm/jaw", kn: "ತೀವ್ರ ಎದೆ ನೋವು ಅಥವಾ ಎಡಗೈಗೆ ಹರಡುವ ಒತ್ತಡ" },
  { en: "Severe difficulty breathing, gasping, or blue lips", kn: "ಉಸಿರಾಟದ ತೀವ್ರ ತೊಂದರೆ ಅಥವಾ ಉಸಿರುಗಟ್ಟುವಿಕೆ" },
  { en: "Unconsciousness, sudden collapse, or non-responsiveness", kn: "ಪ್ರಜ್ಞೆ ತಪ್ಪುವುದು ಅಥವಾ ಇದ್ದಕ್ಕಿದ್ದಂತೆ ಕುಸಿದು ಬೀಳುವುದು" },
  { en: "Sudden facial droop, arm weakness, or slurred speech (Stroke)", kn: "ಮುಖ ಸೊಟ್ಟಾಗುವುದು, ಕೈ ಕಾಲು ಸ್ವಾಧೀನ ತಪ್ಪುವುದು (ಪಾರ್ಶ್ವವಾಯು)" },
  { en: "Uncontrolled heavy bleeding or major trauma/accident", kn: "ತೀವ್ರ ರಕ್ತಸ್ರಾವ ಅಥವಾ ಭೀಕರ ಅಪಘಾತ" },
  { en: "Sudden severe seizure or continuous convulsions", kn: "ಫಿಟ್ಸ್ ಅಥವಾ ನಿರಂತರ ಸೆಳೆತ" },
];

export function EmergencyBypassModal({
  patientId: initialPatientId,
  isOpen,
  onClose,
  onSuccess,
  lang = "en"
}: EmergencyBypassModalProps) {
  const { user } = useAuth();
  const allPatients = useFetch<any[]>(isOpen && !initialPatientId && user ? "/patients" : null);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const effectivePatientId = initialPatientId || (user?.role === "PATIENT" ? allPatients.data?.[0]?.id : selectedPatientId);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [bookedEmergency, setBookedEmergency] = useState<any | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [selectedFlag, setSelectedFlag] = useState<string>(RED_FLAGS[0].en);

  if (!isOpen) return null;

  const handleActivateBypass = async () => {
    if (!user || !effectivePatientId) {
      setError("No active patient record found. Please select or log in as a patient.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const complaintText = `🚨 EMERGENCY BYPASS: ${customReason || selectedFlag}`;
      const res = await api.post("/encounters", {
        patient_id: effectivePatientId,
        chief_complaint: complaintText,
        symptoms: `Emergency Bypass protocol activated. Selected red flag: ${selectedFlag}. Patient requires immediate ER bed admission.`,
        priority: "EMERGENCY"
      });
      setBookedEmergency(res.data);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err: any) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/60 p-4 backdrop-blur-md animate-fadeIn">
      <div className="card w-full max-w-lg overflow-hidden !p-0 shadow-2xl border-2 border-red-500 bg-white">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-red-200 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-4 text-white">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-white shadow-inner animate-pulse">
              <ShieldAlert size={22} />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-wide">
                {lang === "kn" ? "🚨 ತುರ್ತು ಚಿಕಿತ್ಸಾ ಬೈಪಾಸ್" : "🚨 EMERGENCY CASUALTY BYPASS"}
              </h2>
              <p className="text-xs text-red-100 font-medium">
                {lang === "kn" ? "ನೇರ ತುರ್ತು ದಾಖಲಾತಿ — ಒಪಿಡಿ ಕ್ಯೂ ಇಲ್ಲ" : "Direct ER Triage — Zero Routine Waiting"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {!bookedEmergency ? (
          <div className="p-6 space-y-4">
            {/* Critical Alert Warning */}
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 shadow-xs">
              <div className="flex items-center gap-2 font-black uppercase tracking-wider text-red-700 mb-1">
                <AlertTriangle size={16} className="animate-bounce" />
                {lang === "kn" ? "ಗಂಭೀರ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯ ಎಚ್ಚರಿಕೆ" : "Life-Threatening Emergency Notice"}
              </div>
              <p className="font-semibold leading-relaxed">
                {lang === "kn"
                  ? "ಇದು ಸ್ಥಳೀಯ ಡೆಮೊ ಮಾತ್ರ; ಆಸ್ಪತ್ರೆಗೆ ಅಥವಾ ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗೆ ಸಂದೇಶ ಕಳುಹಿಸುವುದಿಲ್ಲ. ನಿಜವಾದ ತುರ್ತು ಪರಿಸ್ಥಿತಿಯಲ್ಲಿ 112 ಅಥವಾ 108 ಗೆ ಕರೆ ಮಾಡಿ."
                  : "Demo only: this records an emergency-priority visit in CareFlow. It does not contact a hospital or ambulance. For a real emergency in India, call 112 or 108."}
              </p>
            </div>

            {!user ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                Sign in to use the demo workflow. For real emergency help, call <a className="font-bold underline" href="tel:112">112</a> or <a className="font-bold underline" href="tel:108">108</a>.
              </div>
            ) : user.role !== "PATIENT" && !initialPatientId ? (
              <div>
                <label className="label" htmlFor="emergency-patient">Select the patient</label>
                <select id="emergency-patient" className="input" value={selectedPatientId} onChange={(e) => setSelectedPatientId(e.target.value)}>
                  <option value="">Choose a patient…</option>
                  {(allPatients.data || []).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
                {allPatients.loading && <p className="mt-1 text-xs text-slate-500">Loading patients…</p>}
                {allPatients.error && <p className="mt-1 text-xs text-red-700">{allPatients.error}</p>}
              </div>
            ) : null}

            {user && <>
            {/* Red Flag Selector */}
            <div>
              <label className="label text-slate-700 font-bold">
                {lang === "kn" ? "ತುರ್ತು ಸಮಸ್ಯೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:" : "Select Emergency Condition:"}
              </label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {RED_FLAGS.map((flag, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedFlag(flag.en)}
                    className={`cursor-pointer rounded-xl border p-3 text-xs font-semibold transition-all ${
                      selectedFlag === flag.en
                        ? "border-red-600 bg-red-50/80 text-red-950 ring-2 ring-red-200"
                        : "border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="font-bold">{lang === "kn" ? flag.kn : flag.en}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {lang === "kn" ? flag.en : flag.kn}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Notes */}
            <div>
              <label className="label text-slate-700 font-bold">
                {lang === "kn" ? "ಹೆಚ್ಚುವರಿ ವಿವರಣೆ (ಐಚ್ಛಿಕ):" : "Additional Symptoms / Patient State:"}
              </label>
              <input
                className="input"
                placeholder={lang === "kn" ? "ಉದಾ: ಕಳೆದ 15 ನಿಮಿಷಗಳಿಂದ ತೀವ್ರ ಎದೆನೋವು" : "e.g. Severe chest pain started 20 mins ago"}
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
              />
            </div>
            </>}

            {/* 108 Emergency Hotline Banner */}
            <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-semibold">
                <PhoneCall size={16} className="text-amber-700 animate-pulse" />
                <span>{lang === "kn" ? "ಭಾರತದ ತುರ್ತು ಸಹಾಯವಾಣಿ:" : "Emergency services in India:"}</span>
              </div>
              <a
                href="tel:112"
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-black px-3 py-1 text-xs shadow-xs"
              >
                CALL 112
              </a>
            </div>

            {error && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
                {error}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-ghost text-xs font-bold"
              >
                {lang === "kn" ? "ರದ್ದುಮಾಡಿ" : "Cancel"}
              </button>
              <button
                type="button"
                disabled={submitting || !user || !effectivePatientId}
                onClick={handleActivateBypass}
                className="btn bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-extrabold text-xs px-5 py-2.5 shadow-md flex items-center gap-1.5"
              >
                {submitting ? (
                  <span>{lang === "kn" ? "ದಾಖಲಿಸುತ್ತಿದೆ..." : "Activating ER Bypass..."}</span>
                ) : (
                  <>
                    <ShieldAlert size={16} />
                    <span>{lang === "kn" ? "ತುರ್ತು ಬೈಪಾಸ್ ದೃಢೀಕರಿಸಿ" : "Confirm Emergency Bypass"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* CONFIRMED EMERGENCY BYPASS PASS */
          <div className="p-6 space-y-4 animate-fadeIn">
            <div className="rounded-2xl border-2 border-red-500 bg-gradient-to-br from-red-50 via-rose-50/50 to-white p-5 text-center shadow-md">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg animate-pulse">
                <ShieldAlert size={32} />
              </div>
              <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black uppercase tracking-wider text-white shadow-xs">
                {lang === "kn" ? "🚨 ಡೆಮೊ ತುರ್ತು ಪಾಸ್" : "🚨 DEMO EMERGENCY PASS"}
              </span>
              <h3 className="text-xl font-black text-red-950 mt-3">
                {lang === "kn" ? "ನೇರವಾಗಿ ಕ್ಯಾಶುಯಲ್ಟಿ ವಿಭಾಗಕ್ಕೆ ತೆರಳಿ" : "REPORT DIRECTLY TO RESUSCITATION BAY"}
              </h3>
              <p className="text-xs text-red-800 font-semibold mt-1">
                {lang === "kn"
                  ? "ಡೆಮೊ ಕ್ಯೂ ದಾಖಲೆ ಸೃಷ್ಟಿಸಲಾಗಿದೆ. ಆಸ್ಪತ್ರೆ ಅಥವಾ ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗೆ ಮಾಹಿತಿ ಕಳುಹಿಸಿಲ್ಲ."
                  : "Demo queue entry created. The hospital and ambulance service have not been notified."}
              </p>

              {/* Emergency Token Badge */}
              <div className="my-4 inline-flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-400 bg-white px-8 py-3.5 shadow-sm">
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-red-600">
                  TOKEN NUMBER
                </span>
                <span className="text-3xl font-black text-red-700 tracking-wider my-0.5">
                  {bookedEmergency.token_number || "EMERGENCY-BYPASS-01"}
                </span>
                <span className="rounded-full bg-red-100 px-3 py-0.5 text-xs font-black text-red-800">
                  Priority: CRITICAL EMERGENCY (0 Wait)
                </span>
              </div>

              {/* Facility & Doctor Details */}
              <div className="grid grid-cols-2 gap-2.5 text-left pt-2">
                <div className="rounded-xl border border-red-200 bg-white p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <Building2 size={12} className="text-red-600" /> Facility
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">
                    {bookedEmergency.hospital_name || "Emergency Trauma Center"}
                  </div>
                  <div className="text-[11px] text-red-700 font-semibold">
                    {bookedEmergency.hospital_city || "Mangaluru"} · 24x7 ER
                  </div>
                </div>

                <div className="rounded-xl border border-red-200 bg-white p-3 shadow-xs">
                  <div className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1">
                    <Stethoscope size={12} className="text-red-600" /> Assigned Specialist
                  </div>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">
                    {bookedEmergency.doctor_name || "Emergency Physician"}
                  </div>
                  <div className="text-[11px] text-teal-700 font-semibold">
                    {bookedEmergency.doctor_specialty || "Emergency & Critical Care"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn bg-red-700 hover:bg-red-800 text-white text-xs font-bold px-6 py-2.5 shadow-md flex items-center gap-1.5"
              >
                <span>{lang === "kn" ? "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ಟೋಕನ್ ನೋಡಿ" : "View Live ER Pass on Dashboard"}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
