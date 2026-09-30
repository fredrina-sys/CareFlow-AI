import { Navigate, Route, Routes } from "react-router-dom";
import { ReactElement } from "react";
import { homeFor, useAuth } from "./context/Auth";
import { Loading } from "./components/ui";
import Shell from "./layouts/Shell";
import Landing from "./pages/Landing";
import { Login, Register } from "./pages/AuthPages";
import { PatientDashboard, PatientTimeline, PatientDocuments, PatientConsent, PatientPrescriptions, PatientFollowUps } from "./pages/Patient";
import { DoctorDashboard, DoctorPatients, DoctorPatient, Consultation, PrescriptionPrint } from "./pages/Doctor";
import { TriageDashboard, AdminDashboard, Profile } from "./pages/Staff";

function Guard({ roles, children }: { roles?: string[]; children: ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
const Home = () => { const { user, loading } = useAuth(); if (loading) return <Loading />; return user ? <Navigate to={homeFor(user.role)} replace /> : <Landing />; };

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
      <Route path="/" element={<Home />} /><Route path="/dashboard" element={<Home />} />
      <Route element={<Guard><Shell /></Guard>}>
        <Route path="/patient/dashboard" element={<Guard roles={["PATIENT"]}><PatientDashboard /></Guard>} />
        <Route path="/patient/timeline" element={<Guard roles={["PATIENT"]}><PatientTimeline /></Guard>} />
        <Route path="/patient/documents" element={<Guard roles={["PATIENT"]}><PatientDocuments /></Guard>} />
        <Route path="/patient/prescriptions" element={<Guard roles={["PATIENT"]}><PatientPrescriptions /></Guard>} />
        <Route path="/patient/follow-ups" element={<Guard roles={["PATIENT"]}><PatientFollowUps /></Guard>} />
        <Route path="/patient/consent" element={<Guard roles={["PATIENT"]}><PatientConsent /></Guard>} />
        <Route path="/doctor/dashboard" element={<Guard roles={["DOCTOR"]}><DoctorDashboard /></Guard>} />
        <Route path="/doctor/patients" element={<Guard roles={["DOCTOR"]}><DoctorPatients /></Guard>} />
        <Route path="/doctor/patients/:id" element={<Guard roles={["DOCTOR"]}><DoctorPatient /></Guard>} />
        <Route path="/doctor/encounters/:id" element={<Guard roles={["DOCTOR"]}><Consultation /></Guard>} />
        <Route path="/doctor/consultation/:id" element={<Guard roles={["DOCTOR"]}><Consultation /></Guard>} />
        <Route path="/doctor/prescription/:id" element={<Guard roles={["DOCTOR", "PATIENT"]}><PrescriptionPrint /></Guard>} />
        <Route path="/triage/dashboard" element={<Guard roles={["TRIAGE"]}><TriageDashboard /></Guard>} />
        <Route path="/admin/dashboard" element={<Guard roles={["ADMIN"]}><AdminDashboard /></Guard>} />
        <Route path="/profile" element={<Profile />} /><Route path="/settings" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
