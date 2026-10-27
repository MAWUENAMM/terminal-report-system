import assert from "node:assert/strict";
import { GState, jsPDF } from "jspdf";
import test from "node:test";
import {
  amountInWords, dueFor, ghs, money,
  type FinanceAllocation, type FinanceCharge, type FinancePayment
} from "../src/lib/finance-receipt";

const charge = (id:string,amount:number):FinanceCharge=>({
  id,school_id:"school",student_id:"student",academic_year:"2026/2027",term:1,
  category:"FEE",description:"Term fee",amount,fee_id:null,sale_id:null,
  voided_at:null,created_at:"2026-10-01T00:00:00Z"
});
const payment = (id:string, amount:number, voided_at:string|null=null):FinancePayment=>({
  id,school_id:"school",student_id:"student",amount,method:"CASH",
  reference:"",note:"",receipt_number:"ER-TEST",created_at:"2026-10-01T00:00:00Z",
  voided_at,void_reason:null,created_by:"cashier"
});
const alloc=(id:string,payment_id:string,charge_id:string,amount:number):FinanceAllocation=>({
  id,payment_id,charge_id,amount
});

test("money calculations use integer pesewas, not binary fractional accumulation",()=>{
  assert.equal(money(0.1),10);
  assert.equal(money(0.2),20);
  assert.equal(money(0.3),30);
  const b=dueFor("student",[charge("a",.1),charge("b",.2)],
    [payment("p",.3)],[alloc("1","p","a",.1),alloc("2","p","b",.2)]);
  assert.deepEqual(b,{charged:.3,paid:.3,outstanding:0});
});

test("student debt decreases with partial payment",()=>{
  const b=dueFor("student",[charge("a",1200)],
    [payment("p",800)],[alloc("1","p","a",800)]);
  assert.deepEqual(b,{charged:1200,paid:800,outstanding:400});
});

test("voided payments remain in history but are not credited toward balances",()=>{
  const b=dueFor("student",[charge("a",1200)],
    [payment("p",800,"2026-10-02T00:00:00Z")],[alloc("1","p","a",800)]);
  assert.deepEqual(b,{charged:1200,paid:0,outstanding:1200});
});

test("cross-student allocations never affect the selected learner",()=>{
  const b=dueFor("student",[charge("a",200)],
    [payment("other",50),{...payment("p",20),student_id:"different"}],
    [alloc("1","other","a",50),alloc("2","p","a",20)]);
  assert.deepEqual(b,{charged:200,paid:50,outstanding:150});
});

test("receipt amount in words includes currency and pesewas",()=>{
  assert.equal(amountInWords(0),"zero Ghana cedis only");
  assert.equal(amountInWords(82.5),"eighty two Ghana cedis and fifty pesewas");
  assert.ok(amountInWords(1200).includes("one thousand two hundred"));
  assert.equal(ghs(400), "GHS 400.00");
  assert.equal(ghs(2000.50), "GHS 2,000.50");
});

test("receipt watermark graphics state uses jsPDF GState, not a plain object",()=>{
  const doc=new jsPDF({unit:"mm",format:"a4"});
  assert.doesNotThrow(()=>{
    doc.saveGraphicsState();
    doc.setGState(new GState({opacity:0.065}));
    doc.setFillColor(10,80,60);
    doc.rect(10,10,30,30,"F");
    doc.restoreGraphicsState();
    const output=doc.output("arraybuffer");
    assert.ok(output.byteLength>500);
  });
});
