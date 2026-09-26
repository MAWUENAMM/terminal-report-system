"use client";

import { 
  School, Student, Class, Subject, Score, Attendance, 
  AffectiveRecord, Remarks, User 
} from "@/types";
import { DEFAULT_GRADING_SCALE as grades } from "@/lib/grading";

// Simple localStorage-backed store for prototype
// In production this will be replaced by Supabase / Prisma

const KEYS = {
  school: "trs_school",
  users: "trs_users",
  classes: "trs_classes",
  students: "trs_students",
  subjects: "trs_subjects",
  scores: "trs_scores",
  attendance: "trs_attendance",
  affective: "trs_affective",
  remarks: "trs_remarks",
  currentUser: "trs_current_user",
};

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// Seed data for demo
export function seedDemoData() {
  const existing = load(KEYS.school, null);
  if (existing) return; // already seeded

  const school: School = {
    id: "sch-1",
    name: "Demo Basic School",
    address: "P.O. Box 123, Accra",
    phone: "+233 24 000 0000",
    email: "info@demobasic.edu.gh",
    headteacherName: "Mrs. Ama Mensah",
    district: "Accra Metro",
    region: "Greater Accra",
    academicYear: "2025/2026",
    currentTerm: 1,
    sbaWeight: 50,
    examWeight: 50,
    gradingScale: { id: "gs-1", name: "Standard", grades },
  };

  const users: User[] = [
    { id: "u-admin", email: "admin@school.edu.gh", name: "System Admin", role: "ADMIN", createdAt: new Date().toISOString() },
    { id: "u-head", email: "head@school.edu.gh", name: "Mrs. Ama Mensah", role: "HEADTEACHER", createdAt: new Date().toISOString() },
    { id: "u-ct", email: "teacher@school.edu.gh", name: "Mr. Kwame Asante", role: "CLASS_TEACHER", classId: "c-1", createdAt: new Date().toISOString() },
  ];

  const classes: Class[] = [
    { id: "c-1", name: "Basic 4", level: "PRIMARY", academicYear: "2025/2026", classTeacherId: "u-ct" },
    { id: "c-2", name: "JHS 2", level: "JHS", academicYear: "2025/2026" },
  ];

  const subjects: Subject[] = [
    { id: "sub-eng", name: "English Language", code: "ENG", level: "ALL", isCore: true, order: 1 },
    { id: "sub-math", name: "Mathematics", code: "MATH", level: "ALL", isCore: true, order: 2 },
    { id: "sub-sci", name: "Science", code: "SCI", level: "ALL", isCore: true, order: 3 },
    { id: "sub-rme", name: "R.M.E", code: "RME", level: "ALL", isCore: false, order: 4 },
    { id: "sub-ict", name: "ICT / Computing", code: "ICT", level: "ALL", isCore: false, order: 5 },
    { id: "sub-owop", name: "Our World Our People", code: "OWOP", level: "PRIMARY", isCore: false, order: 6 },
    { id: "sub-gh", name: "Ghanaian Language", code: "GHL", level: "ALL", isCore: false, order: 7 },
    { id: "sub-ca", name: "Creative Arts", code: "CA", level: "PRIMARY", isCore: false, order: 8 },
    { id: "sub-hist", name: "History", code: "HIST", level: "PRIMARY", isCore: false, order: 9 },
    { id: "sub-ss", name: "Social Studies", code: "SS", level: "JHS", isCore: true, order: 10 },
  ];

  const students: Student[] = [
    { id: "st-1", admissionNumber: "BS/2024/001", firstName: "Abena", lastName: "Osei", gender: "F", classId: "c-1", status: "ACTIVE", createdAt: new Date().toISOString(), guardianName: "Kofi Osei", guardianPhone: "0244111222" },
    { id: "st-2", admissionNumber: "BS/2024/002", firstName: "Kwesi", lastName: "Mensah", gender: "M", classId: "c-1", status: "ACTIVE", createdAt: new Date().toISOString() },
    { id: "st-3", admissionNumber: "BS/2024/003", firstName: "Akua", lastName: "Boateng", gender: "F", classId: "c-1", status: "ACTIVE", createdAt: new Date().toISOString() },
    { id: "st-4", admissionNumber: "BS/2024/004", firstName: "Yaw", lastName: "Addo", gender: "M", classId: "c-1", status: "ACTIVE", createdAt: new Date().toISOString() },
    { id: "st-5", admissionNumber: "BS/2024/005", firstName: "Adwoa", lastName: "Darko", gender: "F", classId: "c-1", status: "ACTIVE", createdAt: new Date().toISOString() },
  ];

  // Sample scores for term 1
  const scores: Score[] = [];
  const subjectIds = ["sub-eng", "sub-math", "sub-sci", "sub-rme", "sub-ict"];
  students.forEach((st, i) => {
    subjectIds.forEach((subId) => {
      const sbaRaw = 60 + Math.floor(Math.random() * 35);
      const examRaw = 55 + Math.floor(Math.random() * 40);
      const sbaScaled = Math.round((sbaRaw / 100) * 50 * 100) / 100;
      const examScaled = Math.round((examRaw / 100) * 50 * 100) / 100;
      const total = Math.round((sbaScaled + examScaled) * 100) / 100;
      const gradeObj = grades.find(g => total >= g.minScore && total <= g.maxScore) || grades[grades.length-1];
      scores.push({
        id: `sc-${st.id}-${subId}`,
        studentId: st.id,
        subjectId: subId,
        classId: st.classId,
        term: 1,
        academicYear: "2025/2026",
        sbaRaw,
        sbaScaled,
        examRaw,
        examScaled,
        total,
        grade: gradeObj.grade,
      });
    });
  });

  save(KEYS.school, school);
  save(KEYS.users, users);
  save(KEYS.classes, classes);
  save(KEYS.students, students);
  save(KEYS.subjects, subjects);
  save(KEYS.scores, scores);
  save(KEYS.attendance, []);
  save(KEYS.affective, []);
  save(KEYS.remarks, []);
}

