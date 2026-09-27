export type UserRole =
  "ADMIN" | "HEADTEACHER" | "CLASS_TEACHER" | "SUBJECT_TEACHER";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  classId?: string | null;
  subjectIds?: string[];
  createdAt: string;
}

export interface School {
  id: string;
  name: string;
  address?: string;
  logoUrl?: string;
  phone?: string;
  email?: string;
  headteacherName?: string;
  district?: string;
  region?: string;
  academicYear: string;
  currentTerm: 1 | 2 | 3;
  sbaWeight: number;
  examWeight: number;
  gradingScale: GradingScale;
}

export interface GradingScale {
  id: string;
  name: string;
  grades: GradeBoundary[];
}

export interface GradeBoundary {
  grade: string;
  minScore: number;
  maxScore: number;
  descriptor: string;
  color?: string;
}

export interface Class {
  id: string;
  name: string;
  level: "KG" | "PRIMARY" | "JHS";
  academicYear: string;
  classTeacherId?: string | null;
  studentCount?: number;
}

export interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  gender: "M" | "F";
  dateOfBirth?: string;
  photoUrl?: string;
  classId: string;
  guardianName?: string;
  guardianPhone?: string;
  status: "ACTIVE" | "TRANSFERRED" | "WITHDRAWN";
  createdAt: string;
}

export interface Subject {
  id: string;
  name: string;
  code?: string;
  level: "KG" | "PRIMARY" | "JHS" | "ALL";
  isCore: boolean;
  order: number;
}

export interface ClassSubject {
  id: string;
  classId: string;
  subjectId: string;
  teacherId?: string | null;
}

export interface AssessmentComponent {
  id: string;
  name: string;
  weight: number;
  maxScore: number;
  term: 1 | 2 | 3;
  classId: string;
  subjectId: string;
}

export interface Score {
  id: string;
  studentId: string;
  subjectId: string;
  classId: string;
  term: 1 | 2 | 3;
  academicYear: string;
  sbaRaw?: number;
  sbaScaled: number;
  examRaw?: number;
  examScaled: number;
  total: number;
  grade: string;
  position?: number;
  subjectRemark?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  term: 1 | 2 | 3;
  academicYear: string;
  daysPresent: number;
  totalDays: number;
}

export interface AffectiveRecord {
  id: string;
  studentId: string;
  term: 1 | 2 | 3;
  academicYear: string;
  conduct?: string;
  interest?: string;
  attitude?: string;
  talents?: string;
}

export interface Remarks {
  id: string;
  studentId: string;
  term: 1 | 2 | 3;
  academicYear: string;
  classTeacherRemark?: string;
  headteacherRemark?: string;
  classTeacherId?: string;
  headteacherId?: string;
}

export interface ReportCardData {
  student: Student;
  school: School;
  class: Class;
  scores: Score[];
  attendance?: Attendance;
  affective?: AffectiveRecord;
  remarks?: Remarks;
  overallAverage: number;
  overallGrade: string;
  overallPosition?: number;
  totalStudents: number;
  promotedTo?: string;
}
