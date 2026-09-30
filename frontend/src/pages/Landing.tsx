import { useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BadgeCheck, ClipboardList, FileText, HeartPulse, Share2, ShieldCheck, Sparkles, Stethoscope, User, Mic, Zap, ShieldAlert, CheckCircle2 } from "lucide-react";
import { EmergencyBypassModal } from "../components/EmergencyBypassModal";

const Card = ({ icon: I, title, text, to, cta, tone = "teal" }: any) => {
  const tones: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700 border-teal-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  return (
    <div className="card flex flex-col hover:border-slate-300 hover:shadow-md transition-all">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border ${tones[tone] || tones.teal} shadow-sm`}>
        <I size={22} />
      </div>
      <h3 className="text-base font-bold text-slate-900">{title}</h3>
      <p className="mt-2 flex-1 text-sm text-slate-600 leading-relaxed">{text}</p>
      <Link to={to} className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800 hover:underline">
        {cta} <ArrowRight size={14} />
      </Link>
    </div>
  );
};

const Step = ({ n, title, text }: any) => (
  <li className="flex gap-4">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-sm font-bold text-white shadow-sm">
      {n}
    </span>
    <div>
      <div className="font-bold text-slate-900">{title}</div>
      <p className="mt-0.5 text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  </li>
);

export default function Landing() {
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 px-6 py-4 backdrop-blur shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 text-lg font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white shadow-md">
              <HeartPulse size={20} />
            </span>
            <span className="tracking-tight">CareFlow AI</span>
          </Link>
          <nav className="flex items-center gap-3">
            <button
              onClick={() => setEmergencyOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-3.5 py-2 text-xs font-black text-white shadow-sm hover:from-red-700 hover:to-rose-800 transition-all animate-pulse"
              title="Direct ER casualty admission without routine OPD wait"
            >
              <ShieldAlert size={15} />
              <span>🚨 Emergency ER Bypass</span>
            </button>
            <Link className="btn-ghost text-xs" to="/login">Doctor / Staff Log In</Link>
            <Link className="btn text-xs shadow-sm" to="/register">Create Patient Account</Link>
          </nav>
        </div>
      </header>

      {/* Hero Section with Light Healthcare Atmosphere */}
      <section className="relative overflow-hidden bg-gradient-to-b from-teal-50/60 via-emerald-50/20 to-white px-6 py-16 md:py-24 border-b border-slate-100">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-teal-200 bg-white/90 px-3.5 py-1 text-xs font-semibold text-teal-800 shadow-sm backdrop-blur">
            <Sparkles size={14} className="text-teal-600" />
            <span>Interactive Voice OPD &amp; Longitudinal Digital Health Records</span>
          </div>

          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-slate-900 md:text-6xl leading-tight">
            AI-Assisted Digital OPD &amp; <br />
            <span className="bg-gradient-to-r from-teal-700 via-emerald-700 to-teal-800 bg-clip-text text-transparent">
              Longitudinal Health Records
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-slate-600 md:text-lg leading-relaxed">
            One patient-owned medical record following you across hospitals. Features conversational voice intake in <b>Kannada &amp; English</b>, 1-click clinical workflows for doctors, and safe emergency break-glass data sharing.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setEmergencyOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 py-3 text-sm font-extrabold text-white shadow-md hover:from-red-700 hover:to-rose-800 transition-all animate-pulse"
            >
              <ShieldAlert size={18} />
              <span>🚨 Emergency Bypass (Direct ER)</span>
            </button>
            <Link className="btn px-6 py-3 text-sm font-bold shadow-md" to="/register">
              <User size={16} /> I'm a Patient — Create Account
            </Link>
            <Link className="btn-ghost px-6 py-3 text-sm font-semibold" to="/login">
              <Stethoscope size={16} /> Doctor / Staff Sign In
            </Link>
          </div>

          {/* Value Props Pills */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <Mic size={14} className="text-teal-600" /> Kannada &amp; English Spoken Intake
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <Zap size={14} className="text-amber-600" /> 1-Click Prescription Bundles
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <ShieldAlert size={14} className="text-red-600" /> Emergency Break-Glass Override
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
              <CheckCircle2 size={14} className="text-emerald-600" /> 100% Doctor Verified
            </span>
          </div>
        </div>
      </section>

      {/* Role Cards Section */}
      <section className="bg-slate-50/60 py-16 border-b border-slate-100">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Tailored Workspaces for Every Role</h2>
            <p className="text-sm text-slate-500 mt-1">Designed for speed, clarity, and zero clinical friction.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card
              icon={User}
              tone="teal"
              title="Patients & Families"
              text="Speak your symptoms in Kannada or English to register for OPD. Access all your diagnoses, prescriptions, and upload past medical files with full privacy control."
              to="/register"
              cta="Open Patient Account"
            />
            <Card
              icon={Stethoscope}
              tone="emerald"
              title="Doctors & Specialists"
              text="Real-time OPD queue sorted by triage priority. Pre-filled voice intake summaries, 1-click preset prescription bundles, voice dictation, and AI drafts."
              to="/login"
              cta="Doctor Consultation Portal"
            />
            <Card
              icon={ClipboardList}
              tone="indigo"
              title="Triage & Hospital Admin"
              text="Triage nurses enter vital signs with instant red-flag alerts. Hospital administrators oversee staff credentials, department allocations, and audit break-glass overrides."
              to="/login"
              cta="Staff & Admin Portal"
            />
          </div>
        </div>
      </section>

      {/* Clinical Workflow Walkthrough */}
      <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 md:grid-cols-2 items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Seamless Care Journey</span>
          <h2 className="mt-2 mb-6 text-3xl font-extrabold text-slate-900 leading-snug">
            How a Visit Flows in CareFlow
          </h2>
          <ol className="space-y-6">
            <Step n="1" title="Conversational Spoken Check-in" text="Patient talks to the AI voice assistant in Kannada or English. The assistant captures chief complaints, duration, and urgency." />
            <Step n="2" title="Triage & Red-Flag Screening" text="Nursing staff records vitals (Temp, SpO₂, BP, Pulse). Low oxygen or severe allergies trigger automatic clinical red flags." />
            <Step n="3" title="Frictionless Consultation" text="Doctor reviews pre-filled intake dialogue, enters diagnoses with 1-click chips, issues preset prescription bundles, and dictates notes." />
            <Step n="4" title="Longitudinal Health Timeline" text="Consultations, prescriptions, and follow-ups are stamped onto the patient's lifelong health timeline." />
          </ol>
        </div>

        <div className="space-y-4">
          <div className="card flex gap-4 border-slate-200">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">AI is an Assistant, Not the Decider</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Every AI clinical summary is clearly stamped “requires doctor verification”. The treating physician always holds final clinical authority.
              </p>
            </div>
          </div>

          <div className="card flex gap-4 border-slate-200">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Intelligent Document OCR</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Patients can upload PDF lab reports or discharge summaries. Text is extracted for review, tagged as unverified until confirmed by a doctor.
              </p>
            </div>
          </div>

          <div className="card flex gap-4 border-slate-200">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Emergency Break-Glass Transfer</h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                In life-threatening trauma or emergency hospital transfers, doctors can verify an emergency override to access allergies and medications immediately.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50/50 py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold text-slate-700">
            <HeartPulse size={16} className="text-teal-600" /> CareFlow AI Digital OPD
          </div>
          <div>
            <BadgeCheck className="mr-1 inline text-teal-600" size={16} />
            Portfolio Demonstration System · All clinical data is synthetic · Not for real medical practice.
          </div>
          <div className="text-slate-400">
            PostgreSQL · FastAPI · React 18 · Tailwind CSS
          </div>
        </div>
      </footer>

      {/* Emergency Casualty Bypass Modal */}
      <EmergencyBypassModal
        isOpen={emergencyOpen}
        onClose={() => setEmergencyOpen(false)}
        lang="en"
      />
    </div>
  );
}
