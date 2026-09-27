import type { ReportSnapshot, Student, Workspace } from "./models";
import type { ReportCardData, Subject as LegacySubject } from "@/types";
import { computePositions, getGrade, DEFAULT_GRADING_SCALE } from "./grading";
export function currentSnapshot(
  w: Workspace,
  student: Student,
): ReportSnapshot {
  const current = (r: { academic_year: string; term: number }) =>
    r.academic_year === w.school.academic_year &&
    r.term === w.school.current_term;
  return {
    school: w.school,
    student,
    class: w.classes.find((c) => c.id === student.class_id)!,
    subjects: w.subjects,
    scores: w.scores.filter((s) => s.student_id === student.id && current(s)),
    attendance:
      w.attendance.find((s) => s.student_id === student.id && current(s)) ||
      null,
    affective:
      w.affective.find((s) => s.student_id === student.id && current(s)) ||
      null,
    remarks:
      w.remarks.find((s) => s.student_id === student.id && current(s)) || null,
    class_scores: w.scores.filter(
      (s) => s.class_id === student.class_id && current(s),
    ),
    class_students: w.students
      .filter((s) => s.class_id === student.class_id && s.status === "ACTIVE")
      .map((s) => ({ id: s.id })),
  };
}
export function reportData(snapshot: ReportSnapshot): {
  data: ReportCardData;
  subjects: LegacySubject[];
} {
  const x = snapshot,
    s = x.student,
    sch = x.school,
    c = x.class;
  const average = x.scores.length
    ? x.scores.reduce((sum, s) => sum + Number(s.total), 0) / x.scores.length
    : 0;
  const averages = x.class_students.map((student) => {
    const scores = x.class_scores.filter((sc) => sc.student_id === student.id);
    return {
      studentId: student.id,
      total: scores.length
        ? scores.reduce((n, sc) => n + Number(sc.total), 0) / scores.length
        : 0,
    };
  });
  const positions = computePositions(averages);
  const subjects = x.subjects.map((s) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    level: s.level,
    isCore: s.is_core,
    order: s.display_order,
  }));
  return {
    subjects,
    data: {
      student: {
        id: s.id,
        admissionNumber: s.admission_number,
        firstName: s.first_name,
        lastName: s.last_name,
        otherNames: s.other_names,
        gender: s.gender,
        classId: s.class_id,
        dateOfBirth: s.date_of_birth || undefined,
        guardianName: s.guardian_name,
        guardianPhone: s.guardian_phone,
        status: s.status,
        photoUrl: s.photo_url,
        createdAt: "",
      },
      school: {
        id: sch.id,
        name: sch.name,
        address: sch.address,
        phone: sch.phone,
        email: sch.email,
        headteacherName: sch.headteacher_name,
        district: sch.district,
        region: sch.region,
        academicYear: sch.academic_year,
        currentTerm: sch.current_term as 1 | 2 | 3,
        sbaWeight: Number(sch.sba_weight),
        examWeight: Number(sch.exam_weight),
        gradingScale: {
          id: "default",
          name: "School scale",
          grades: DEFAULT_GRADING_SCALE,
        },
      },
      class: {
        id: c.id,
        name: c.name,
        level: c.level,
        academicYear: sch.academic_year,
      },
      scores: x.scores.map((sc) => ({
        id: sc.id,
        studentId: sc.student_id,
        subjectId: sc.subject_id,
        classId: sc.class_id,
        term: sc.term as 1 | 2 | 3,
        academicYear: sc.academic_year,
        sbaRaw: Number(sc.sba_raw),
        examRaw: Number(sc.exam_raw),
        sbaScaled: Number(sc.sba_scaled),
        examScaled: Number(sc.exam_scaled),
        total: Number(sc.total),
        grade: sc.grade,
        subjectRemark: sc.subject_remark,
        position: computePositions(
          x.class_scores
            .filter((other) => other.subject_id === sc.subject_id)
            .map((other) => ({
              studentId: other.student_id,
              total: Number(other.total),
            })),
        ).get(sc.student_id),
      })),
      attendance: x.attendance
        ? {
            id: x.attendance.id,
            studentId: s.id,
            term: sch.current_term as 1 | 2 | 3,
            academicYear: sch.academic_year,
            daysPresent: x.attendance.days_present,
            totalDays: x.attendance.total_days,
          }
        : undefined,
      affective: x.affective
        ? {
            id: x.affective.id,
            studentId: s.id,
            term: sch.current_term as 1 | 2 | 3,
            academicYear: sch.academic_year,
            conduct: x.affective.conduct,
            interest: x.affective.interest,
            attitude: x.affective.attitude,
            talents: x.affective.talents,
          }
        : undefined,
      remarks: x.remarks
        ? {
            id: x.remarks.id,
            studentId: s.id,
            term: sch.current_term as 1 | 2 | 3,
            academicYear: sch.academic_year,
            classTeacherRemark: x.remarks.class_teacher_remark,
            headteacherRemark: x.remarks.headteacher_remark,
          }
        : undefined,
      overallAverage: Math.round(average * 100) / 100,
      overallGrade: x.scores.length ? getGrade(average).grade : "-",
      overallPosition: x.scores.length ? positions.get(s.id) : undefined,
      totalStudents: x.class_students.length,
    },
  };
}
export async function downloadReport(
  snapshot: ReportSnapshot,
  revision?: number,
) {
  const { generateReportPDF } = await import("./report-pdf");
  const { data, subjects } = reportData(snapshot);
  generateReportPDF(data, subjects).save(
    `${snapshot.student.admission_number.replace(/[^a-z0-9_-]/gi, "_")}_${snapshot.school.academic_year.replace("/", "-")}_Term${snapshot.school.current_term}${revision ? `_Archive_v${revision}` : ""}.pdf`,
  );
}
