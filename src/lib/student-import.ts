import Papa from "papaparse";
import type { SchoolClass, Student } from "./models";
export type ImportedStudent = Pick<
  Student,
  | "admission_number"
  | "first_name"
  | "last_name"
  | "gender"
  | "class_id"
  | "status"
  | "guardian_name"
  | "guardian_phone"
>;
export function validateImport(
  records: Record<string, unknown>[],
  classes: SchoolClass[],
  existing: Student[],
) {
  const errors: string[] = [],
    rows: ImportedStudent[] = [],
    seen = new Set(
      existing.map((s) => s.admission_number.trim().toLowerCase()),
    );
  if (records.length > 1000)
    return { rows, errors: ["Import up to 1,000 learners per file."] };
  records.forEach((record, i) => {
    const get = (key: string) => String(record[key] ?? "").trim();
    const admission = get("admission_number"),
      first = get("first_name"),
      last = get("last_name"),
      gender = get("gender").toUpperCase(),
      className = get("class");
    const cls = classes.find(
      (c) => c.name.trim().toLowerCase() === className.toLowerCase(),
    );
    const rowErrors: string[] = [];
    if (!admission || admission.length > 60)
      rowErrors.push("admission_number is required (maximum 60 characters)");
    if (!first || !last || first.length > 100 || last.length > 100)
      rowErrors.push(
        "first_name and last_name are required (maximum 100 characters each)",
      );
    if (!["M", "F", "MALE", "FEMALE"].includes(gender))
      rowErrors.push("gender must be M or F");
    if (!cls) rowErrors.push(`class "${className}" does not exist`);
    if (seen.has(admission.toLowerCase()))
      rowErrors.push(
        `admission number "${admission}" already exists or is duplicated in this file`,
      );
    if (get("guardian_name").length > 150 || get("guardian_phone").length > 35)
      rowErrors.push("guardian contact details are too long");
    seen.add(admission.toLowerCase());
    if (rowErrors.length) errors.push(`Row ${i + 2}: ${rowErrors.join("; ")}.`);
    else
      rows.push({
        admission_number: admission,
        first_name: first,
        last_name: last,
        gender: gender.startsWith("M") ? "M" : "F",
        class_id: cls!.id,
        status: "ACTIVE",
        guardian_name: get("guardian_name"),
        guardian_phone: get("guardian_phone"),
      });
  });
  if (!records.length) errors.push("This file contains no learner rows.");
  return { rows, errors };
}
export async function readStudentImport(
  file: File,
  classes: SchoolClass[],
  existing: Student[],
) {
  if (file.size > 2 * 1024 * 1024)
    throw new Error("Choose a file smaller than 2 MB.");
  let records: Record<string, unknown>[];
  if (file.name.toLowerCase().endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, string>>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) =>
        h
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "_"),
    });
    if (parsed.errors.length)
      throw new Error(`CSV could not be read: ${parsed.errors[0].message}`);
    records = parsed.data;
  } else if (file.name.toLowerCase().endsWith(".xlsx")) {
    const { default: readXlsx } = await import("read-excel-file");
    const sheet = await readXlsx(file);
    const headers = (sheet.shift() || []).map((h) =>
      String(h ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "_"),
    );
    records = sheet
      .filter((row) => row.some((cell) => cell !== null && cell !== ""))
      .map((row) =>
        Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
      );
  } else throw new Error("Use an Excel .xlsx file or a .csv file.");
  return validateImport(records, classes, existing);
}