// Public API
export const store = {
  getSchool: () => load<School | null>(KEYS.school, null),
  saveSchool: (s: School) => save(KEYS.school, s),

  getUsers: () => load<User[]>(KEYS.users, []),
  getCurrentUser: () => load<User | null>(KEYS.currentUser, null),
  setCurrentUser: (u: User | null) => save(KEYS.currentUser, u),

  getClasses: () => load<Class[]>(KEYS.classes, []),
  saveClasses: (c: Class[]) => save(KEYS.classes, c),

  getStudents: () => load<Student[]>(KEYS.students, []),
  saveStudents: (s: Student[]) => save(KEYS.students, s),
  getStudentsByClass: (classId: string) => load<Student[]>(KEYS.students, []).filter(s => s.classId === classId && s.status === "ACTIVE"),

  getSubjects: () => load<Subject[]>(KEYS.subjects, []),
  saveSubjects: (s: Subject[]) => save(KEYS.subjects, s),

  getScores: () => load<Score[]>(KEYS.scores, []),
  saveScores: (s: Score[]) => save(KEYS.scores, s),
  getScoresByClassTerm: (classId: string, term: number, year: string) =>
    load<Score[]>(KEYS.scores, []).filter(s => s.classId === classId && s.term === term && s.academicYear === year),

  getAttendance: () => load<Attendance[]>(KEYS.attendance, []),
  saveAttendance: (a: Attendance[]) => save(KEYS.attendance, a),

  getAffective: () => load<AffectiveRecord[]>(KEYS.affective, []),
  saveAffective: (a: AffectiveRecord[]) => save(KEYS.affective, a),

  getRemarks: () => load<Remarks[]>(KEYS.remarks, []),
  saveRemarks: (r: Remarks[]) => save(KEYS.remarks, r),

  seed: seedDemoData,
};
