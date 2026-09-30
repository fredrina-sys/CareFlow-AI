import { useState, useEffect, useMemo } from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Building2,
  UserCheck,
  Clock,
  Ticket,
  Stethoscope,
  VolumeX,
  ShieldAlert,
  PhoneCall
} from "lucide-react";
import { useVoice, speak, stopSpeaking, hasKannadaVoice } from "../hooks/useVoice";
import { api, errMsg } from "../services/api";

interface VoiceOpdModalProps {
  patientId: string;
  hospitals: Array<{ id: string; name: string; city?: string }>;
  lang: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (encounter: any) => void;
  onOpenEmergency?: () => void;
}

type CategoryKey = "ENT" | "ORTHO" | "CHEST" | "GI" | "FEVER" | "GENERAL";

interface SymptomCategoryConfig {
  deptEn: string;
  deptKn: string;
  specialistEn: string;
  specialistKn: string;
  q3En: string;
  q3Kn: string;
  q3SpokenFallback: string;
  suggestionsEn: string[];
  suggestionsKn: string[];
}

const CATEGORY_CONFIGS: Record<CategoryKey, SymptomCategoryConfig> = {
  ENT: {
    deptEn: "ENT (Ear, Nose, Throat)",
    deptKn: "ಇಎನ್‍ಟಿ (ಕಿವಿ, ಮೂಗು, ಗಂಟಲು)",
    specialistEn: "Dr. Rajesh Shenoy (ENT Specialist)",
    specialistKn: "ಡಾ. ರಾಜೇಶ್ ಶೆಣೈ (ಕಿವಿ-ಮೂಗು-ಗಂಟಲು ತಜ್ಞರು)",
    q3En: "Is there any ear discharge, hearing loss, ringing, or difficulty swallowing?",
    q3Kn: "ಕಿವಿಯಲ್ಲಿ ಕೀವು, ಶ್ರವಣ ದೋಷ, ಕಿವಿ ಗುಯ್ಗುಡುವುದು ಅಥವಾ ನುಂಗಲು ಕಷ್ಟವಿದೆಯೇ?",
    q3SpokenFallback: "Is there any ear discharge, hearing loss, or difficulty swallowing?",
    suggestionsEn: [
      "Pain in one ear with mild discharge",
      "Reduced hearing with feeling of ear fullness",
      "Severe sharp earache when chewing",
      "Throat irritation, no ear discharge"
    ],
    suggestionsKn: [
      "ಒಂದು ಕಿವಿಯಲ್ಲಿ ನೋವು ಮತ್ತು ಕೀವು",
      "ಕಿವಿ ಕಿವುಡುತನ ಮತ್ತು ಶಬ್ದ ಬರುವುದು",
      "ಅಗಿಯುವಾಗ ವಿಪರೀತ ಕಿವಿ ನೋವು",
      "ಗಂಟಲು ಕೆರೆತ, ಕಿವಿಯಲ್ಲಿ ಕೀವು ಇಲ್ಲ"
    ]
  },
  ORTHO: {
    deptEn: "Orthopaedics",
    deptKn: "ಮೂಳೆ ಮತ್ತು ಕೀಲು ರೋಗ ವಿಭಾಗ",
    specialistEn: "Dr. Arjun Shetty (Orthopaedic Specialist)",
    specialistKn: "ಡಾ. ಅರ್ಜುನ್ ಶೆಟ್ಟಿ (ಮೂಳೆ ತಜ್ಞರು)",
    q3En: "Did you have an accidental fall or injury, and are you able to bear weight or walk?",
    q3Kn: "ಬಿದ್ದು ಗಾಯವಾಗಿದೆಯೇ, ಮತ್ತು ಕಾಲು ಊರಿ ನಡೆಯಲು ಸಾಧ್ಯವಾಗುತ್ತಿದೆಯೇ?",
    q3SpokenFallback: "Did you have an accidental fall, and are you able to walk?",
    suggestionsEn: [
      "Severe pain after a fall, unable to walk",
      "Swelling in knee joint with stiffness",
      "Lower back ache radiating down the leg",
      "Chronic joint pain without fall"
    ],
    suggestionsKn: [
      "ಬಿದ್ದ ನಂತರ ವಿಪರೀತ ನೋವು, ನಡೆಯಲಾಗುತ್ತಿಲ್ಲ",
      "ಮೊಣಕಾಲು ಊತ ಮತ್ತು ಬಿಗಿತ",
      "ಸೊಂಟ ನೋವು ಕಾಲಿಗೆ ಇಳಿಯುವುದು",
      "ಬಿದ್ದಿಲ್ಲ, ದೀರ್ಘಕಾಲದ ಕೀಲು ನೋವು"
    ]
  },
  CHEST: {
    deptEn: "General Medicine / Emergency",
    deptKn: "ಸಾಮಾನ್ಯ ಔಷಧ / ತುರ್ತು ಚಿಕಿತ್ಸೆ",
    specialistEn: "Dr. Meera Rao (Senior Physician)",
    specialistKn: "ಡಾ. ಮೀರಾ ರಾವ್ (ಹಿರಿಯ ವೈದ್ಯರು)",
    q3En: "Does the pain radiate to your left arm or jaw, and are you sweating or breathless?",
    q3Kn: "ಎದೆ ನೋವು ತೋಳಿಗೆ ಹರಡುತ್ತಿದೆಯೇ, ಮತ್ತು ಬೆವರು ಅಥವಾ ಉಸಿರಾಟದ ತೊಂದರೆ ಇದೆಯೇ?",
    q3SpokenFallback: "Does the pain spread to your arm or jaw, with cold sweats?",
    suggestionsEn: [
      "Severe chest tightness radiating to arm & sweating",
      "Mild chest discomfort during walking/climbing",
      "Sudden breathlessness while resting",
      "No radiation or sweating"
    ],
    suggestionsKn: [
      "ಎಡತೋಳಿಗೆ ಹರಡುವ ಎದೆನೋವು ಮತ್ತು ಬೆವರು",
      "ನಡೆಯುವಾಗ ಎದೆ ಭಾರವಾಗುವುದು",
      "ವಿಶ್ರಾಂತಿಯಲ್ಲೂ ಉಸಿರಾಟದ ತೊಂದರೆ",
      "ಯಾವುದೇ ಬೆವರು ಅಥವಾ ಹರಡುವ ನೋವಿಲ್ಲ"
    ]
  },
  GI: {
    deptEn: "General Medicine",
    deptKn: "ಸಾಮಾನ್ಯ ಔಷಧ ವಿಭಾಗ",
    specialistEn: "Dr. Meera Rao (General Physician)",
    specialistKn: "ಡಾ. ಮೀರಾ ರಾವ್ (ಸಾಮಾನ್ಯ ವೈದ್ಯರು)",
    q3En: "Do you have severe vomiting, fever, loose stools, or burning pain after eating?",
    q3Kn: "ತೀವ್ರ ವಾಂತಿ, ಜ್ವರ, ಭೇದಿ ಅಥವಾ ಊಟದ ನಂತರ ಹೊಟ್ಟೆ ಉರಿತ ಇದೆಯೇ?",
    q3SpokenFallback: "Do you have severe vomiting, fever, or pain after eating?",
    suggestionsEn: [
      "Severe cramping pain with vomiting and acidity",
      "Burning upper abdominal pain after spicy food",
      "Mild stomach discomfort, no vomiting",
      "Loose motion and weakness"
    ],
    suggestionsKn: [
      "ಹೊಟ್ಟೆ ಸೆಳೆತ, ವಾಂತಿ ಮತ್ತು ಹುಳಿತೇಗು",
      "ಊಟದ ನಂತರ ಹೊಟ್ಟೆ ಉರಿತ",
      "ಸ್ವಲ್ಪ ಅಸ್ವಸ್ಥತೆ, ವಾಂತಿ ಇಲ್ಲ",
      "ಭೇದಿ ಮತ್ತು ವಿಪರೀತ ನಿಶ್ಯಕ್ತಿ"
    ]
  },
  FEVER: {
    deptEn: "General Medicine",
    deptKn: "ಸಾಮಾನ್ಯ ಔಷಧ ವಿಭಾಗ",
    specialistEn: "Dr. Meera Rao (General Physician)",
    specialistKn: "ಡಾ. ಮೀರಾ ರಾವ್ (ಸಾಮಾನ್ಯ ವೈದ್ಯರು)",
    q3En: "Do you have high fever with shivering, persistent cough with phlegm, or throat pain?",
    q3Kn: "ಚಳಿ ಜ್ವರ, ನಿರಂತರ ಕೆಮ್ಮು, ಕಫ ಅಥವಾ ಗಂಟಲು ಕೆರೆತ ಇದೆಯೇ?",
    q3SpokenFallback: "Do you have high fever with shivering or cough with phlegm?",
    suggestionsEn: [
      "High fever with chills and throat irritation",
      "Persistent cough with thick phlegm",
      "Mild fever with body fatigue and headache",
      "Dry cough and running nose"
    ],
    suggestionsKn: [
      "ಚಳಿ ಜ್ವರ ಮತ್ತು ಗಂಟಲು ಕೆರೆತ",
      "ಕಫದೊಂದಿಗೆ ನಿರಂತರ ಕೆಮ್ಮು",
      "ಸಾಮಾನ್ಯ ಜ್ವರ ಮತ್ತು ಮೈಕೈ ನೋವು",
      "ಒಣ ಕೆಮ್ಮು ಮತ್ತು ನೆಗಡಿ"
    ]
  },
  GENERAL: {
    deptEn: "General Medicine",
    deptKn: "ಸಾಮಾನ್ಯ ಔಷಧ ವಿಭಾಗ",
    specialistEn: "Dr. Meera Rao (General Physician)",
    specialistKn: "ಡಾ. ಮೀರಾ ರಾವ್ (ಸಾಮಾನ್ಯ ವೈದ್ಯರು)",
    q3En: "Are you experiencing any warning symptoms like high fever, severe headache, or dizziness?",
    q3Kn: "ತೀವ್ರ ಜ್ವರ, ವಿಪರೀತ ತಲೆನೋವು ಅಥವಾ ತಲೆಸುತ್ತಿನಂತಹ ಲಕ್ಷಣಗಳಿವೆಯೇ?",
    q3SpokenFallback: "Are you experiencing high fever, severe headache, or dizziness?",
    suggestionsEn: [
      "Mild symptoms, no severe pain or dizziness",
      "Severe headache and feeling dizzy",
      "Body ache and general weakness",
      "Routine follow-up / general consultation"
    ],
    suggestionsKn: [
      "ಸಾಮಾನ್ಯ ಲಕ್ಷಣಗಳು, ಯಾವುದೇ ತೀವ್ರ ತಲೆಸುತ್ತು ಇಲ್ಲ",
      "ವಿಪರೀತ ತಲೆನೋವು ಮತ್ತು ತಲೆಸುತ್ತು",
      "ಮೈಕೈ ನೋವು ಮತ್ತು ಸಾಮಾನ್ಯ ಸುಸ್ತು",
      "ನಿಯಮಿತ ತಪಾಸಣೆ / ಸಾಮಾನ್ಯ ಭೇಟಿ"
    ]
  }
};

