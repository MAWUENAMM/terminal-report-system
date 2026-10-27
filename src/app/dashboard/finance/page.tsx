"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, BellRing, BookOpen, Check, CircleDollarSign,
  ClipboardList, CreditCard, History, Package, Plus, RefreshCcw,
  Search, ShoppingBag, Trash2, Wallet
} from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Empty, Field, Modal, Restricted } from "@/components/ui";
import { fullName } from "@/lib/models";
import {
  dueFor, downloadFinanceReceipt, ghs,
  type FinanceAllocation, type FinanceCharge, type FinancePayment
} from "@/lib/finance-receipt";

type Fee = {
  id:string;school_id:string;academic_year:string;term:number;class_id:string|null;
  name:string;amount:number;status:"DRAFT"|"APPLIED";created_at:string;
};
type Item = {
  id:string;school_id:string;name:string;description:string;unit_price:number;
  stock_quantity:number;image_path:string|null;active:boolean;
};
type Sale = {
  id:string;student_id:string;item_id:string;quantity:number;unit_price:number;
  total:number;created_at:string;
};
type Event = {
  id:string;kind:string;message:string;actor_name:string;
  payment_id:string|null;created_at:string;
};
type View = "accounts"|"fees"|"payments"|"items"|"activity";
type ItemDraft = { id?:string;name:string;description:string;unit_price:string;stock_quantity:string;active:boolean;image:File|null };
const emptyItem = ():ItemDraft=>({name:"",description:"",unit_price:"",stock_quantity:"0",active:true,image:null});
const moneyInput = (value:string) => /^\d{1,8}(\.\d{1,2})?$/.test(value) && Number(value)>0;

