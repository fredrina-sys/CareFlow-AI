export type Role = "ADMIN" | "DOCTOR" | "TRIAGE" | "PATIENT";
export interface User { id: string; email: string; full_name: string; role: Role; hospital_id: string | null }
