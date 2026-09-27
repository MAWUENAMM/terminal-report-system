export type Role =
  "ADMIN" | "HEADTEACHER" | "CLASS_TEACHER" | "SUBJECT_TEACHER";
export type Level = "KG" | "PRIMARY" | "JHS";
export const roleNames: Record<Role, string> = {
  ADMIN: "Administrator",
  HEADTEACHER: "Headmaster",
  CLASS_TEACHER: "Class teacher",
  SUBJECT_TEACHER: "Subject teacher",
};
export interface Profile {
  id: string;
  auth_user_id: string;
  school_id: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
  must_change_password: boolean;
  phone?: string;
}
export interface School {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  headteacher_name?: string;
  district?: string;
  region?: string;
  academic_year: string;
  current_term: number;
  sba_weight: number;
  exam_weight: number;
}
export interface SchoolClass {
  id: string;
  school_id: string;
  name: string;
  level: Level;
  academic_year: string;
  class_teacher_id: string | null;
}
export interface Subject {
  id: string;
  school_id: string;
  name: string;
  code?: string;
  level: Level | "ALL";
  is_core: boolean;
  display_order: number;
  active: boolean;
}
export interface Assignment {
  id: string;
  school_id: string;
  class_id: string;
  subject_id: string;
  teacher_id: string | null;
}
export interface Student {
  id: string;
  school_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  other_names?: string;
  gender: "M" | "F";
  class_id: string;
  date_of_birth?: string | null;
  guardian_name?: string;
  guardian_phone?: string;
  photo_url?: string;
  status: "ACTIVE" | "TRANSFERRED" | "WITHDRAWN";
}
export interface Score {
  id: string;
  school_id: string;
  student_id: string;
  subject_id: string;
  class_id: string;
  term: number;
  academic_year: string;
  sba_raw: number;
  exam_raw: number;
  sba_scaled: number;
  exam_scaled: number;
  total: number;
  grade: string;
  subject_remark?: string;
}
export interface Attendance {
  id: string;
  school_id: string;
  student_id: string;
  term: number;
  academic_year: string;
  days_present: number;
  total_days: number;
}
export interface Affective {
  id: string;
  school_id: string;
  student_id: string;
  term: number;
  academic_year: string;
  conduct?: string;
  interest?: string;
  attitude?: string;
  talents?: string;
}
export interface Remark {
  id: string;
  school_id: string;
  student_id: string;
  term: number;
  academic_year: string;
  class_teacher_remark?: string;
  headteacher_remark?: string;
}
export interface Term {
  id: string;
  school_id: string;
  academic_year: string;
  term: number;
  status: "OPEN" | "CLOSED";
  closed_at: string | null;
}
export interface ReportSnapshot {
  school: School;
  student: Student;
  class: SchoolClass;
  subjects: Subject[];
  scores: Score[];
  attendance: Attendance | null;
  affective: Affective | null;
  remarks: Remark | null;
  class_scores: Score[];
  class_students: Pick<Student, "id">[];
}
export interface Archive {
  id: string;
  school_id: string;
  student_id: string;
  class_id: string;
  academic_year: string;
  term: number;
  created_at: string;
  snapshot: Pick<ReportSnapshot, "student">;
}
export interface Workspace {
  profile: Profile;
  school: School;
  staff: Profile[];
  classes: SchoolClass[];
  subjects: Subject[];
  assignments: Assignment[];
  students: Student[];
  scores: Score[];
  attendance: Attendance[];
  affective: Affective[];
  remarks: Remark[];
  terms: Term[];
  archives: Archive[];
  operator: boolean;
}
export const isLeader = (role: Role) =>
  role === "ADMIN" || role === "HEADTEACHER";
export const fullName = (s: Student) =>
  [s.first_name, s.other_names, s.last_name].filter(Boolean).join(" ");