function detectCategory(complaint: string): CategoryKey {
  const c = complaint.toLowerCase();
  if (/ear|throat|hearing|tinnitus|sinus|nose|swallow|voice|ಕಿವಿ|ಗಂಟಲು|ಮೂಗು/.test(c)) return "ENT";
  if (/bone|joint|knee|back|ankle|fracture|fall|sprain|leg|hip|spine|ಮೂಳೆ|ಕೀಲು|ಮೊಣಕಾಲು|ಸೊಂಟ|ಕಾಲು/.test(c)) return "ORTHO";
  if (/chest|heart|breath|palpitation|sweat|arm pain|pressure|ಎದೆ|ಉಸಿರಾಟ|ಗುಂಡಿಗೆ/.test(c)) return "CHEST";
  if (/stomach|abdomen|vomit|acid|gas|loose motion|diarrhea|belly|cramp|ಹೊಟ್ಟೆ|ವಾಂತಿ|ಭೇದಿ/.test(c)) return "GI";
  if (/fever|cough|cold|chills|shiver|phlegm|flu|ಜ್ವರ|ಕೆಮ್ಮು|ಶೀತ|ಕಫ/.test(c)) return "FEVER";
  return "GENERAL";
}

const SYMPTOM_SUGGESTIONS: Record<string, string[]> = {
  en: [
    "Ear Pain & Discharge",
    "Severe Throat Pain",
    "Fever & Body Ache",
    "Knee / Joint Pain after Fall",
    "Stomach Pain & Acidity",
    "Chest Tightness & Discomfort"
  ],
  kn: [
    "ಕಿವಿ ನೋವು ಮತ್ತು ಕೀವಿ",
    "ತೀವ್ರ ಗಂಟಲು ನೋವು",
    "ಜ್ವರ ಮತ್ತು ಮೈಕೈ ನೋವು",
    "ಬಿದ್ದ ನಂತರ ಮೊಣಕಾಲು / ಕೀಲು ನೋವು",
    "ಹೊಟ್ಟೆ ನೋವು ಮತ್ತು ಗ್ಯಾಸ್ಟ್ರಿಕ್",
    "ಎದೆ ಭಾರ ಮತ್ತು ಉಸಿರಾಟದ ತೊಂದರೆ"
  ]
};

