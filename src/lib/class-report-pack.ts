import { jsPDF } from "jspdf";
import { generateReportPDF } from "./report-pdf";
import { currentSnapshot, reportData } from "./reporting";
import { fullName, type Workspace } from "./models";
import { imageUrlToPngDataUrl, resolveSchoolAssetUrl } from "./school-branding";

/**
 * Print one complete A4 report card per learner, in a SINGLE PDF document.
 * The report builder always produces one page for each learner, preventing
 * signatures and reopening dates being separated from the learner details.
 */
export async function downloadClassReportPack(w: Workspace, classId: string) {
  const cls = w.classes.find((c) => c.id === classId && c.school_id === w.school.id);
  if (!cls) throw new Error("Please select a class at your school.");

  const students = w.students
    .filter((student) =>
      student.school_id === w.school.id &&
      student.class_id === classId &&
      student.status === "ACTIVE",
    )
    .sort((a, b) => fullName(a).localeCompare(fullName(b), "en", { sensitivity: "base" }));
  if (!students.length) throw new Error("This class has no active learners.");

  let logo: string | null = null;
  const logoUrl = await resolveSchoolAssetUrl(w.school.logo_url);
  if (logoUrl) {
    try { logo = await imageUrlToPngDataUrl(logoUrl); }
    catch { /* The printed school name is retained when a logo cannot be decoded. */ }
  }

  let combined: jsPDF | undefined;
  for (const learner of students) {
    const snap = currentSnapshot(w, learner);
    const { data, subjects } = reportData(snap);
    if (logo) data.school.logoUrl = logo;
    if (learner.photo_url) {
      try {
        const url = await resolveSchoolAssetUrl(learner.photo_url);
        if (url) data.student.photoUrl = await imageUrlToPngDataUrl(url);
      } catch { /* Missing photographs must not block printing academic reports. */ }
    }
    combined = generateReportPDF(data, subjects, combined);
  }
  if (!combined || combined.getNumberOfPages() !== students.length)
    throw new Error("The class report pack did not produce exactly one page per learner.");

  const filename = [
    w.school.name, cls.name, w.school.academic_year,
    "Term" + w.school.current_term, "All_Learner_Reports",
  ].map((part) => part.replace(/[^a-z0-9_-]/gi, "_")).join("_") + ".pdf";
  combined.save(filename);
  return students.length;
}
