"use client";

import {
  School,
  Student,
  Class,
  Subject,
  Score,
  Attendance,
  AffectiveRecord,
  Remarks,
  User,
} from "@/types";
import { DEFAULT_GRADING_SCALE as grades } from "@/lib/grading";

const DATA_VERSION = 3;

const KEYS = {
  version: "trs_version",
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

const FIRST_NAMES_M = ["Kwame", "Kofi", "Yaw", "Kwesi", "Kojo", "Kwabena", "Fiifi", "Nana"];
const FIRST_NAMES_F = ["Abena", "Akua", "Adwoa", "Afia", "Ama", "Akosua", "Esi", "Efua"];
const LAST_NAMES = [
  "Mensah", "Osei", "Boateng", "Asante", "Addo", "Darko", "Owusu", "Amoah",
  "Appiah", "Frimpong", "Agyeman", "Sarpong", "Danso", "Bonsu", "Tetteh", "Amponsah",
];

function seedData() {
  const version = load<number>(KEYS.version, 0);
  if (version >= DATA_VERSION) return;

  const school: School = {
    id: "sch-1",
    name: "Unity Basic School",
    address: "P.O. Box GP 452, Accra",
    phone: "+233 30 221 4580",
    email: "info@unitybasic.edu.gh",
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
    {
      id: "u-admin",
      email: "admin@school.edu.gh",
      name: "System Administrator",
      role: "ADMIN",
      createdAt: new Date().toISOString(),
    },
    {
      id: "u-head",
      email: "head@school.edu.gh",
      name: "Mrs. Ama Mensah",
      role: "HEADTEACHER",
      createdAt: new Date().toISOString(),
    },
    {
      id: "u-ct",
      email: "teacher@school.edu.gh",
      name: "Mr. Kwame Asante",
      role: "CLASS_TEACHER",
      classId: "c-p4",
      createdAt: new Date().toISOString(),
    },
  ];

  const classDefs: { id: string; name: string; level: "KG" | "PRIMARY" | "JHS" }[] = [
    { id: "c-kg1", name: "KG 1", level: "KG" },
    { id: "c-kg2", name: "KG 2", level: "KG" },
    { id: "c-p1", name: "Primary 1", level: "PRIMARY" },
    { id: "c-p2", name: "Primary 2", level: "PRIMARY" },
    { id: "c-p3", name: "Primary 3", level: "PRIMARY" },
    { id: "c-p4", name: "Primary 4", level: "PRIMARY" },
    { id: "c-p5", name: "Primary 5", level: "PRIMARY" },
    { id: "c-p6", name: "Primary 6", level: "PRIMARY" },
    { id: "c-jhs1", name: "JHS 1", level: "JHS" },
    { id: "c-jhs2", name: "JHS 2", level: "JHS" },
    { id: "c-jhs3", name: "JHS 3", level: "JHS" },
  ];

  const classes: Class[] = classDefs.map((c) => ({
    id: c.id,
    name: c.name,
    level: c.level,
    academicYear: "2025/2026",
    classTeacherId: c.id === "c-p4" ? "u-ct" : undefined,
  }));

  const subjects: Subject[] = [
    { id: "sub-eng", name: "English Language", code: "ENG", level: "ALL", isCore: true, order: 1 },
    { id: "sub-math", name: "Mathematics", code: "MATH", level: "ALL", isCore: true, order: 2 },
    { id: "sub-sci", name: "Science", code: "SCI", level: "ALL", isCore: true, order: 3 },
    { id: "sub-rme", name: "Religious & Moral Education", code: "RME", level: "ALL", isCore: false, order: 4 },
    { id: "sub-ict", name: "Computing", code: "ICT", level: "ALL", isCore: false, order: 5 },
    { id: "sub-owop", name: "Our World Our People", code: "OWOP", level: "PRIMARY", isCore: false, order: 6 },
    { id: "sub-gh", name: "Ghanaian Language", code: "GHL", level: "ALL", isCore: false, order: 7 },
    { id: "sub-ca", name: "Creative Arts", code: "CA", level: "PRIMARY", isCore: false, order: 8 },
    { id: "sub-hist", name: "History", code: "HIST", level: "PRIMARY", isCore: false, order: 9 },
    { id: "sub-ss", name: "Social Studies", code: "SS", level: "JHS", isCore: true, order: 10 },
    { id: "sub-fr", name: "French", code: "FR", level: "JHS", isCore: false, order: 11 },
    { id: "sub-pe", name: "Physical Education", code: "PE", level: "ALL", isCore: false, order: 12 },
  ];

  // Build students across classes
  const students: Student[] = [];
  let admissionSeq = 1;
  const perClass = 6;

  classDefs.forEach((cls) => {
    for (let i = 0; i < perClass; i++) {
      const isFemale = i % 2 === 0;
      const first = isFemale
        ? FIRST_NAMES_F[i % FIRST_NAMES_F.length]
        : FIRST_NAMES_M[i % FIRST_NAMES_M.length];
      const last = LAST_NAMES[(admissionSeq + i) % LAST_NAMES.length];
      const num = String(admissionSeq).padStart(3, "0");
      students.push({
        id: `st-${cls.id}-${i + 1}`,
        admissionNumber: `UBS/2025/${num}`,
        firstName: first,
        lastName: last,
        gender: isFemale ? "F" : "M",
        classId: cls.id,
        status: "ACTIVE",
        createdAt: new Date().toISOString(),
        guardianName: `${LAST_NAMES[(admissionSeq + 3) % LAST_NAMES.length]} ${last}`,
        guardianPhone: `024${String(1000000 + admissionSeq).slice(0, 7)}`,
      });
      admissionSeq++;
    }
  });

  // Sample scores for Primary 4 (class teacher class)
  const scores: Score[] = [];
  const p4Students = students.filter((s) => s.classId === "c-p4");
  const coreSubjects = ["sub-eng", "sub-math", "sub-sci", "sub-rme", "sub-ict"];

  p4Students.forEach((st) => {
    coreSubjects.forEach((subId) => {
      const sbaRaw = 55 + Math.floor(Math.random() * 40);
      const examRaw = 50 + Math.floor(Math.random() * 45);
      const sbaScaled = Math.round((sbaRaw / 100) * 50 * 100) / 100;
      const examScaled = Math.round((examRaw / 100) * 50 * 100) / 100;
      const total = Math.round((sbaScaled + examScaled) * 100) / 100;
      const gradeObj =
        grades.find((g) => total >= g.minScore && total <= g.maxScore) ||
        grades[grades.length - 1];
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
  save(KEYS.version, DATA_VERSION);
}

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
  getStudentsByClass: (classId: string) =>
    load<Student[]>(KEYS.students, []).filter(
      (s) => s.classId === classId && s.status === "ACTIVE"
    ),

  getSubjects: () => load<Subject[]>(KEYS.subjects, []),
  saveSubjects: (s: Subject[]) => save(KEYS.subjects, s),

  getScores: () => load<Score[]>(KEYS.scores, []),
  saveScores: (s: Score[]) => save(KEYS.scores, s),
  getScoresByClassTerm: (classId: string, term: number, year: string) =>
    load<Score[]>(KEYS.scores, []).filter(
      (s) => s.classId === classId && s.term === term && s.academicYear === year
    ),

  getAttendance: () => load<Attendance[]>(KEYS.attendance, []),
  saveAttendance: (a: Attendance[]) => save(KEYS.attendance, a),

  getAffective: () => load<AffectiveRecord[]>(KEYS.affective, []),
  saveAffective: (a: AffectiveRecord[]) => save(KEYS.affective, a),

  getRemarks: () => load<Remarks[]>(KEYS.remarks, []),
  saveRemarks: (r: Remarks[]) => save(KEYS.remarks, r),

  search: (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return { students: [] as Student[], classes: [] as Class[] };
    const students = load<Student[]>(KEYS.students, []).filter(
      (s) =>
        s.status === "ACTIVE" &&
        (`${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
          s.admissionNumber.toLowerCase().includes(q) ||
          (s.guardianName || "").toLowerCase().includes(q))
    );
    const classes = load<Class[]>(KEYS.classes, []).filter((c) =>
      c.name.toLowerCase().includes(q)
    );
    return { students: students.slice(0, 8), classes: classes.slice(0, 5) };
  },

  seed: seedData,
};