const DURATION_SUGGESTIONS: Record<string, string[]> = {
  en: ["Started today", "2 to 3 days", "About 1 week", "More than 2 weeks"],
  kn: ["ಇಂದೇ ಪ್ರಾರಂಭವಾಯಿತು", "೨ ರಿಂದ ೩ ದಿನಗಳು", "ಸುಮಾರು ೧ ವಾರ", "೨ ವಾರಗಳಿಗಿಂತ ಹೆಚ್ಚು"]
};

const BASE_PROMPTS: Record<string, Record<number, string>> = {
  en: {
    1: "Hello! What health concern or symptoms bring you to the OPD today?",
    2: "I have noted that. How many days have you been experiencing this problem?",
    4: "Which hospital would you like to visit for your consultation?",
    5: "I have prepared your OPD visit request. Please review the details and confirm."
  },
  kn: {
    1: "ನಮಸ್ಕಾರ! ಇಂದು ನೀವು ಯಾವ ಆರೋಗ್ಯ ಸಮಸ್ಯೆಯಿಂದ ಒಪಿಡಿಗೆ ಬಂದಿದ್ದೀರಿ?",
    2: "ತಿಳಿಯಿತು. ಈ ಸಮಸ್ಯೆ ನಿಮಗೆ ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ?",
    4: "ನೀವು ಯಾವ ಆಸ್ಪತ್ರೆಗೆ ಭೇಟಿ ನೀಡಲು ಬಯಸುತ್ತೀರಿ?",
    5: "ವಿಶೇಷ ತಜ್ಞರೊಂದಿಗೆ ನಿಮ್ಮ ಒಪಿಡಿ ಭೇಟಿಯ ವಿವರಗಳನ್ನು ಸಿದ್ಧಪಡಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಪರಿಶೀಲಿಸಿ ದೃಢೀಕರಿಸಿ."
  }
};

const SPOKEN_FALLBACKS: Record<number, string> = {
  1: "Namaskara! What health symptoms bring you to the hospital OPD today?",
  2: "How many days have you been having this problem?",
  4: "Which hospital would you like to visit for your consultation?",
  5: "Please review and confirm your OPD specialist booking."
};