export default function SchoolFinance() {
  const {data:w,run,busy}=useWorkspace();
  const authorized = w.profile.role === "ADMIN" || w.profile.role === "ACCOUNTANT";
  const [view,setView]=useState<View>("accounts");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [fees,setFees]=useState<Fee[]>([]);
  const [items,setItems]=useState<Item[]>([]);
  const [charges,setCharges]=useState<FinanceCharge[]>([]);
  const [payments,setPayments]=useState<FinancePayment[]>([]);
  const [allocations,setAllocations]=useState<FinanceAllocation[]>([]);
  const [sales,setSales]=useState<Sale[]>([]);
  const [events,setEvents]=useState<Event[]>([]);
  const [images,setImages]=useState<Record<string,string>>({});
  const [search,setSearch]=useState("");
  const [selectedStudent,setSelectedStudent]=useState("");
  const [feeName,setFeeName]=useState("");
  const [feeAmount,setFeeAmount]=useState("");
  const [feeClass,setFeeClass]=useState("");
  const [feeTerm,setFeeTerm]=useState(String(w.school.current_term));
  const [feeYear,setFeeYear]=useState(w.school.academic_year);
  const [feeEditing,setFeeEditing]=useState<Fee|null>(null);
  const [paymentAmount,setPaymentAmount]=useState("");
  const [paymentMethod,setPaymentMethod]=useState("CASH");
  const [paymentReference,setPaymentReference]=useState("");
  const [paymentNote,setPaymentNote]=useState("");
  const [itemDraft,setItemDraft]=useState<ItemDraft|null>(null);
  const [saleItem,setSaleItem]=useState("");
  const [saleQty,setSaleQty]=useState("1");

  const load=useCallback(async()=>{
    if(!authorized)return;
    setLoading(true);setError("");
    try{
      const db=browserClient();
      const tables=["finance_fees","finance_items","finance_charges","finance_payments",
        "finance_allocations","finance_sales","finance_events"] as const;
      const results=await Promise.all(tables.map(table=>
        db.from(table).select("*").eq("school_id",w.school.id).limit(5000)
      ));
      const failure=results.find(result=>result.error);
      if(failure?.error) throw new Error(failure.error.message);
      const [f,i,c,p,a,s,e]=results.map(result=>result.data||[]);
      setFees(f as Fee[]);setItems(i as Item[]);setCharges(c as FinanceCharge[]);
      setPayments(p as FinancePayment[]);setAllocations(a as FinanceAllocation[]);
      setSales(s as Sale[]);setEvents((e as Event[]).sort((a,b)=>b.created_at.localeCompare(a.created_at)));
      const itemPaths=(i as Item[]).filter(item=>item.image_path);
      const signed=await Promise.all(itemPaths.map(async item=>{
        const {data}=await db.storage.from("finance-items").createSignedUrl(item.image_path!,3600);
        return [item.id,data?.signedUrl||""] as const;
      }));
      setImages(Object.fromEntries(signed));
    }catch(e){setError(e instanceof Error?e.message:"Unable to load finance data.");}
    finally{setLoading(false);}
  },[authorized,w.school.id]);

  useEffect(()=>{void load();},[load]);
  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("student");
    if(id && w.students.some(student=>student.id===id)) {
      setSelectedStudent(id);setView("accounts");
    }
  },[w.students]);

  const students=useMemo(()=>w.students.filter(s=>s.status==="ACTIVE").sort((a,b)=>fullName(a).localeCompare(fullName(b))),[w.students]);
  const balances=useMemo(()=>new Map(w.students.map(s=>[s.id,dueFor(s.id,charges,payments,allocations)])),[w.students,charges,payments,allocations]);
  const totalCharged=[...balances.values()].reduce((sum,b)=>sum+b.charged,0);
  const totalReceived=payments.filter(p=>!p.voided_at).reduce((sum,p)=>sum+Number(p.amount),0);
  const totalOutstanding=[...balances.values()].reduce((sum,b)=>sum+b.outstanding,0);
  const fullyPaid=students.filter(s=>{const b=balances.get(s.id);return b && b.charged>0 && b.outstanding===0;}).length;
  const selected=students.find(s=>s.id===selectedStudent);
  const selectedBalance=balances.get(selectedStudent)||{charged:0,paid:0,outstanding:0};
  const selectedCharges=charges.filter(c=>c.student_id===selectedStudent && !c.voided_at).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const selectedPayments=payments.filter(p=>p.student_id===selectedStudent).sort((a,b)=>b.created_at.localeCompare(a.created_at));
  const searchable=students.filter(s=>(fullName(s)+" "+s.admission_number).toLowerCase().includes(search.toLowerCase()));

  async function perform(task:()=>Promise<void>,message:string){
    const ok=await run(task,message);
    if(ok)await load();
  }
  async function invoke<T=unknown>(name:string,args:Record<string,unknown>):Promise<T>{
    const {data,error}=await browserClient().rpc(name,args);
    if(error)throw new Error(error.message);
    return data as T;
  }
  async function createFee(event:FormEvent){
    event.preventDefault();
    if(!moneyInput(feeAmount))return setError("Enter a valid positive fee amount with up to two decimals.");
    await perform(async()=>{
      const {error}=await browserClient().from("finance_fees").insert({
        school_id:w.school.id,academic_year:feeYear.trim(),term:Number(feeTerm),
        class_id:feeClass||null,name:feeName.trim(),amount:Number(feeAmount),
        created_by:w.profile.id
      });
      if(error)throw new Error(error.message);
      setFeeName("");setFeeAmount("");
    },"Fee draft created. Review it before applying to learners.");
  }
  async function applyFee(fee:Fee){
    if(!confirm("Apply "+fee.name+" ("+ghs(fee.amount)+") to all eligible active learners? Applied fees cannot be edited or deleted. Clicking Apply again will not duplicate student charges."))return;
    await perform(async()=>{
      const count=await invoke<number>("finance_apply_fee",{p_fee_id:fee.id});
      setError(count===0?"No new learner charges were needed. Existing assignments were preserved.":"");
    },"Fee applied to eligible learners.");
  }
  async function editFee(event:FormEvent){
    event.preventDefault();
    if(!feeEditing || !moneyInput(feeAmount))return;
    await perform(async()=>{
      const {error}=await browserClient().from("finance_fees")
        .update({name:feeName.trim(),amount:Number(feeAmount)}).eq("id",feeEditing.id).eq("status","DRAFT")
        .select("id").single();
      if(error)throw new Error(error.message);
      setFeeEditing(null);setFeeName("");setFeeAmount("");
    },"Fee draft updated.");
  }
  async function deleteFee(fee:Fee){
    if(!confirm("Delete the unapplied fee draft '"+fee.name+"'?"))return;
    await perform(async()=>{
      const {error}=await browserClient().from("finance_fees").delete().eq("id",fee.id).eq("status","DRAFT");
      if(error)throw new Error(error.message);
    },"Draft removed.");
  }
  async function pay(event:FormEvent){
    event.preventDefault();
    if(!selected || !moneyInput(paymentAmount))return setError("Choose a learner and a valid payment amount.");
    if(Math.round(Number(paymentAmount)*100)>Math.round(selectedBalance.outstanding*100)){
      return setError("The payment exceeds the student's current outstanding amount.");
    }
    await perform(async()=>{
      await invoke("finance_record_payment",{
        p_student_id:selected.id,p_amount:Number(paymentAmount),
        p_method:paymentMethod,p_reference:paymentReference.trim(),p_note:paymentNote.trim()
      });
      setPaymentAmount("");setPaymentReference("");setPaymentNote("");
      setView("payments");
    },"Payment recorded and receipt available. Finance team notified.");
  }
  async function reverse(payment:FinancePayment){
    const reason=prompt("State why this payment must be reversed (minimum 8 characters). This keeps the original receipt in the audit history.");
    if(!reason)return;
    await perform(async()=>{await invoke("finance_void_payment",{p_payment_id:payment.id,p_reason:reason});},"Payment reversed and recorded in audit history.");
  }
  async function notify(payment:FinancePayment){
    await perform(async()=>{await invoke("finance_notify_payment",{p_payment_id:payment.id});},"Payment notification sent to finance administrators.");
  }
  async function saveItem(event:FormEvent){
    event.preventDefault();
    if(!itemDraft)return;
    if(!/^\d{1,8}(\.\d{1,2})?$/.test(itemDraft.unit_price))return setError("Enter a valid price.");
    const stock=Number(itemDraft.stock_quantity);
    if(!Number.isSafeInteger(stock)||stock<0)return setError("Stock must be a non-negative whole number.");
    const file=itemDraft.image;
    if(file && (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size>2*1024*1024)){
      return setError("Item pictures must be PNG, JPG or WEBP, at most 2 MB.");
    }
    await perform(async()=>{
      const db=browserClient();
      const payload={
        name:itemDraft.name.trim(),description:itemDraft.description.trim(),
        unit_price:Number(itemDraft.unit_price),stock_quantity:stock,active:itemDraft.active
      };
      const query=itemDraft.id?
        db.from("finance_items").update(payload).eq("id",itemDraft.id):
        db.from("finance_items").insert({...payload,school_id:w.school.id});
      const {data,error}=await query.select("id").single();
      if(error)throw new Error(error.message);
      if(file){
        const path="schools/"+w.school.id+"/items/"+data.id+"/image";
        const {error:uploadError}=await db.storage.from("finance-items")
          .upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
        if(uploadError)throw new Error("Item was saved, but photo upload failed: "+uploadError.message);
        const {error:pathError}=await db.from("finance_items").update({image_path:path}).eq("id",data.id);
        if(pathError)throw new Error(pathError.message);
      }
      setItemDraft(null);
    },"Inventory item saved.");
  }
  async function removeItem(item:Item){
    if(!confirm("Delete '"+item.name+"'? Items with sales history cannot be deleted."))return;
    await perform(async()=>{
      const {error}=await browserClient().from("finance_items").delete().eq("id",item.id);
      if(error)throw new Error(error.message);
    },"Unused item deleted.");
  }
  async function sell(event:FormEvent){
    event.preventDefault();
    if(!selected)return setError("Select a learner before selling an item.");
    await perform(async()=>{
      await invoke("finance_sell_item",{
        p_item_id:saleItem,p_student_id:selected.id,p_quantity:Number(saleQty)
      });
      setSaleQty("1");setSaleItem("");
    },"Sale recorded, stock updated and student account charged.");
  }
  async function receipt(payment:FinancePayment){
    const student=w.students.find(s=>s.id===payment.student_id);
    if(!student)return setError("Student record is unavailable.");
    setError("");
    try{
      await downloadFinanceReceipt({
        school:w.school,student,cls:w.classes.find(c=>c.id===student.class_id),payment,
        charges,allocations,
        issuedBy:w.staff.find(p=>p.id===payment.created_by)?.full_name || "School finance office",
        balance:balances.get(payment.student_id)?.outstanding||0
      });
    }catch(e){setError(e instanceof Error?e.message:"Receipt download failed.");}
  }
  if(!authorized)return <Restricted />;
  const tabs: {key:View;title:string;icon:typeof Wallet}[]=[
    {key:"accounts",title:"Student accounts",icon:Wallet},
    {key:"fees",title:"Fees & charges",icon:ClipboardList},
    {key:"payments",title:"Payments & receipts",icon:CreditCard},
    {key:"items",title:"Items & sales",icon:ShoppingBag},
    {key:"activity",title:"Finance activity",icon:History}
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="School operations · Finance" title="Finance & Accounting"
        description={"Fee management, balances, student payments, inventory sales and traceable receipts for "+w.school.name+". All values are Ghana cedis."}>
        <button className="btn-secondary" onClick={()=>void load()} disabled={loading||busy}>
          <RefreshCcw size={16}/> Refresh
        </button>
      </PageHeader>

      {error&&<div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
      {loading&&<p role="status" className="text-sm text-muted">Refreshing finance records…</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Fees & sales charged",ghs(totalCharged),"Total student charges",Wallet],
          ["Payments collected",ghs(totalReceived),"Excludes reversed payments",CircleDollarSign],
          ["Outstanding balances",ghs(totalOutstanding),"Across all recorded terms",BookOpen],
          ["Fully paid learners",String(fullyPaid),"Among "+students.length+" active learners",Check]
        ].map(([label,value,help,Icon])=>{
          const C=Icon as typeof Wallet;
          return <article key={String(label)} className="surface rounded-2xl p-5">
            <div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-muted">{String(label)}</span><C size={20} className="text-emerald-700"/></div>
            <p className="mt-3 break-words text-2xl font-bold tabular-nums">{String(value)}</p>
            <p className="mt-2 text-xs text-muted">{String(help)}</p>
          </article>;
        })}
      </section>

      <nav aria-label="Finance sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        {tabs.map(tab=><button key={tab.key} type="button" onClick={()=>setView(tab.key)}
          className={"flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition "+(view===tab.key?"bg-emerald-700 text-white":"text-slate-600 hover:bg-slate-50")}>
          <tab.icon size={16}/>{tab.title}
        </button>)}
      </nav>

      {(view==="accounts"||view==="payments"||view==="items")&&
        <section className="surface rounded-2xl p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <Field label="Find learner by name or admission number">
              <div className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400"/>
                <input className="field pl-10" placeholder="Search active learners…" value={search} onChange={e=>setSearch(e.target.value)}/>
              </div>
            </Field>
            <Field label="Selected learner">
              <select className="field" value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>
                <option value="">Choose a learner</option>
                {searchable.map(s=><option key={s.id} value={s.id}>{fullName(s)} · {s.admission_number}</option>)}
              </select>
            </Field>
          </div>
          {selected&&<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
            <div><p className="font-bold text-emerald-950">{fullName(selected)}</p><p className="text-xs text-emerald-800">{selected.admission_number} · {w.classes.find(c=>c.id===selected.class_id)?.name||"Class unknown"}</p></div>
            <div className="text-right"><p className="text-xs font-semibold uppercase text-emerald-800">Balance owed</p><p className="text-xl font-bold tabular-nums text-emerald-950">{ghs(selectedBalance.outstanding)}</p></div>
          </div>}
        </section>}

      {view==="accounts"&&<div className="grid gap-5 xl:grid-cols-[1fr_.9fr]">
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Student financial accounts</h2>
          <p className="mt-1 text-xs text-muted">Charges and payments from every recorded academic term, including arrears.</p>
          <div className="mt-4 max-h-[550px] overflow-auto">
            <table className="w-full min-w-[530px] text-sm">
              <thead className="border-b text-left text-xs uppercase text-muted"><tr><th className="py-3">Learner</th><th className="py-3 text-right">Charged</th><th className="py-3 text-right">Paid</th><th className="py-3 text-right">Balance</th><th className="py-3 text-right">Status</th></tr></thead>
              <tbody>{searchable.map(s=>{
                const b=balances.get(s.id)!;
                return <tr key={s.id} onClick={()=>setSelectedStudent(s.id)} className={"cursor-pointer border-b border-slate-100 hover:bg-emerald-50/50 "+(selectedStudent===s.id?"bg-emerald-50":"")}>
                  <td className="py-3"><p className="font-semibold">{fullName(s)}</p><p className="text-xs text-muted">{s.admission_number}</p></td>
                  <td className="text-right tabular-nums">{ghs(b.charged)}</td><td className="text-right tabular-nums">{ghs(b.paid)}</td><td className="text-right font-bold tabular-nums">{ghs(b.outstanding)}</td>
                  <td className="text-right text-xs font-semibold">{b.charged===0?"No fees":b.outstanding===0?"Fully paid":b.paid>0?"Part-paid":"Unpaid"}</td>
                </tr>;
              })}</tbody>
            </table>
            {!searchable.length&&<Empty>No active learners found.</Empty>}
          </div>
        </section>
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Learner charge history</h2>
          {!selected?<p className="mt-4 text-sm text-muted">Select a learner to see their item sales, assigned fees and outstanding charges.</p>:
            <div className="mt-4 space-y-3">
              {selectedCharges.map(c=><div key={c.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{c.description}</p><p className="mt-1 text-xs text-muted">{c.academic_year} · Term {c.term} · {c.category}</p></div>
                <strong className="tabular-nums">{ghs(c.amount)}</strong></div>
              </div>)}
              {!selectedCharges.length&&<Empty>No charges have been assigned yet.</Empty>}
            </div>}
        </section>
      </div>}

      {view==="fees"&&<div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Create term fee</h2>
          <p className="mt-2 text-sm text-muted">Enter the amount manually. Save as a draft, then Apply to eligible learners when reviewed.</p>
          <form onSubmit={createFee} className="mt-5 space-y-4">
            <Field label="Fee or payment name"><input className="field" required minLength={2} maxLength={150} value={feeName} onChange={e=>setFeeName(e.target.value)} placeholder="School fees, PTA levy, examination…"/></Field>
            <Field label="Amount (GH₵)"><input className="field" required type="number" min="0.01" step="0.01" value={feeAmount} onChange={e=>setFeeAmount(e.target.value)}/></Field>
            <Field label="Academic year"><input className="field" required value={feeYear} onChange={e=>setFeeYear(e.target.value)} maxLength={20}/></Field>
            <Field label="Term"><select className="field" value={feeTerm} onChange={e=>setFeeTerm(e.target.value)}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select></Field>
            <Field label="Applies to"><select className="field" value={feeClass} onChange={e=>setFeeClass(e.target.value)}><option value="">All active learners</option>{w.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
            <button className="btn-primary w-full" disabled={busy}><Plus size={16}/>Save fee draft</button>
          </form>
        </section>
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Fees and application status</h2>
          <p className="mt-1 text-xs text-muted">Applying a fee adds a term charge to each eligible active learner exactly once.</p>
          <div className="mt-5 space-y-3">{[...fees].reverse().map(f=><div key={f.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-bold">{f.name}</p><p className="mt-1 text-xs text-muted">{f.academic_year} · Term {f.term} · {w.classes.find(c=>c.id===f.class_id)?.name||"All classes"}</p>
                <span className={"mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase "+(f.status==="APPLIED"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800")}>{f.status}</span>
              </div>
              <strong className="text-lg">{ghs(f.amount)}</strong>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary !py-2" disabled={busy} onClick={()=>void applyFee(f)}>{f.status==="APPLIED"?"Apply to newly eligible learners":"Apply fees"}</button>
              {f.status==="DRAFT"&&<>
                <button className="btn-secondary !py-2" onClick={()=>{setFeeEditing(f);setFeeName(f.name);setFeeAmount(String(f.amount));}}>Edit draft</button>
                <button className="btn-secondary !py-2" onClick={()=>void deleteFee(f)} disabled={busy}><Trash2 size={14}/>Delete draft</button>
              </>}
            </div>
          </div>)}
          {!fees.length&&<Empty>No fees created yet.</Empty>}</div>
        </section>
      </div>}

      {view==="payments"&&<div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Record student payment</h2>
          <p className="mt-2 text-sm text-muted">Payments automatically settle the oldest outstanding charges first. Record the actual payment method and reference.</p>
          <form onSubmit={pay} className="mt-5 space-y-4">
            <Field label="Amount received (GH₵)"><input type="number" className="field" min="0.01" step="0.01" required value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></Field>
            <Field label="Payment mode"><select className="field" value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}>{[["CASH","Cash"],["MOMO","Mobile Money"],["BANK","Bank transfer"],["CHEQUE","Cheque"],["OTHER","Other"]].map(([key,val])=><option key={key} value={key}>{val}</option>)}</select></Field>
            <Field label="Reference / transaction ID"><input className="field" maxLength={120} value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder="MoMo or bank reference (if any)"/></Field>
            <Field label="Payment notes"><textarea className="field" maxLength={500} value={paymentNote} onChange={e=>setPaymentNote(e.target.value)} rows={2} placeholder="Optional internal notes"/></Field>
            <button className="btn-primary w-full" disabled={busy||!selected||selectedBalance.outstanding<=0}><CreditCard size={16}/>Record payment</button>
          </form>
        </section>
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Receipts and payment history</h2>
          <p className="mt-1 text-sm text-muted">{selected?"Selected learner's payments":"Select a learner to see their payment history, receipts and notifications."}</p>
          <div className="mt-4 space-y-3">{selectedPayments.map(p=><div key={p.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-bold">{ghs(Number(p.amount))} <span className="text-sm font-normal text-muted">via {p.method}</span></p>
                <p className="mt-1 break-all text-xs text-muted">{p.receipt_number} · {new Date(p.created_at).toLocaleString("en-GB")}</p>
                {p.voided_at&&<p className="mt-2 text-xs font-bold text-red-700">VOID · {p.void_reason}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <button className="btn-secondary !py-2" onClick={()=>void receipt(p)}><ArrowDownToLine size={15}/>Receipt</button>
                {!p.voided_at&&<>
                  <button className="btn-secondary !py-2" disabled={busy} onClick={()=>void notify(p)}><BellRing size={15}/>Notify</button>
                  <button className="btn-secondary !py-2 !text-red-700" disabled={busy} onClick={()=>void reverse(p)}>Reverse</button>
                </>}
              </div>
            </div>
          </div>)}
          {!selectedPayments.length&&<Empty>No payments recorded for the selected learner.</Empty>}</div>
        </section>
      </div>}

      {view==="items"&&<div className="space-y-5">
        <section className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-bold">Items and inventory</h2><p className="mt-1 text-sm text-muted">School uniforms, cloth, books, stationery and other items.</p></div>
          <button className="btn-primary" onClick={()=>setItemDraft(emptyItem())}><Plus size={16}/>Add item</button>
        </section>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{items.map(i=><article className="surface overflow-hidden rounded-2xl" key={i.id}>
          <div className="flex h-40 items-center justify-center bg-slate-100">
            {images[i.id]?<Image src={images[i.id]} alt={i.name} width={360} height={160} unoptimized className="h-full w-full object-contain"/>:<Package size={48} className="text-slate-300"/>}
          </div>
          <div className="p-5"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{i.name}</h3><p className="mt-1 text-xs text-muted">{i.description}</p></div><strong>{ghs(i.unit_price)}</strong></div>
            <p className="mt-3 text-xs text-muted">{i.stock_quantity} in stock · {i.active?"Available":"Inactive"}</p>
            <div className="mt-4 flex gap-2"><button className="btn-secondary !py-2" onClick={()=>setItemDraft({id:i.id,name:i.name,description:i.description,unit_price:String(i.unit_price),stock_quantity:String(i.stock_quantity),active:i.active,image:null})}>Edit</button>
              <button className="btn-secondary !py-2 !text-red-700" disabled={busy} onClick={()=>void removeItem(i)}>Delete</button>
            </div>
          </div>
        </article>)}</div>
        {!items.length&&<Empty>No school items added yet.</Empty>}
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Sell an item to a learner</h2>
          <form onSubmit={sell} className="mt-4 grid gap-4 sm:grid-cols-[1fr_150px_auto] sm:items-end">
            <Field label="Item"><select className="field" value={saleItem} required onChange={e=>setSaleItem(e.target.value)}><option value="">Choose item</option>{items.filter(i=>i.active&&i.stock_quantity>0).map(i=><option key={i.id} value={i.id}>{i.name} · {ghs(i.unit_price)} · {i.stock_quantity} remaining</option>)}</select></Field>
            <Field label="Quantity"><input className="field" type="number" min="1" step="1" value={saleQty} onChange={e=>setSaleQty(e.target.value)} required/></Field>
            <button className="btn-primary" disabled={busy||!selected||!saleItem}><ShoppingBag size={16}/>Record sale</button>
          </form>
          <p className="mt-3 text-xs text-muted">Sales reduce stock immediately and add an item charge to the learner. Record payment separately to issue a receipt.</p>
        </section>
        {!!sales.length&&<section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Recent item sales</h2>
          <div className="mt-3 space-y-2">{[...sales].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,20).map(s=><div key={s.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-3 text-sm">
            <span>{items.find(i=>i.id===s.item_id)?.name||"Item"} × {s.quantity} · {fullName(w.students.find(st=>st.id===s.student_id)!)||"Learner"}</span>
            <strong>{ghs(s.total)}</strong>
          </div>)}</div>
        </section>}
      </div>}

      {view==="activity"&&<section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-bold">Finance activity & notifications</h2>
        <p className="mt-2 text-sm text-muted">This is the shared finance activity trail for school Administrators and the Accountant.</p>
        <div className="mt-5 space-y-3">{events.map(e=><div key={e.id} className="flex gap-3 rounded-xl border border-slate-200 p-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><History size={17}/></span>
          <div><p className="text-sm font-semibold">{e.message}</p><p className="mt-1 text-xs text-muted">{e.kind.replaceAll("_"," ")} · {e.actor_name} · {new Date(e.created_at).toLocaleString("en-GB")}</p></div>
        </div>)}
        {!events.length&&<Empty>No finance activity recorded yet.</Empty>}</div>
      </section>}

      {feeEditing&&<Modal title="Edit fee draft" onClose={()=>{setFeeEditing(null);setFeeName("");setFeeAmount("");}}>
        <form className="space-y-4" onSubmit={editFee}>
          <Field label="Name"><input className="field" maxLength={150} required value={feeName} onChange={e=>setFeeName(e.target.value)}/></Field>
          <Field label="Amount (GH₵)"><input className="field" type="number" min="0.01" step="0.01" required value={feeAmount} onChange={e=>setFeeAmount(e.target.value)}/></Field>
          <button className="btn-primary" disabled={busy}>Save draft changes</button>
        </form>
      </Modal>}
      {itemDraft&&<Modal title={itemDraft.id?"Edit school item":"Create school item"} onClose={()=>setItemDraft(null)}>
        <form className="space-y-4" onSubmit={saveItem}>
          <Field label="Item name"><input className="field" minLength={2} maxLength={150} required value={itemDraft.name} onChange={e=>setItemDraft({...itemDraft,name:e.target.value})}/></Field>
          <Field label="Description"><textarea className="field" value={itemDraft.description} maxLength={400} onChange={e=>setItemDraft({...itemDraft,description:e.target.value})} rows={2}/></Field>
          <Field label="Unit price (GH₵)"><input className="field" type="number" min="0" step="0.01" value={itemDraft.unit_price} required onChange={e=>setItemDraft({...itemDraft,unit_price:e.target.value})}/></Field>
          <Field label="Available stock"><input className="field" type="number" min="0" step="1" value={itemDraft.stock_quantity} required onChange={e=>setItemDraft({...itemDraft,stock_quantity:e.target.value})}/></Field>
          <Field label="Item photograph (PNG, JPG or WEBP, max 2 MB)"><input className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setItemDraft({...itemDraft,image:e.target.files?.[0]||null})}/></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemDraft.active} onChange={e=>setItemDraft({...itemDraft,active:e.target.checked})}/>Available for sale</label>
          <button className="btn-primary" disabled={busy}>Save item</button>
        </form>
      </Modal>}
    </div>
  );
}
