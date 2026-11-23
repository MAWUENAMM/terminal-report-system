import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFinanceReceiptPdf,
  type FinanceAllocation, type FinanceCharge, type FinancePayment,
} from "../src/lib/finance-receipt";
import type { School, SchoolClass, Student } from "../src/lib/models";

const school = {
  id: "ark", name: "THE ARK ACADEMY", address: "GP-6060-6968",
  district: "ATWIMA KWANWOMA", region: "ASHANTI REGION",
  email: "thearkacademybebu@gmail.com", phone: "0557050007",
  logo_url: null,
} as School;
const student = {
  id: "student", school_id: "ark",
  first_name: "ADADE", other_names: "APPIAH", last_name: "PRINCE",
  admission_number: "ARK136", photo_url: undefined,
  gender: "M", class_id: "grade4", status: "ACTIVE",
} as Student;
const cls = { id: "grade4", name: "GRADE 4" } as SchoolClass;
const payment: FinancePayment = {
  id: "payment", school_id: "ark", student_id: "student",
  amount: 500, method: "CASH", reference: "FEES",
  note: "", receipt_number: "ER-20261123-3D4C0C3B96",
  created_at: "2026-11-23T15:04:00Z", voided_at: null,
  created_by: "school-admin", void_reason: null,
};
function charge(id: string, description: string): FinanceCharge {
  return {
    id, school_id: "ark", student_id: "student",
    academic_year: "2026/2027", term: 1,
    category: "FEE", description, amount: 500,
    fee_id: null, sale_id: null, voided_at: null,
    created_at: "2026-11-23T15:04:00Z",
  };
}
function paymentAllocation(i: number): FinanceAllocation {
  return { id: "alloc-" + i, payment_id: "payment",
    charge_id: "charge-" + i, amount: i === 0 ? 500 : 0 };
}
const createArgs = (changes: Record<string,unknown> = {}) => ({
  school, student, cls, payment,
  charges: [charge("charge-0", "FEES")],
  allocations: [paymentAllocation(0)],
  issuedBy: "ARK ACADEMY",
  balance: 350,
  ...changes,
});

test("Ark Academy official payment receipt prints on ONE A5 sheet", async () => {
  const doc = await buildFinanceReceiptPdf(createArgs());
  assert.equal(doc.getNumberOfPages(), 1, "Ordinary receipt must fit on one sheet");
  assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 148) < 0.25,
    "Payment receipt must be exactly A5 width");
  assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 210) < 0.25,
    "Payment receipt must be exactly A5 height");
  const pdf = doc.output();
  for (const value of [
    "THE ARK ACADEMY", "PAYMENT RECEIPT", "ER-20261123-3D4C0C3B96",
    "ADADE APPIAH PRINCE", "ARK136", "PAYMENT BREAKDOWN",
    "GHS 500.00", "GHS 350.00", "AMOUNT IN WORDS",
    "TRANSACTION REFERENCE", "OFFICIAL PAYMENT RECORD",
  ]) assert.ok(pdf.includes(value), "Missing A5 receipt content: " + value);
});

test("Reversed receipt retains VOIDED marking on A5", async () => {
  const doc = await buildFinanceReceiptPdf(createArgs({
    payment: { ...payment, voided_at: "2026-11-23T16:00:00Z" },
  }));
  assert.equal(doc.getNumberOfPages(), 1);
  assert.ok(doc.output().includes("VOIDED"));
});

test("Receipts containing numerous allocations keep A5 page size on every sheet", async () => {
  const charges = Array.from({ length: 18 }, (_, i) =>
    charge("charge-" + i, "School fee instalment line " + (i + 1)));
  const allocations = charges.map((_, i) => paymentAllocation(i));
  const doc = await buildFinanceReceiptPdf(createArgs({ charges, allocations }));
  assert.ok(doc.getNumberOfPages() >= 2, "Long breakdown should paginate");
  for (let p = 1; p <= doc.getNumberOfPages(); p++) {
    doc.setPage(p);
    assert.ok(Math.abs(doc.internal.pageSize.getWidth() - 148) < 0.25);
    assert.ok(Math.abs(doc.internal.pageSize.getHeight() - 210) < 0.25);
  }
  const body = doc.output();
  assert.ok(body.includes("School fee instalment line 1"));
  assert.ok(body.includes("School fee instalment line 18"));
});