const UI_TEXT: Record<string, Record<string, string>> = {
  en: {
    title: "Conversational Voice OPD Intake",
    step: "Step",
    of: "of",
    repeat: "Repeat Aloud",
    listening: "Listening... Speak clearly into microphone",
    tapToSpeak: "Tap to speak your answer",
    orSelect: "Or choose a quick suggestion:",
    chiefLabel: "Your chief symptom (editable):",
    durationLabel: "Duration (editable):",
    notesLabel: "Follow-up answers / notes:",
    hospitalLabel: "Select Hospital:",
    summaryTitle: "Summary of your OPD Request",
    chiefComplaint: "Chief Complaint:",
    duration: "Duration:",
    otherSymptoms: "Follow-up Details:",
    hospital: "Hospital:",
    assignedDept: "Assigned Specialty:",
    assignedDoctor: "Assigned Specialist:",
    priority: "Priority:",
    standardQueue: "Standard Queue",
    urgentQueue: "Urgent Assessment",
    back: "Back",
    continue: "Continue",
    confirm: "Confirm & Book OPD Visit",
    booking: "Booking OPD & Generating Token...",
    successMsg: "Your OPD visit is confirmed! Your token number is generated.",
    errSymptom: "Please describe or select your main symptom.",
    errDuration: "Please specify how long you have had this.",
    bookingComplete: "OPD Token Confirmed!",
    tokenLabel: "Your OPD Token",
    queueAhead: "Patients ahead in queue:",
    estWait: "Estimated wait time:",
    viewInDash: "View in Dashboard",
    doctorAssigned: "Doctor Assigned:",
    deptAssigned: "Specialty Department:"
  },
  kn: {
    title: "ಧ್ವನಿ ಸಂಭಾಷಣಾ ಒಪಿಡಿ ನೋಂದಣಿ",
    step: "ಹಂತ",
    of: "ರ",
    repeat: "ಮತ್ತೆ ಕೇಳಿ",
    listening: "ಆಲಿಸುತ್ತಿದೆ... ಮೈಕ್ರೊಫೋನ್‌ಗೆ ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ",
    tapToSpeak: "ಉತ್ತರಿಸಲು ಮೈಕ್ ಒತ್ತಿ",
    orSelect: "ಅಥವಾ ಆಯ್ಕೆಮಾಡಿ:",
    chiefLabel: "ನಿಮ್ಮ ಪ್ರಮುಖ ಲಕ್ಷಣ (ಬದಲಾಯಿಸಬಹುದು):",
    durationLabel: "ಸಮಸ್ಯೆಯ ಅವಧಿ (ಬದಲಾಯಿಸಬಹುದು):",
    notesLabel: "ಹೆಚ್ಚುವರಿ ವಿವರಗಳು / ಟಿಪ್ಪಣಿ:",
    hospitalLabel: "ಆಸ್ಪತ್ರೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ:",
    summaryTitle: "ನಿಮ್ಮ ಒಪಿಡಿ ಭೇಟಿಯ ಸಾರಾಂಶ",
    chiefComplaint: "ಪ್ರಮುಖ ಲಕ್ಷಣ:",
    duration: "ಅವಧಿ:",
    otherSymptoms: "ವಿವರಗಳು:",
    hospital: "ಆಸ್ಪತ್ರೆ:",
    assignedDept: "ನಿಯೋಜಿತ ವಿಭಾಗ:",
    assignedDoctor: "ನಿಯೋಜಿತ ತಜ್ಞ ವೈದ್ಯರು:",
    priority: "ಆದ್ಯತೆ:",
    standardQueue: "ಸಾಮಾನ್ಯ ಕ್ಯೂ",
    urgentQueue: "ತುರ್ತು ತಪಾಸಣೆ",
    back: "ಹಿಂದಕ್ಕೆ",
    continue: "ಮುಂದುವರಿಯಿರಿ",
    confirm: "ಖಚಿತಪಡಿಸಿ ಟೋಕನ್ ಪಡೆಯಿರಿ",
    booking: "ಒಪಿಡಿ ಬುಕ್ ಮಾಡಿ ಟೋಕನ್ ಸಿದ್ಧಪಡಿಸಲಾಗುತ್ತಿದೆ...",
    successMsg: "ನಿಮ್ಮ ಒಪಿಡಿ ಭೇಟಿ ಯಶಸ್ವಿಯಾಗಿದೆ! ನಿಮ್ಮ ಟೋಕನ್ ಸಂಖ್ಯೆ ಸಿದ್ಧವಾಗಿದೆ.",
    errSymptom: "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಮುಖ್ಯ ಲಕ್ಷಣವನ್ನು ತಿಳಿಸಿ ಅಥವಾ ಆಯ್ಕೆಮಾಡಿ.",
    errDuration: "ದಯವಿಟ್ಟು ಇದು ಎಷ್ಟು ದಿನಗಳಿಂದ ಇದೆ ಎಂದು ತಿಳಿಸಿ.",
    bookingComplete: "ಒಪಿಡಿ ಟೋಕನ್ ನೀಡಲಾಗಿದೆ!",
    tokenLabel: "ನಿಮ್ಮ ಒಪಿಡಿ ಟೋಕನ್",
    queueAhead: "ಕ್ಯೂನಲ್ಲಿ ನಿಮ್ಮ ಮುಂದಿರುವ ರೋಗಿಗಳು:",
    estWait: "ಅಂದಾಜು ಕಾಯುವ ಸಮಯ:",
    viewInDash: "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್‌ನಲ್ಲಿ ನೋಡಿ",
    doctorAssigned: "ನಿಯೋಜಿತ ತಜ್ಞ ವೈದ್ಯರು:",
    deptAssigned: "ವಿಭಾಗ:"
  }
};

export function VoiceOpdModal({
  patientId,
  hospitals,
  lang: initialLang,
  isOpen,
  onClose,
  onSuccess,
  onOpenEmergency
}: VoiceOpdModalProps) {
  const [modalLang, setModalLang] = useState<"en" | "kn">(initialLang === "kn" ? "kn" : "en");
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [complaint, setComplaint] = useState("");
  const [duration, setDuration] = useState("");
  const [severityNotes, setSeverityNotes] = useState("");
  const [hospitalId, setHospitalId] = useState<string>("AUTO");
  const [hospitalPreview, setHospitalPreview] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [autoSpoken, setAutoSpoken] = useState<Record<number, boolean>>({});
  const [bookedEncounter, setBookedEncounter] = useState<any | null>(null);

  useEffect(() => {
    setModalLang(initialLang === "kn" ? "kn" : "en");
  }, [initialLang]);

  const activeLang = modalLang;
  const t = UI_TEXT[activeLang] || UI_TEXT.en;

  useEffect(() => {
    if (!isOpen || step !== 4) return;
    let cancelled = false;
    setPreviewLoading(true);
    api.post("/triage/recommend", {
      chief_complaint: complaint,
      symptoms: `Duration: ${duration}. ${severityNotes}`,
      preferred_hospital_id: hospitalId === "AUTO" ? null : hospitalId
    }).then(({ data }) => {
      if (!cancelled) setHospitalPreview(data);
    }).catch(() => {
      if (!cancelled) setHospitalPreview(null);
    }).finally(() => {
      if (!cancelled) setPreviewLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, step, hospitalId, complaint, duration, severityNotes]);

  // Dynamically detect category based on current complaint
  const category = useMemo(() => detectCategory(complaint), [complaint]);
  const catConfig = CATEGORY_CONFIGS[category];

  // Dynamic Prompt Text for current step
  const getPromptText = (s: number): string => {
    if (s === 3) {
      return activeLang === "kn" ? catConfig.q3Kn : catConfig.q3En;
    }
    return (BASE_PROMPTS[activeLang] && BASE_PROMPTS[activeLang][s]) || BASE_PROMPTS.en[s] || "";
  };

  // Fallback spoken audio text (especially when browser lacks native Kannada voice)
  const getSpokenFallback = (s: number): string => {
    if (s === 3) {
      return catConfig.q3SpokenFallback;
    }
    return SPOKEN_FALLBACKS[s] || BASE_PROMPTS.en[s] || "";
  };

  // Voice recognition listener with live interim speech-to-text
  const voice = useVoice(
    activeLang,
    (finalText) => {
      if (step === 1) setComplaint(finalText);
      else if (step === 2) setDuration(finalText);
      else if (step === 3) setSeverityNotes(finalText);
    },
    (interimText) => {
      if (step === 1) setComplaint(interimText);
      else if (step === 2) setDuration(interimText);
      else if (step === 3) setSeverityNotes(interimText);
    }
  );

  // Play question aloud once when step or language changes
  useEffect(() => {
    if (!isOpen || bookedEncounter) {
      stopSpeaking();
      voice.cancel();
      return;
    }
    if (!autoSpoken[step]) {
      const qText = getPromptText(step);
      const fallback = getSpokenFallback(step);
      speak(qText, activeLang, undefined, fallback);
      setAutoSpoken((prev) => ({ ...prev, [step]: true }));
    }
  }, [step, isOpen, activeLang, bookedEncounter, category]);

  const handleClose = () => {
    stopSpeaking();
    voice.cancel();
    setStep(1);
    setComplaint("");
    setDuration("");
    setSeverityNotes("");
    setError("");
    setAutoSpoken({});
    setBookedEncounter(null);
    onClose();
  };

  if (!isOpen) return null;

  const handleReplayVoice = () => {
    const qText = getPromptText(step);
    const fallback = getSpokenFallback(step);
    speak(qText, activeLang, undefined, fallback);
  };

  const handleToggleLang = (newLang: "en" | "kn") => {
    stopSpeaking();
    voice.cancel();
    setModalLang(newLang);
    setAutoSpoken((prev) => ({ ...prev, [step]: false }));
  };

  const handleNext = () => {
    setError("");
    stopSpeaking();
    voice.cancel();
    if (step === 1 && !complaint.trim()) {
      setError(t.errSymptom);
      return;
    }
    if (step === 2 && !duration.trim()) {
      setError(t.errDuration);
      return;
    }
    if (step < 5) {
      setStep((s) => (s + 1) as any);
    }
  };

  const handleBack = () => {
    setError("");
    stopSpeaking();
    voice.cancel();
    if (step > 1) {
      setStep((s) => (s - 1) as any);
    }
  };

  const handleConfirmBooking = async () => {
    setSubmitting(true);
    setError("");
    try {
      const urgentWords = [
        "chest pain",
        "breath",
        "unbearable",
        "emergency",
        "faint",
        "chills",
        "sweating",
        "fracture",
        "ಎದೆ ನೋವು",
        "ಉಸಿರಾಟ",
        "ತೀವ್ರ",
        "ವಿಪರೀತ"
      ];
      const isUrgent = urgentWords.some((w) =>
        (complaint + " " + severityNotes).toLowerCase().includes(w)
      );

      const interviewQa = [
        {
          question: getPromptText(1),
          answer: complaint
        },
        {
          question: getPromptText(2),
          answer: duration
        },
        {
          question: getPromptText(3),
          answer: severityNotes || (activeLang === "kn" ? "ಯಾವುದೂ ಇಲ್ಲ" : "None reported")
        }
      ];

      const fullSymptoms = `Language: ${activeLang.toUpperCase()}. Duration: ${duration}. Follow-up: ${
        severityNotes || "No emergency red flags reported."
      }`;

      const payloadHospId = (!hospitalId || hospitalId === "AUTO") ? null : hospitalId;
      const res = await api.post("/encounters", {
        patient_id: patientId,
        hospital_id: payloadHospId,
        chief_complaint: complaint,
        symptoms: fullSymptoms,
        priority: isUrgent ? "URGENT" : "ROUTINE",
        interview_qa: interviewQa
      });

      const enc = res.data;
      setBookedEncounter(enc);

      // Announce booking aloud
      const tokenMsg =
        activeLang === "kn"
          ? `ನಿಮ್ಮ ಒಪಿಡಿ ಭೇಟಿ ಯಶಸ್ವಿಯಾಗಿದೆ. ಟೋಕನ್ ಸಂಖ್ಯೆ ${enc.token_number || ""}. ನಿಯೋಜಿತ ವೈದ್ಯರು ${
              enc.doctor_name || ""
            }.`
          : `Your OPD visit has been scheduled. Your token number is ${
              enc.token_number || ""
            }. Assigned specialist: ${enc.doctor_name || ""}.`;

      const tokenFallback = `Your OPD visit is confirmed. Your token number is ${
        enc.token_number || ""
      }. Assigned to specialist ${enc.doctor_name || ""}.`;

      speak(tokenMsg, activeLang, undefined, tokenFallback);
      onSuccess(enc);
    } catch (err: any) {
      setError(errMsg(err));
    } finally {
      setSubmitting(false);
    }
  };

  const selectedHospitalName =
    !hospitalId || hospitalId === "AUTO"
      ? (activeLang === "kn" ? "🤖 ಎಐ ಸ್ವಯಂಚಾಲಿತ ನಿಯೋಜನೆ (ಉನ್ನತ ಆಸ್ಪತ್ರೆ & ತಜ್ಞರು)" : "🤖 AI Auto-Assigned (Center of Excellence)")
      : (hospitals.find((h) => h.id === hospitalId)?.name || "Hospital");
  const symptomList = SYMPTOM_SUGGESTIONS[activeLang] || SYMPTOM_SUGGESTIONS.en;
  const durationList = DURATION_SUGGESTIONS[activeLang] || DURATION_SUGGESTIONS.en;
  const categoryFollowUpList =
    activeLang === "kn" ? catConfig.suggestionsKn : catConfig.suggestionsEn;

  const renderVoiceMic = () => {
    const isListening = voice.state === "listening";

    return (
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative flex items-center justify-center">
          {isListening && (
            <>
              <span className="absolute h-28 w-28 rounded-full bg-red-400/20 animate-ping" />
              <span className="absolute h-24 w-24 rounded-full bg-red-400/30 animate-pulse" />
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (isListening) {
                voice.stop();
              } else {
                stopSpeaking();
                voice.start();
              }
            }}
            className={`group relative flex h-20 w-20 items-center justify-center rounded-full transition-all shadow-md active:scale-95 ${
              isListening
                ? "bg-red-500 text-white ring-4 ring-red-200 shadow-red-200 animate-pulse"
                : "bg-gradient-to-tr from-teal-600 to-emerald-600 text-white hover:from-teal-700 hover:to-emerald-700 shadow-teal-200"
            }`}
            aria-label="Toggle voice input"
          >
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
        </div>

        {/* Live Audio Volume Visualizer & Transcript */}
        {isListening ? (
          <div className="mt-3 flex flex-col items-center gap-1.5 animate-fadeIn">
            {/* Visualizer bars */}
            <div className="flex items-center gap-1 h-6">
              {[0.4, 0.75, 1, 0.6, 0.9, 0.5, 0.8].map((factor, i) => (
                <span
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-100 ${
                    voice.isSpeakingSound
                      ? "bg-emerald-600 scale-y-110"
                      : "bg-teal-500"
                  }`}
                  style={{
                    height: `${Math.max(6, Math.min(24, Math.round((voice.audioLevel || 40) * factor * 0.28)))}px`,
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-emerald-800">
                {activeLang === "kn"
                  ? "ಆಲಿಸುತ್ತಿದೆ... ಮಾತನಾಡಿ"
                  : "Listening... Speak your answer now"}
              </span>
              {voice.isSpeakingSound && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 animate-pulse">
                  ● {activeLang === "kn" ? "ಧ್ವನಿ ಪತ್ತೆಯಾಗಿದೆ" : "Voice Detected"}
                </span>
              )}
            </div>

            {/* Language & quick toggle */}
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span>
                {activeLang === "kn" ? "ಭಾಷೆ: ಕನ್ನಡ" : "Language: English"}
              </span>
              <button
                type="button"
                onClick={() =>
                  voice.start(voice.currentLang === "kn-IN" ? "en-IN" : "kn-IN")
                }
                className="font-bold text-teal-700 hover:underline"
              >
                {voice.currentLang === "kn-IN"
                  ? "(Switch to English mic)"
                  : "(ಕನ್ನಡಕ್ಕೆ ಬದಲಿಸಿ)"}
              </button>
            </div>

            {voice.transcript && (
              <div className="max-w-md w-full rounded-xl bg-teal-50/80 px-3.5 py-1.5 text-xs font-semibold text-teal-950 border border-teal-200/80 shadow-xs flex items-center justify-between gap-2">
                <span className="truncate">"{voice.transcript}"</span>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-teal-600 bg-teal-100/60 px-1.5 py-0.5 rounded">
                  Live
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={voice.stop}
              className="mt-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs py-1 px-3.5 shadow-xs font-semibold transition-colors"
            >
              {activeLang === "kn" ? "✓ ಮಾತನಾಡಿ ಮುಗಿಸಿದೆ (Done)" : "✓ Done Speaking"}
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs font-semibold text-slate-500">
            {t.tapToSpeak}
          </p>
        )}

        {/* Microphone Notice / Browser Permission Alert */}
        {voice.error && (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 shadow-xs animate-fadeIn w-full">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">
                {activeLang === "kn" ? "ಮೈಕ್ರೊಫೋನ್ ಗಮನಿಸಿ: " : "Microphone Notice: "}
              </span>
              <span>{voice.error}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                voice.clear();
                stopSpeaking();
                voice.start();
              }}
              className="rounded-md bg-amber-200/80 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-300 transition-colors"
            >
              {activeLang === "kn" ? "ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ" : "Retry"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="card flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden !p-0 shadow-2xl border-slate-200 bg-white">
        {/* Header with Language Switcher */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-teal-50/80 via-emerald-50/60 to-white px-6 py-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white shadow">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t.title}</h2>
              <p className="text-xs text-slate-500 font-medium">
                {bookedEncounter ? (
                  <span className="text-emerald-700 font-bold">{t.bookingComplete}</span>
                ) : (
                  <>
                    {t.step} {step} {t.of} 5 ·{" "}
                    {activeLang === "kn" ? "ಕನ್ನಡ ಧ್ವನಿ ಸಹಾಯಕ" : "English Voice Assistant"}
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!bookedEncounter && (
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleToggleLang("en")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    activeLang === "en"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleLang("kn")}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    activeLang === "kn"
                      ? "bg-teal-600 text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  ಕನ್ನಡ
                </button>
              </div>
            )}

            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar (hidden if already booked) */}
        {!bookedEncounter && (
          <div className="h-1.5 w-full bg-slate-100">
            <div
              className="h-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        )}

        {/* BOOKING CONFIRMATION SCREEN */}
        {bookedEncounter ? (
          <div className="space-y-5 p-6 animate-fadeIn">
            <div className="rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white p-6 shadow-sm text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-lg font-extrabold text-emerald-950">
                {t.bookingComplete}
              </h3>
              <p className="text-xs text-emerald-800 font-medium mt-1">
                {activeLang === "kn"
                  ? "ನಿಮ್ಮ ಒಪಿಡಿ ಭೇಟಿ ಯಶಸ್ವಿಯಾಗಿ ಕಾಯ್ದಿರಿಸಲಾಗಿದೆ. ದಯವಿಟ್ಟು ಆಸ್ಪತ್ರೆಯ ಟ್ರಯೇಜ್ ಡೆಸ್ಕ್‌ಗೆ ತೆರಳಿ."
                  : "Your OPD visit is confirmed. Please report to the triage desk."}
              </p>

              {/* Prominent Token Display */}
              <div className="my-5 inline-flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400 bg-white px-8 py-4 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Ticket size={14} className="text-emerald-600" /> {t.tokenLabel}
                </span>
                <span className="text-3xl font-black text-emerald-700 tracking-wider my-1">
                  {bookedEncounter.token_number || "TK-OPD-01"}
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                  Status: {bookedEncounter.status || "WAITING"}
                </span>
              </div>

              {/* Specialist & Queue Details */}
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Stethoscope size={13} className="text-teal-600" /> {t.doctorAssigned}
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {bookedEncounter.doctor_name || catConfig.specialistEn}
                  </div>
                  <div className="text-xs text-teal-700 font-medium">
                    {bookedEncounter.doctor_specialty || catConfig.deptEn}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                  <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1">
                    <Clock size={13} className="text-teal-600" /> {t.queueAhead}
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-1">
                    {bookedEncounter.waiting_ahead === 0
                      ? "Next in Line (0 ahead)"
                      : `${bookedEncounter.waiting_ahead ?? 1} patient(s)`}
                  </div>
                  <div className="text-xs text-slate-500 font-medium">
                    {t.estWait} ~{bookedEncounter.estimated_wait_mins ?? 10} mins
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="btn text-xs font-bold shadow-md bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5"
              >
                {t.viewInDash} <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          /* STEPPING WIZARD (1 to 5) */
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-4 sm:p-6">
            {/* Emergency Bypass Quick Action Banner */}
            {onOpenEmergency && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2 text-xs text-red-900 shadow-xs">
                <div className="flex items-center gap-2">
                  <ShieldAlert size={16} className="text-red-600 shrink-0 animate-pulse" />
                  <span className="font-bold">
                    {activeLang === "kn"
                      ? "ತೀವ್ರ ಎದೆನೋವು, ಉಸಿರಾಟದ ತೊಂದರೆ ಅಥವಾ ಅಪಘಾತವಾಗಿದೆಯೇ?"
                      : "Severe chest pain, breathlessness, collapse, or major trauma?"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    voice.cancel();
                    onClose();
                    onOpenEmergency();
                  }}
                  className="shrink-0 rounded-lg bg-red-600 px-3 py-1 text-xs font-black text-white shadow-xs hover:bg-red-700 transition-colors"
                >
                  {activeLang === "kn" ? "🚨 ತುರ್ತು ಬೈಪಾಸ್" : "🚨 Emergency Bypass"}
                </button>
              </div>
            )}

            {/* Question Banner */}
            <div className="flex items-start justify-between gap-3 rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/80 to-emerald-50/50 p-4 shadow-sm">
              <div>
                <p className="text-sm font-bold text-teal-950 leading-relaxed">
                  {getPromptText(step)}
                </p>
                {step === 3 && (
                  <span className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-teal-100/80 px-2 py-0.5 text-[11px] font-semibold text-teal-900">
                    <Stethoscope size={12} />
                    {activeLang === "kn"
                      ? `ವಿಭಾಗ: ${catConfig.deptKn}`
                      : `Target Specialty: ${catConfig.deptEn}`}
                  </span>
                )}
              </div>
              <button
                onClick={handleReplayVoice}
                title="Repeat question aloud"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-teal-800 shadow-sm border border-teal-200 hover:bg-teal-50 transition-colors"
              >
                <Volume2 size={14} className="text-teal-600" />
                <span>{t.repeat}</span>
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">

            {/* Step 1: Chief Complaint */}
            {step === 1 && (
              <div className="space-y-4">
                {renderVoiceMic()}

                <div>
                  <label className="label">{t.orSelect}</label>
                  <div className="flex flex-wrap gap-2">
                    {symptomList.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setComplaint(s)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                          complaint === s
                            ? "border-teal-600 bg-teal-50 text-teal-800 font-semibold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">{t.chiefLabel}</label>
                  <input
                    className="input"
                    placeholder={
                      activeLang === "kn"
                        ? "ಉದಾಹರಣೆಗೆ: ಕಿವಿ ನೋವು ಮತ್ತು ಕೀವು, ಅಥವಾ ಜ್ವರ"
                        : "e.g. Ear pain and discharge, or Fever"
                    }
                    value={complaint}
                    onChange={(e) => setComplaint(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Duration */}
            {step === 2 && (
              <div className="space-y-4">
                {renderVoiceMic()}

                <div>
                  <label className="label">{t.orSelect}</label>
                  <div className="flex flex-wrap gap-2">
                    {durationList.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                          duration === d
                            ? "border-teal-600 bg-teal-50 text-teal-800 font-semibold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">{t.durationLabel}</label>
                  <input
                    className="input"
                    placeholder={activeLang === "kn" ? "ಉದಾಹರಣೆಗೆ: ೩ ದಿನಗಳು" : "e.g. 3 days"}
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Symptom-Specific Follow-Up */}
            {step === 3 && (
              <div className="space-y-4">
                {renderVoiceMic()}

                <div>
                  <label className="label">{t.orSelect}</label>
                  <div className="flex flex-wrap gap-2">
                    {categoryFollowUpList.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSeverityNotes(s)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                          severityNotes === s
                            ? "border-teal-600 bg-teal-50 text-teal-800 font-semibold shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="label">{t.notesLabel}</label>
                  <input
                    className="input"
                    placeholder={
                      activeLang === "kn"
                        ? "ಉದಾಹರಣೆಗೆ: ಕಿವಿಯಲ್ಲಿ ಕೀವು ಇದೆ ಅಥವಾ ಶ್ರವಣ ದೋಷವಿಲ್ಲ"
                        : "e.g. Pain in right ear with mild discharge, no fever"
                    }
                    value={severityNotes}
                    onChange={(e) => setSeverityNotes(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Step 4: Hospital Selection */}
            {step === 4 && (
              <div className="space-y-4">
                <label className="label">{t.hospitalLabel}</label>
                <div className="grid max-h-[min(44vh,22rem)] gap-2 overflow-y-auto pr-1">
                  {/* AI Intelligent Auto-Routing Card */}
                  <div
                    onClick={() => setHospitalId("AUTO")}
                    className={`flex cursor-pointer items-center justify-between rounded-2xl border-2 p-3 transition-all ${
                      hospitalId === "AUTO" || !hospitalId
                        ? "border-teal-600 bg-gradient-to-r from-teal-50 to-emerald-50 shadow-md ring-2 ring-teal-500/20"
                        : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-600 text-white shadow-sm">
                        <Sparkles size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900">
                            {activeLang === "kn" ? "🤖 ಎಐ ಸ್ವಯಂಚಾಲಿತ ನಿಯೋಜನೆ (ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ)" : "🤖 AI Intelligent Auto-Routing (Recommended)"}
                          </span>
                          <span className="rounded-full bg-teal-100 text-teal-800 text-[10px] font-black px-2 py-0.5">
                            {activeLang === "kn" ? "ಅತ್ಯುತ್ತಮ ಹೊಂದಾಣಿಕೆ" : "Optimal Match"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-medium mt-0.5">
                          {activeLang === "kn"
                            ? "ರೋಗಲಕ್ಷಣಗಳು ಮತ್ತು ಕನಿಷ್ಠ ಕಾಯುವ ಸರದಿಯ ಆಧಾರದ ಮೇಲೆ ಎಐ ಆಸ್ಪತ್ರೆ ಮತ್ತು ತಜ್ಞ ವೈದ್ಯರನ್ನು ಆಯ್ಕೆ ಮಾಡುತ್ತದೆ."
                            : "AI analyzes symptoms to assign the best center of excellence and least-loaded doctor."}
                        </div>
                      </div>
                    </div>
                    {(hospitalId === "AUTO" || !hospitalId) && <CheckCircle2 className="text-teal-600" size={24} />}
                  </div>

                  {hospitals.map((h) => (
                    <div
                      key={h.id}
                      onClick={() => setHospitalId(h.id)}
                      className={`flex cursor-pointer items-center justify-between rounded-2xl border p-3 transition-all ${
                        hospitalId === h.id
                          ? "border-teal-600 bg-teal-50/60 shadow-sm"
                          : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-800 shadow-sm">
                          <Building2 size={20} />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{h.name}</div>
                          <div className="text-xs text-slate-500 font-medium">
                            {h.city ||
                              (activeLang === "kn"
                                ? "ಮಲ್ಟಿಸ್ಪೆಷಾಲಿಟಿ ಆಸ್ಪತ್ರೆ"
                                : "Multispeciality Hospital")}
                          </div>
                        </div>
                      </div>
                      {hospitalId === h.id && <CheckCircle2 className="text-teal-600" size={22} />}
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-3 text-sm">
                  <div className="font-bold text-teal-950">{activeLang === "kn" ? "ಲಭ್ಯ ವೈದ್ಯರು" : "Doctor information"}</div>
                  {previewLoading ? <div className="mt-1 text-xs text-slate-600">{activeLang === "kn" ? "ವೈದ್ಯರ ಲಭ್ಯತೆ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ…" : "Checking doctor availability…"}</div> : hospitalPreview?.recommended_doctor ? (
                    <>
                      <div className="mt-1 font-semibold text-slate-900">{hospitalPreview.recommended_doctor.name}</div>
                      <div className="text-xs text-slate-700">{hospitalPreview.recommended_doctor.specialty} · {activeLang === "kn" ? "ನೋಂದಣಿ" : "Reg."} {hospitalPreview.recommended_doctor.registration_no}</div>
                      <div className="text-xs text-slate-600">{hospitalPreview.recommended_hospital?.name} · {activeLang === "kn" ? "ಸರದಿಯಲ್ಲಿರುವವರು" : "In queue"}: {hospitalPreview.recommended_doctor.active_queue} · ~{hospitalPreview.recommended_doctor.estimated_wait_mins} min</div>
                      {hospitalPreview.candidate_doctors?.length > 1 && (
                        <div className="mt-2 border-t border-teal-200 pt-2 text-xs text-slate-700">
                          {(activeLang === "kn" ? "ಇತರರು: " : "Other available doctors: ") + hospitalPreview.candidate_doctors.slice(1).map((d: any) => `${d.name} (${d.specialty || "Specialist"}, ${d.active_queue} waiting)`).join(" · ")}
                        </div>
                      )}
                    </>
                  ) : <div className="mt-1 text-xs text-slate-600">{activeLang === "kn" ? "ವೈದ್ಯರ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ." : "Doctor availability details are unavailable."}</div>}
                </div>
              </div>
            )}

            {/* Step 5: Review & Confirm */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 shadow-sm">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                    {t.summaryTitle}
                  </h3>
                  <dl className="grid grid-cols-3 gap-2.5 text-sm">
                    <dt className="text-slate-500 font-medium">{t.chiefComplaint}</dt>
                    <dd className="col-span-2 font-bold text-slate-900">{complaint}</dd>

                    <dt className="text-slate-500 font-medium">{t.duration}</dt>
                    <dd className="col-span-2 text-slate-800 font-medium">{duration}</dd>

                    <dt className="text-slate-500 font-medium">{t.otherSymptoms}</dt>
                    <dd className="col-span-2 text-slate-800">
                      {severityNotes ||
                        (activeLang === "kn" ? "ಯಾವುದೂ ನಮೂದಿಸಿಲ್ಲ" : "None reported")}
                    </dd>

                    <dt className="text-slate-500 font-medium">{t.assignedDept}</dt>
                    <dd className="col-span-2 font-semibold text-teal-800">
                      {activeLang === "kn" ? catConfig.deptKn : catConfig.deptEn}
                    </dd>

                    <dt className="text-slate-500 font-medium">{t.assignedDoctor}</dt>
                    <dd className="col-span-2 font-bold text-slate-900 flex items-center gap-1.5">
                      <Stethoscope size={15} className="text-teal-600" />
                      {(!hospitalId || hospitalId === "AUTO")
                        ? (activeLang === "kn" ? "🤖 ಎಐ ನಿಯೋಜಿತ ತಜ್ಞ ವೈದ್ಯರು (ಕನಿಷ್ಠ ಕಾಯುವ ಸರದಿ)" : "🤖 AI Auto-Assigned Specialist (Least Loaded)")
                        : (activeLang === "kn" ? catConfig.specialistKn : catConfig.specialistEn)}
                    </dd>

                    <dt className="text-slate-500 font-medium">{t.hospital}</dt>
                    <dd className="col-span-2 text-slate-800 font-medium">
                      {selectedHospitalName}
                    </dd>

                    <dt className="text-slate-500 font-medium">{t.priority}</dt>
                    <dd className="col-span-2">
                      <span className="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 border border-emerald-200">
                        {t.standardQueue}
                      </span>
                    </dd>
                  </dl>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  {activeLang === "kn"
                    ? "ದೃಢೀಕರಿಸಿದ ನಂತರ ನೇರವಾಗಿ ನಿಮ್ಮ ಒಪಿಡಿ ಟೋಕನ್ ಸೃಷ್ಟಿಯಾಗುತ್ತದೆ ಮತ್ತು ತಜ್ಞ ವೈದ್ಯರಿಗೆ ನಿಯೋಜಿಸಲಾಗುತ್ತದೆ."
                    : "Confirming will instantly issue your OPD token and assign you to the specialist doctor queue."}
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs font-semibold text-red-700">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            </div>

            {/* Action Footer */}
            <div className="flex shrink-0 items-center justify-between border-t border-slate-100 bg-white pt-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={submitting}
                  className="btn-ghost text-xs"
                >
                  <ArrowLeft size={16} /> {t.back}
                </button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <button type="button" onClick={handleNext} className="btn text-xs font-semibold">
                  {t.continue} <ArrowRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmBooking}
                  className="btn text-xs font-bold shadow-md bg-teal-600 hover:bg-teal-700 text-white"
                >
                  {submitting ? t.booking : t.confirm}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
