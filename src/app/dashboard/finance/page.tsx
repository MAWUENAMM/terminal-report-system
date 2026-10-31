"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, BellRing, BookOpen, Check, CircleDollarSign,
  ClipboardList, CreditCard, History, Package, Plus, RefreshCcw,
  Search, ShoppingBag, Trash2, Wallet, FileDown, TableProperties, AlertCircle, CircleCheck, Users, Printer
} from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/components/workspace";
import { PageHeader, Empty, Field, Modal, Restricted } from "@/components/ui";
import { fullName } from "@/lib/models";
import { downloadFinanceReport, exportFinanceCsv, reportRows } from "@/lib/finance-reports";
import { calculateSaleSettlement, downloadSaleDocument, type FinanceSale } from "@/lib/finance-sale-receipt";
import {
  dueFor, downloadFinanceReceipt, ghs,
  type FinanceAllocation, type FinanceCharge, type FinancePayment
} from "@/lib/finance-receipt";

type Fee = {
  id:string;school_id:string;academic_year:string;term:number;class_id:string|null;
  name:string;category:"FEE"|"OTHER";target_student_id:string|null;amount:number;status:"DRAFT"|"APPLIED";created_at:string;
};
type Item = {
  id:string;school_id:string;name:string;description:string;unit_price:number;
  stock_quantity:number;image_path:string|null;active:boolean;
};
type Sale = FinanceSale;
type Event = {
  id:string;kind:string;message:string;actor_name:string;
  payment_id:string|null;created_at:string;
};
type View = "accounts"|"fees"|"payments"|"items"|"activity"|"reports";
type ItemDraft = { id?:string;name:string;description:string;unit_price:string;stock_quantity:string;active:boolean;image:File|null };
const emptyItem = ():ItemDraft=>({name:"",description:"",unit_price:"",stock_quantity:"0",active:true,image:null});
const moneyInput = (value:string) => /^\d{1,8}(\.\d{1,2})?$/.test(value) && Number(value)>0;
const financeStatus=(charged:number,paid:number,outstanding:number)=>{
  if(charged<=0)return {label:"No fees",classes:"bg-slate-100 text-slate-600 ring-slate-200",bar:"bg-slate-400"};
  if(outstanding<=0)return {label:"Fully paid",classes:"bg-emerald-100 text-emerald-800 ring-emerald-200",bar:"bg-emerald-500"};
  if(paid>0)return {label:"Part-paid",classes:"bg-amber-100 text-amber-800 ring-amber-200",bar:"bg-amber-500"};
  return {label:"Unpaid",classes:"bg-rose-100 text-rose-800 ring-rose-200",bar:"bg-rose-500"};
};

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
  const [latestSaleId,setLatestSaleId]=useState<string|null>(null);
  const [saleDocumentBusy,setSaleDocumentBusy]=useState<string|null>(null);
  const [events,setEvents]=useState<Event[]>([]);
  const [smsFeedback,setSmsFeedback]=useState("");
  const [extraSmsDetails,setExtraSmsDetails]=useState<Record<string,{
    phone:string;reason:string;consent:boolean;
  }>>({});
  const [images,setImages]=useState<Record<string,string>>({});
  const [search,setSearch]=useState("");
  const [selectedStudent,setSelectedStudent]=useState("");
  const initialSelection=useRef(false);
  const [feeName,setFeeName]=useState("");
  const [feeCategory,setFeeCategory]=useState<"FEE"|"OTHER">("FEE");
  const [feeAmount,setFeeAmount]=useState("");
  const [feeClass,setFeeClass]=useState("");
  const [feeScope,setFeeScope]=useState<"ALL"|"CLASS"|"STUDENT">("ALL");
  const [feeStudent,setFeeStudent]=useState("");
  const [feeTerm,setFeeTerm]=useState(String(w.school.current_term));
  const [feeYear,setFeeYear]=useState(w.school.academic_year);
  const [feeEditing,setFeeEditing]=useState<Fee|null>(null);
  const [correctingCharge,setCorrectingCharge]=useState<FinanceCharge|null>(null);
  const [correctionReason,setCorrectionReason]=useState("");
  const [paymentAmount,setPaymentAmount]=useState("");
  const [paymentMethod,setPaymentMethod]=useState("CASH");
  const [paymentReference,setPaymentReference]=useState("");
  const [paymentNote,setPaymentNote]=useState("");
  const [itemDraft,setItemDraft]=useState<ItemDraft|null>(null);
  const [saleItem,setSaleItem]=useState("");
  const [saleQty,setSaleQty]=useState("1");
  const [checkoutPayment,setCheckoutPayment]=useState<"NONE"|"FULL"|"PARTIAL">("NONE");
  const [checkoutAmount,setCheckoutAmount]=useState("");
  const [checkoutMethod,setCheckoutMethod]=useState("CASH");
  const [checkoutReference,setCheckoutReference]=useState("");
  const [payingSale,setPayingSale]=useState<Sale|null>(null);
  const [salePaymentMode,setSalePaymentMode]=useState<"NEW"|"REALLOCATE">("NEW");
  const [itemPaymentAmount,setItemPaymentAmount]=useState("");
  const [itemPaymentMethod,setItemPaymentMethod]=useState("CASH");
  const [itemPaymentReference,setItemPaymentReference]=useState("");
  const [existingPaymentId,setExistingPaymentId]=useState("");
  const [itemReassignmentReason,setItemCorrectionReason]=useState("");
  const itemPaymentRequestKey=useRef<string|null>(null);
  const reassignRequestKey=useRef<string|null>(null);
  const paymentRequestKey=useRef<string|null>(null);
  const saleRequestKey=useRef<string|null>(null);
  const checkoutPaymentRequestKey=useRef<string|null>(null);

  const load=useCallback(async()=>{
    if(!authorized)return;
    setLoading(true);setError("");
    try{
      const db=browserClient();
      const tables=["finance_fees","finance_items","finance_charges","finance_payments",
        "finance_allocations","finance_sales","finance_events"] as const;
      // Supabase Data API defaults to 1000 records per request. Paginate all ledgers:
      // silently truncating finance history would produce incorrect balances.
      const paged=async(table:string)=>{
        const rows:Record<string,unknown>[]=[];
        for(let offset=0;;offset+=500) {
          const {data,error}=await db.from(table).select("*")
            .eq("school_id",w.school.id).order("id")
            .range(offset,offset+499);
          if(error)throw new Error(error.message);
          rows.push(...(data||[]));
          if(!data||data.length<500)return rows;
          if(rows.length>100000)throw new Error("Finance history is too large for the browser report. Please contact support.");
        }
      };
      const [f,i,c,p,a,s,e]=await Promise.all(tables.map(paged));
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

  useEffect(()=>{void Promise.resolve().then(load);},[load]);
  useEffect(()=>{
    if(initialSelection.current)return;
    initialSelection.current=true;
    const id=new URLSearchParams(window.location.search).get("student");
    if(id&&w.students.some(student=>student.id===id))
      void Promise.resolve().then(()=>setSelectedStudent(id));
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
  const activePaymentIds=new Set(payments.filter(p=>!p.voided_at).map(p=>p.id));
  const chargePaid=(chargeId:string)=>allocations.filter(a=>a.charge_id===chargeId&&activePaymentIds.has(a.payment_id)).reduce((total,a)=>total+Number(a.amount),0);
  const reportData={school:w.school,students:w.students,classes:w.classes,charges,payments,allocations,items,sales};
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
    if(feeScope==="CLASS"&&!feeClass)return setError("Select the class to charge.");
    if(feeScope==="STUDENT"&&!feeStudent)return setError("Select the student to charge.");
    await perform(async()=>{
      const {error}=await browserClient().from("finance_fees").insert({
        school_id:w.school.id,academic_year:feeYear.trim(),term:Number(feeTerm),
        class_id:feeScope==="CLASS"?feeClass:null,
        target_student_id:feeScope==="STUDENT"?feeStudent:null,
        name:feeName.trim(),category:feeCategory,amount:Number(feeAmount),
        created_by:w.profile.id
      });
      if(error)throw new Error(error.message);
      setFeeName("");setFeeAmount("");setFeeCategory("FEE");setFeeScope("ALL");setFeeStudent("");setFeeClass("");
    },"Fee draft created. Review it before applying to learners.");
  }
  async function applyFee(fee:Fee){
    const scope=fee.target_student_id?
      (students.find(s=>s.id===fee.target_student_id)?fullName(students.find(s=>s.id===fee.target_student_id)!):"the selected learner"):
      fee.class_id?(w.classes.find(c=>c.id===fee.class_id)?.name||"the selected class"):"ALL active learners";
    if(!confirm("Apply "+fee.name+" ("+ghs(fee.amount)+") to "+scope+"? This creates real charges in the TEST school. The draft becomes locked; duplicate charges are prevented."))return;
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
        .update({name:feeName.trim(),category:feeCategory,amount:Number(feeAmount)}).eq("id",feeEditing.id).eq("status","DRAFT")
        .select("id").single();
      if(error)throw new Error(error.message);
      setFeeEditing(null);setFeeName("");setFeeAmount("");setFeeCategory("FEE");
    },"Fee draft updated.");
  }
  async function deleteFee(fee:Fee){
    if(!confirm("Delete the unapplied fee draft '"+fee.name+"'?"))return;
    await perform(async()=>{
      const {error}=await browserClient().from("finance_fees").delete().eq("id",fee.id).eq("status","DRAFT");
      if(error)throw new Error(error.message);
    },"Draft removed.");
  }
  async function voidCharge(event:FormEvent){
    event.preventDefault();
    if(!correctingCharge)return;
    if(correctionReason.trim().length<8||correctionReason.trim().length>500) {
      setError("Enter an explanation between 8 and 500 characters.");
      return;
    }
    const ok=await run(async()=>{
      await invoke("finance_void_charge",{p_charge_id:correctingCharge.id,p_reason:correctionReason.trim()});
    },"Charge cancelled with an audit entry. Student balance updated.");
    if(ok){setCorrectingCharge(null);setCorrectionReason("");await load();}
  }
  async function pay(event:FormEvent){
    event.preventDefault();
    if(!selected || !moneyInput(paymentAmount))return setError("Choose a learner and a valid payment amount.");
    if(Math.round(Number(paymentAmount)*100)>Math.round(selectedBalance.outstanding*100)){
      return setError("The payment exceeds the student's current outstanding amount.");
    }
    paymentRequestKey.current ||= crypto.randomUUID();
    await perform(async()=>{
      await invoke("finance_record_payment",{
        p_student_id:selected.id,p_amount:Number(paymentAmount),
        p_method:paymentMethod,p_reference:paymentReference.trim(),p_note:paymentNote.trim(),
        p_request_key:paymentRequestKey.current
      });
      paymentRequestKey.current=null;
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
    const extra=extraSmsDetails[payment.id];
    const custom=Boolean(extra?.phone.trim());
    if(custom){
      if(w.profile.role!=="ADMIN")return setError("Only the School Administrator may add an SMS recipient.");
      if(!/^((0[25]\d{8})|(233[25]\d{8})|(\+233[25]\d{8}))$/.test(extra.phone.replace(/[\s()-]/g,"")))
        return setError("Enter a valid Ghanaian mobile number for the additional recipient.");
      if(!extra.consent||extra.reason.trim().length<8)
        return setError("Confirm consent and explain why the recipient may view the learner's payment details.");
    }
    setSmsFeedback("");
    let message="An in-app payment alert was recorded.";
    const success=await run(async()=>{
      await invoke("finance_notify_payment",{p_payment_id:payment.id});
      const {data,error:gatewayError}=await browserClient().functions.invoke("sms-gateway",{
        body:{action:"notify",payment_id:payment.id,...(custom?{
          extra_phone:extra.phone.trim(),extra_consent:extra.consent,extra_reason:extra.reason.trim()
        }:{})}
      });
      if(gatewayError){
        message="The in-app alert was recorded, but SMS could not be checked. No delivery is confirmed.";
        return;
      }
      if(data?.mode==="PREVIEW"){
        message="In-app alert recorded. Real SMS is not enabled yet. "+
          (data.eligible||0)+" staff members are opted in to receive SMS when the service is activated."+
          (custom?" No additional SMS was sent.":"");
      }else if(data?.mode==="LIVE"){
        message="In-app alert recorded. Arkesel accepted "+
          (data.submitted||0)+" SMS request(s). Delivery to phones is not yet confirmed.";
      }else if(data?.mode==="CONFIG_PENDING"){
        message="In-app alert recorded. SMS sending is waiting for secure provider activation.";
      }else if(data?.mode==="READY"){
        message="In-app alert recorded. No new SMS requests; duplicate alerts were prevented.";
      }else{
        message="In-app alert recorded. SMS delivery status is unavailable.";
      }
    },"Payment notification processed.");
    if(success){setSmsFeedback(message);await load();}
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
  const itemAtCheckout=items.find(i=>i.id===saleItem);
  const checkoutTotal=itemAtCheckout?Math.round(Number(itemAtCheckout.unit_price)*Number(saleQty)*100)/100:0;
  function openSalePayment(sale:Sale){
    const charge=charges.find(c=>c.sale_id===sale.id&&!c.voided_at);
    const settlement=charge?calculateSaleSettlement(sale,charge,allocations,payments):null;
    setPayingSale(sale);
    setSalePaymentMode("NEW");
    setItemPaymentAmount(String(settlement?.balance||""));
    setExistingPaymentId("");
    setItemCorrectionReason("");
    itemPaymentRequestKey.current=null;
    reassignRequestKey.current=null;
  }
  async function submitItemPayment(event:FormEvent){
    event.preventDefault();
    if(!payingSale)return;
    const sale=payingSale;
    const charge=charges.find(c=>c.sale_id===sale.id&&!c.voided_at);
    if(!charge)return setError("The original item charge is missing.");
    const remaining=calculateSaleSettlement(sale,charge,allocations,payments).balance;
    const amount=Number(itemPaymentAmount);
    if(!moneyInput(itemPaymentAmount)||amount>remaining)return setError("Amount must be positive and cannot exceed this item's remaining balance.");
    if(salePaymentMode==="REALLOCATE"){
      if(!existingPaymentId||itemReassignmentReason.trim().length<8)return setError("Select a previously recorded payment and explain the correction.");
      reassignRequestKey.current ||= crypto.randomUUID();
      const ok=await run(async()=>{
        await invoke("finance_reassign_payment_to_sale",{
          p_payment_id:existingPaymentId,p_sale_id:sale.id,p_amount:amount,
          p_reason:itemReassignmentReason.trim(),p_request_key:reassignRequestKey.current
        });
      },"Existing payment corrected and allocated to the purchased item; no new money recorded.");
      if(ok){reassignRequestKey.current=null;setPayingSale(null);await load();}
    }else{
      itemPaymentRequestKey.current ||= crypto.randomUUID();
      const ok=await run(async()=>{
        await invoke("finance_record_item_payment",{
          p_sale_id:sale.id,p_amount:amount,p_method:itemPaymentMethod,
          p_reference:itemPaymentReference.trim(),p_note:"Item purchase payment",
          p_request_key:itemPaymentRequestKey.current
        });
      },"Item payment recorded and linked directly to this sale. Receipt available.");
      if(ok){itemPaymentRequestKey.current=null;setPayingSale(null);await load();}
    }
  }
  async function sell(event:FormEvent){
    event.preventDefault();
    if(!selected)return setError("Select a learner before selling an item.");
    const quantity=Number(saleQty);
    if(!itemAtCheckout||!Number.isSafeInteger(quantity)||quantity<1||quantity>itemAtCheckout.stock_quantity)
      return setError("Select an available item and a valid quantity.");
    if(checkoutPayment!=="NONE"){
      const amount=checkoutPayment==="FULL"?checkoutTotal:Number(checkoutAmount);
      if(!Number.isFinite(amount)||amount<=0||amount>checkoutTotal||
        Math.round(amount*100)!==amount*100 && Math.abs(Math.round(amount*100)-amount*100)>1e-6)
        return setError("Enter a valid item payment not exceeding the total.");
      if(checkoutPayment==="PARTIAL"&&amount>=checkoutTotal)
        return setError("Choose Pay in full for the full item price.");
    }
    saleRequestKey.current ||= crypto.randomUUID();
    if(checkoutPayment!=="NONE")checkoutPaymentRequestKey.current ||= crypto.randomUUID();
    const ok=await run(async()=>{
      let saleId:string;
      if(checkoutPayment==="NONE"){
        saleId=await invoke<string>("finance_sell_item",{
          p_item_id:saleItem,p_student_id:selected.id,p_quantity:quantity,
          p_request_key:saleRequestKey.current
        });
      }else{
        const response=await invoke<{sale_id:string;payment_id:string}>("finance_sell_item_paid",{
          p_item_id:saleItem,p_student_id:selected.id,p_quantity:quantity,
          p_sale_request_key:saleRequestKey.current,
          p_payment_request_key:checkoutPaymentRequestKey.current,
          p_amount:checkoutPayment==="FULL"?checkoutTotal:Number(checkoutAmount),
          p_method:checkoutMethod,p_reference:checkoutReference.trim()
        });
        saleId=response.sale_id;
      }
      setLatestSaleId(saleId);
      saleRequestKey.current=null;checkoutPaymentRequestKey.current=null;
      setSaleQty("1");setSaleItem("");setCheckoutPayment("NONE");
      setCheckoutAmount("");setCheckoutReference("");
    },checkoutPayment==="NONE"?
      "Sale recorded. The item is marked payment pending until money is received.":
      "Sale and item payment recorded together. Download the paid receipt below.");
    if(ok)await load();
  }
  async function saleDocument(sale:Sale,mode:"download"|"print"){
    // Open a tab from the actual click: browsers otherwise block an asynchronous print preview.
    const tab=mode==="print"?window.open("","_blank"):null;
    if(tab){tab.document.title="Preparing item sale document";tab.document.body.textContent="Preparing printable document…";}
    setSaleDocumentBusy(sale.id);
    setError("");
    try{
      const student=w.students.find(st=>st.id===sale.student_id);
      const item=items.find(i=>i.id===sale.item_id);
      const charge=charges.find(c=>c.sale_id===sale.id&&!c.voided_at);
      if(!student||!item||!charge)throw new Error("Sale invoice cannot be generated because the student, item or recorded charge is missing. Refresh finance records and try again.");
      await downloadSaleDocument({
        school:w.school,student,cls:w.classes.find(c=>c.id===student.class_id),
        sale,item,charge,payments,allocations,
        recordedBy:w.staff.find(p=>p.id===sale.created_by)?.full_name||"School finance office",
        itemImageUrl:images[item.id]
      },mode,tab);
    }catch(e){
      tab?.close();
      setError(e instanceof Error?e.message:"Could not prepare the sale document.");
    }finally{setSaleDocumentBusy(null);}
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
    {key:"activity",title:"Finance activity",icon:History},
    {key:"reports",title:"Download reports",icon:FileDown}
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="School operations · Finance" title="Finance & Accounting"
        description={"Fee management, balances, student payments, inventory sales and traceable receipts for "+w.school.name+". All values are Ghana cedis."}>
        <button className="btn-primary" onClick={()=>downloadFinanceReport(reportData,"all")} disabled={loading||busy}>
          <FileDown size={16}/> Full finance report
        </button>
        <button className="btn-secondary" onClick={()=>void load()} disabled={loading||busy}>
          <RefreshCcw size={16}/> Refresh
        </button>
      </PageHeader>

      {smsFeedback&&<div role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
        <BellRing size={18} className="mt-0.5 shrink-0"/><div className="flex-1">{smsFeedback}</div>
        <button type="button" className="text-amber-800" onClick={()=>setSmsFeedback("")} aria-label="Dismiss SMS status">✕</button>
      </div>}
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
              <select className="field" value={selectedStudent} onChange={e=>{setSelectedStudent(e.target.value);paymentRequestKey.current=null;saleRequestKey.current=null;}}>
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

      {view==="accounts"&&<div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#09563e] via-[#116e53] to-[#168365] px-5 py-5 text-white sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-100">Student finance records</div>
                <h2 className="mt-2 text-xl font-bold tracking-tight">Student financial accounts</h2>
                <p className="mt-2 text-xs text-emerald-50">Live outstanding balances across all recorded terms and items.</p>
              </div>
              <span className="rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-sm font-bold">{searchable.length} learners</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-4">
            {[
              ["Fully paid", "bg-emerald-100 text-emerald-800", students.filter(st=>{const b=balances.get(st.id)!;return b.charged>0&&b.outstanding<=0;}).length],
              ["Part-paid","bg-amber-100 text-amber-800",students.filter(st=>{const b=balances.get(st.id)!;return b.charged>0&&b.paid>0&&b.outstanding>0;}).length],
              ["Unpaid","bg-rose-100 text-rose-800",students.filter(st=>{const b=balances.get(st.id)!;return b.charged>0&&b.paid===0;}).length],
              ["No fees","bg-slate-100 text-slate-700",students.filter(st=>balances.get(st.id)!.charged<=0).length]
            ].map(([title,classes,count])=><span key={String(title)} className={"rounded-full px-3 py-1.5 text-xs font-semibold "+String(classes)}>{String(title)}: {String(count)}</span>)}
          </div>
          <div className="max-h-[580px] overflow-auto p-3 sm:p-4">
            <table className="w-full min-w-[570px] border-separate border-spacing-y-2 text-sm">
              <thead className="text-left text-[10px] font-bold uppercase tracking-[.08em] text-slate-500">
                <tr><th className="px-3 py-2">Student</th><th className="px-3 py-2 text-right">Charged</th>
                  <th className="px-3 py-2 text-right">Paid</th><th className="px-3 py-2 text-right">Balance</th>
                  <th className="px-3 py-2 text-right">Status</th></tr>
              </thead>
              <tbody>{searchable.map(st=>{
                const b=balances.get(st.id)!;
                const status=financeStatus(b.charged,b.paid,b.outstanding);
                const progress=b.charged>0?Math.min(100,Math.max(0,Math.round(b.paid/b.charged*100))):0;
                return <tr key={st.id} onClick={()=>setSelectedStudent(st.id)}
                  className={"cursor-pointer rounded-xl outline-none transition hover:shadow-sm focus-within:ring-2 focus-within:ring-emerald-300 "+(selectedStudent===st.id?"bg-emerald-50":"bg-slate-50 hover:bg-emerald-50/70")}>
                  <td className="rounded-l-xl px-3 py-3">
                    <button className="text-left" type="button" onClick={()=>setSelectedStudent(st.id)}>
                      <span className="font-bold text-slate-900">{fullName(st)}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{st.admission_number} · {w.classes.find(c=>c.id===st.class_id)?.name||"Student"}</span>
                    </button>
                    <div className="mt-2 h-1.5 w-full max-w-[165px] rounded-full bg-slate-200" aria-label={"Payment progress "+progress+"%"}>
                      <div className={"h-1.5 rounded-full "+status.bar} style={{width:progress+"%"}}/>
                    </div>
                  </td>
                  <td className="px-3 text-right font-medium tabular-nums">{ghs(b.charged)}</td>
                  <td className="px-3 text-right font-semibold tabular-nums text-emerald-700">{ghs(b.paid)}</td>
                  <td className={"px-3 text-right font-bold tabular-nums "+(b.outstanding>0?"text-rose-700":"text-slate-900")}>{ghs(b.outstanding)}</td>
                  <td className="rounded-r-xl px-3 text-right"><span className={"inline-flex whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ring-1 "+status.classes}>{status.label}</span></td>
                </tr>;
              })}</tbody>
            </table>
            {!searchable.length&&<Empty>No active students match your search.</Empty>}
          </div>
        </section>
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Student charges and corrections</h2>
          <p className="mt-1 text-xs leading-5 text-muted">Select a student to review what they owe, what has been paid, and any fee that needs correcting.</p>
          {!selected?<p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Select a student on the left to see individual charges.</p>:
            <div className="mt-4 space-y-3">
              {selectedCharges.map(c=>{
                const paid=chargePaid(c.id);
                const remaining=Math.max(0,Number(c.amount)-paid);
                return <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-bold text-slate-900">{c.description}</p>
                      <p className="mt-1 text-xs text-slate-500">{c.academic_year} · Term {c.term} · {c.category}</p></div>
                    <strong className="whitespace-nowrap text-sm tabular-nums">{ghs(Number(c.amount))}</strong>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-600">Paid: {ghs(paid)}</span>
                    <span className={remaining>0?"font-bold text-rose-700":"font-bold text-emerald-700"}>Due: {ghs(remaining)}</span>
                  </div>
                  {c.category!=="ITEM"&&<button type="button" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                      onClick={()=>{setCorrectingCharge(c);setCorrectionReason("");}}><AlertCircle size={14}/> Void / correct this fee</button>}
                </div>;
              })}
              {!selectedCharges.length&&<Empty>No charges assigned to this student.</Empty>}
            </div>}
        </section>
      </div>}

      {view==="fees"&&<div className="grid gap-5 xl:grid-cols-[.75fr_1.25fr]">
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Create term fee</h2>
          <p className="mt-2 text-sm text-muted">Enter the amount manually. Save as a draft, then Apply to eligible learners when reviewed.</p>
          <form onSubmit={createFee} className="mt-5 space-y-4">
            <Field label="Fee or payment name"><input className="field" required minLength={2} maxLength={150} value={feeName} onChange={e=>setFeeName(e.target.value)} placeholder="School fees, PTA levy, examination…"/></Field>
            <Field label="Charge type"><select className="field" value={feeCategory} onChange={e=>setFeeCategory(e.target.value as "FEE"|"OTHER")}><option value="FEE">Term school fee</option><option value="OTHER">Other custom levy or payment</option></select></Field>
            <Field label="Amount (GHS)"><input className="field" required type="number" min="0.01" step="0.01" value={feeAmount} onChange={e=>setFeeAmount(e.target.value)}/></Field>
            <Field label="Academic year"><input className="field" required value={feeYear} onChange={e=>setFeeYear(e.target.value)} maxLength={20}/></Field>
            <Field label="Term"><select className="field" value={feeTerm} onChange={e=>setFeeTerm(e.target.value)}>{[1,2,3].map(t=><option key={t} value={t}>Term {t}</option>)}</select></Field>
            <Field label="Who should receive this charge?">
              <select className="field" value={feeScope} onChange={e=>setFeeScope(e.target.value as "ALL"|"CLASS"|"STUDENT")}>
                <option value="ALL">All active students</option>
                <option value="CLASS">One class</option>
                <option value="STUDENT">One specific student</option>
              </select>
            </Field>
            {feeScope==="CLASS"&&<Field label="Choose class"><select className="field" required value={feeClass} onChange={e=>setFeeClass(e.target.value)}>
              <option value="">Select class…</option>{w.classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select></Field>}
            {feeScope==="STUDENT"&&<Field label="Choose student"><select className="field" required value={feeStudent} onChange={e=>setFeeStudent(e.target.value)}>
              <option value="">Select student…</option>{students.map(st=><option key={st.id} value={st.id}>{fullName(st)} · {st.admission_number}</option>)}
            </select></Field>}
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Charges are saved as a draft first. <strong>Apply fees</strong> is the separate, final step that assigns the charge to the chosen students.</div>
            <button className="btn-primary w-full" disabled={busy}><Plus size={16}/>Save fee draft</button>
          </form>
        </section>
        <section className="surface rounded-2xl p-5">
          <h2 className="text-lg font-bold">Fees and application status</h2>
          <p className="mt-1 text-xs text-muted">Applying a fee adds a term charge to each eligible active learner exactly once.</p>
          <div className="mt-5 space-y-3">{[...fees].reverse().map(f=><div key={f.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="font-bold">{f.name}</p><p className="mt-1 text-xs text-muted">{f.academic_year} · Term {f.term} · {f.category==="OTHER"?"Custom charge":"School fee"} · {f.target_student_id?("Student: "+(students.find(st=>st.id===f.target_student_id)?fullName(students.find(st=>st.id===f.target_student_id)!):"Selected student")):(f.class_id?(w.classes.find(c=>c.id===f.class_id)?.name||"Selected class"):"All classes")}</p>
                <span className={"mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase "+(f.status==="APPLIED"?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-800")}>{f.status}</span>
              </div>
              <strong className="text-lg">{ghs(f.amount)}</strong>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary !py-2" disabled={busy} onClick={()=>void applyFee(f)}>{f.status==="APPLIED"?"Apply to newly eligible students":"Apply fees"}</button>
              {f.status==="DRAFT"&&<>
                <button className="btn-secondary !py-2" onClick={()=>{setFeeEditing(f);setFeeName(f.name);setFeeCategory(f.category);setFeeAmount(String(f.amount));}}>Edit draft</button>
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
            <Field label="Amount received (GHS)"><input type="number" className="field" min="0.01" step="0.01" required value={paymentAmount} onChange={e=>{setPaymentAmount(e.target.value);paymentRequestKey.current=null;}}/></Field>
            <Field label="Payment mode"><select className="field" value={paymentMethod} onChange={e=>{setPaymentMethod(e.target.value);paymentRequestKey.current=null;}}>{[["CASH","Cash"],["MOMO","Mobile Money"],["BANK","Bank transfer"],["CHEQUE","Cheque"],["OTHER","Other"]].map(([key,val])=><option key={key} value={key}>{val}</option>)}</select></Field>
            <Field label="Reference / transaction ID"><input className="field" maxLength={120} value={paymentReference} onChange={e=>{setPaymentReference(e.target.value);paymentRequestKey.current=null;}} placeholder="MoMo or bank reference (if any)"/></Field>
            <Field label="Payment notes"><textarea className="field" maxLength={500} value={paymentNote} onChange={e=>{setPaymentNote(e.target.value);paymentRequestKey.current=null;}} rows={2} placeholder="Optional internal notes"/></Field>
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
                  <button className="btn-secondary !py-2" disabled={busy} onClick={()=>void notify(p)}><BellRing size={15}/>Notify in-app + SMS</button>
                  <button className="btn-secondary !py-2 !text-red-700" disabled={busy} onClick={()=>void reverse(p)}>Reverse</button>
                </>}
              </div>
            </div>
            {!p.voided_at&&w.profile.role==="ADMIN"&&
              <details className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
                <summary className="cursor-pointer text-xs font-semibold text-emerald-800">
                  Optional: additional authorized SMS recipient
                </summary>
                <div className="mt-3 grid gap-3">
                  <Field label="Additional phone number">
                    <input type="tel" inputMode="tel" autoComplete="off" className="field"
                      maxLength={20} placeholder="0241234567 or +233241234567"
                      value={extraSmsDetails[p.id]?.phone||""}
                      onChange={e=>setExtraSmsDetails(prev=>({
                        ...prev,[p.id]:{phone:e.target.value,reason:prev[p.id]?.reason||"",
                          consent:prev[p.id]?.consent||false}
                      }))}/>
                  </Field>
                  <Field label="Recipient's role or authorization reason">
                    <input className="field" maxLength={120} placeholder="Parent, guardian, or school proprietor"
                      value={extraSmsDetails[p.id]?.reason||""}
                      onChange={e=>setExtraSmsDetails(prev=>({
                        ...prev,[p.id]:{phone:prev[p.id]?.phone||"",reason:e.target.value,
                          consent:prev[p.id]?.consent||false}
                      }))}/>
                  </Field>
                  <label className="flex items-start gap-2 text-xs text-slate-700">
                    <input type="checkbox" className="mt-0.5 accent-emerald-700"
                      checked={extraSmsDetails[p.id]?.consent||false}
                      onChange={e=>setExtraSmsDetails(prev=>({
                        ...prev,[p.id]:{phone:prev[p.id]?.phone||"",
                          reason:prev[p.id]?.reason||"",consent:e.target.checked}
                      }))}/>
                    <span>I confirm that this person has consented to receive this student&apos;s payment details by SMS and is authorized to view them.</span>
                  </label>
                  <p className="text-xs text-muted">Click Notify above to alert opted-in finance staff and this optional recipient. One extra number per payment; each SMS may consume a credit.</p>
                </div>
              </details>}
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
          <form onSubmit={sell} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_150px] sm:items-end">
            <Field label="Item"><select className="field" value={saleItem} required onChange={e=>{setSaleItem(e.target.value);saleRequestKey.current=null;}}><option value="">Choose item</option>{items.filter(i=>i.active&&i.stock_quantity>0).map(i=><option key={i.id} value={i.id}>{i.name} · {ghs(i.unit_price)} · {i.stock_quantity} remaining</option>)}</select></Field>
            <Field label="Quantity"><input className="field" type="number" min="1" step="1" value={saleQty} onChange={e=>{setSaleQty(e.target.value);saleRequestKey.current=null;}} required/></Field>
            </div>
            {itemAtCheckout&&checkoutTotal>0&&<p className="text-sm font-semibold text-slate-700">Purchase total: <span className="text-emerald-800">{ghs(checkoutTotal)}</span></p>}
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <Field label="Has the student paid for this item?">
                <select className="field" value={checkoutPayment} onChange={e=>{setCheckoutPayment(e.target.value as "NONE"|"FULL"|"PARTIAL");checkoutPaymentRequestKey.current=null;}}>
                  <option value="NONE">No payment yet — mark as pending</option>
                  <option value="FULL">Yes — paid the full item price</option>
                  <option value="PARTIAL">Yes — paid part of the item price</option>
                </select>
              </Field>
              {checkoutPayment!=="NONE"&&<div className="mt-3 grid gap-3 md:grid-cols-2">
                {checkoutPayment==="PARTIAL"&&<Field label="Amount received (GHS)">
                  <input type="number" className="field" min="0.01" max={checkoutTotal||undefined} step="0.01" required
                    value={checkoutAmount} onChange={e=>{setCheckoutAmount(e.target.value);checkoutPaymentRequestKey.current=null;}}/>
                </Field>}
                <Field label="How was payment made?">
                  <select className="field" value={checkoutMethod} onChange={e=>{setCheckoutMethod(e.target.value);checkoutPaymentRequestKey.current=null;}}>
                    <option value="CASH">Cash</option><option value="MOMO">Mobile Money</option>
                    <option value="BANK">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Payment reference (optional)">
                  <input className="field" maxLength={120} value={checkoutReference} placeholder="MoMo or transfer reference"
                    onChange={e=>{setCheckoutReference(e.target.value);checkoutPaymentRequestKey.current=null;}}/>
                </Field>
              </div>}
              <p className="mt-3 text-xs leading-5 text-emerald-900">Payments entered here go directly to this item, not to older outstanding school fees. The sale and payment are saved together, or neither is saved.</p>
            </div>
            <button className="btn-primary" disabled={busy||!selected||!saleItem}><ShoppingBag size={16}/>{checkoutPayment==="NONE"?"Record sale — payment pending":"Record sale and item payment"}</button>
          </form>
          <p className="mt-3 text-xs leading-5 text-muted">Item charges are recorded when purchased. If the student pays later, use Pay for item beside that sale so the payment goes to the intended purchase.</p>
          {latestSaleId&&(()=>{
            const sale=sales.find(x=>x.id===latestSaleId);
            const charge=charges.find(c=>c.sale_id===latestSaleId&&!c.voided_at);
            if(!sale)return <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Sale saved. The document will be available in Recent item sales after refreshing records.</div>;
            const settlement=charge?calculateSaleSettlement(sale,charge,allocations,payments):null;
            return <div className="mt-5 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4">
              <div className="flex items-start gap-3">
                <CircleCheck className="mt-0.5 shrink-0 text-emerald-700" size={22}/>
                <div className="flex-1">
                  <p className="font-bold text-emerald-950">Sale recorded successfully</p>
                  <p className="mt-1 text-xs text-emerald-900">Item purchase document ready for {w.students.find(st=>st.id===sale.student_id)?fullName(w.students.find(st=>st.id===sale.student_id)!):"the learner"} · {ghs(Number(sale.total))}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="btn-primary !py-2" type="button" disabled={!charge||saleDocumentBusy===sale.id} onClick={()=>void saleDocument(sale,"download")}><FileDown size={16}/>Download receipt / invoice</button>
                    <button className="btn-secondary !py-2" type="button" disabled={!charge||saleDocumentBusy===sale.id} onClick={()=>void saleDocument(sale,"print")}><Printer size={16}/>Print</button>
                    {settlement&&<span className={"inline-flex items-center rounded-full px-3 py-1 text-xs font-bold "+(settlement.status==="PAID"?"bg-emerald-100 text-emerald-800":settlement.status==="PART_PAID"?"bg-amber-100 text-amber-800":"bg-rose-100 text-rose-800")}>{settlement.status==="PAID"?"Fully paid":settlement.status==="PART_PAID"?"Part-paid":"Payment pending"}</span>}
                  </div>
                </div>
              </div>
            </div>;
          })()}
        </section>
        {!!sales.length&&<section className="surface overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold">Item sales & printable receipts</h2>
            <p className="mt-1 text-xs text-slate-600">Download or print any recorded item sale. Documents show the actual payment status for that item, including partial payments.</p>
          </div>
          <div className="max-h-[700px] divide-y divide-slate-100 overflow-auto">
            {[...sales].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(s=>{
              const charge=charges.find(c=>c.sale_id===s.id&&!c.voided_at);
              const settlement=charge?calculateSaleSettlement(s,charge,allocations,payments):null;
              const student=w.students.find(st=>st.id===s.student_id);
              return <div key={s.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 text-sm hover:bg-slate-50">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><ShoppingBag size={19}/></span>
                  <div>
                    <p className="font-bold text-slate-900">{items.find(i=>i.id===s.item_id)?.name||"School item"} × {s.quantity}</p>
                    <p className="mt-1 text-xs text-slate-600">{student?fullName(student):"Student record unavailable"} · {new Date(s.created_at).toLocaleDateString("en-GB")}</p>
                    <p className="mt-1 text-xs font-bold text-slate-900">{ghs(Number(s.total))}</p>
                    {settlement&&<span className={"mt-2 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold "+(settlement.status==="PAID"?"bg-emerald-100 text-emerald-800":settlement.status==="PART_PAID"?"bg-amber-100 text-amber-800":"bg-rose-100 text-rose-800")}>
                      {settlement.status==="PAID"?"Paid in full":settlement.status==="PART_PAID"?"Part-paid · "+ghs(settlement.balance)+" due":"Unpaid · "+ghs(settlement.balance)+" due"}
                    </span>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-primary !py-2" disabled={!charge||saleDocumentBusy===s.id} onClick={()=>void saleDocument(s,"download")}>
                    <FileDown size={15}/>Download PDF
                  </button>
                  <button type="button" className="btn-secondary !py-2" disabled={!charge||saleDocumentBusy===s.id} onClick={()=>void saleDocument(s,"print")}>
                    <Printer size={15}/>Print
                  </button>
                  {settlement&&settlement.balance>0&&student&&<button type="button" className="btn-secondary !py-2" onClick={()=>openSalePayment(s)}>
                    <CreditCard size={15}/>Pay for item
                  </button>}
                </div>
              </div>;
            })}
          </div>
        </section>}
      </div>}

      {view==="reports"&&<section className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#09553d] to-[#198064] px-6 py-6 text-white">
            <div className="flex items-center gap-3"><FileDown size={26}/><div>
              <h2 className="text-xl font-bold">School Finance Reports & Exports</h2>
              <p className="mt-1 text-sm text-emerald-100">Download school-wide records, including fees, receipts, balances and shop sales.</p>
            </div></div>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {([
              ["all","Consolidated financial report","Every student's balance, payment history, charges, inventory and item sales.",Wallet],
              ["accounts","Student account balances","Who has paid, owes money, or has no fees.",Users],
              ["payments","Payment transactions","All receipt numbers, payment modes, dates and reversals.",CreditCard],
              ["charges","Charges and fees","Term fees, custom levies and item charges, including voided entries.",ClipboardList],
              ["inventory","Items and sales","Inventory valuation, stock levels and item sales history.",ShoppingBag]
            ] as const).map(([key,title,description,Icon])=><article key={key} className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div><span className="inline-grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Icon size={19}/></span>
                <h3 className="mt-3 font-bold text-slate-900">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-600">{description}</p>
              </div>
              <button type="button" disabled={loading||busy} className="btn-primary w-full" onClick={()=>downloadFinanceReport(reportData,key)}>
                <FileDown size={16}/> Download PDF
              </button>
            </article>)}
          </div>
        </div>
        <div className="surface rounded-2xl p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold"><TableProperties size={20} className="text-emerald-700"/> Spreadsheet-ready CSV exports</h2>
          <p className="mt-2 text-sm text-muted">Open in Excel or Google Sheets for analysis. Reports include all stored academic years and terms; reversed transactions remain clearly marked.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" className="btn-secondary" disabled={loading||busy} onClick={()=>exportFinanceCsv(reportRows(reportData).balances,["Admission","Student","Class","Charged","Paid","Outstanding","Status"],"student-finance-balances.csv")}>
              <FileDown size={16}/> Student balances CSV
            </button>
            <button type="button" className="btn-secondary" disabled={loading||busy} onClick={()=>exportFinanceCsv(reportRows(reportData).payments,["Date","Receipt Number","Student","Payment Method","Reference","Amount","Status"],"finance-payments.csv")}>
              <FileDown size={16}/> Payments CSV
            </button>
            <button type="button" className="btn-secondary" disabled={loading||busy} onClick={()=>exportFinanceCsv(reportRows(reportData).charges,["Date","Student","Description","Academic Year / Term","Type","Amount","Status"],"finance-charges.csv")}>
              <FileDown size={16}/> Charges CSV
            </button>
            <button type="button" className="btn-secondary" disabled={loading||busy} onClick={()=>exportFinanceCsv(reportRows(reportData).items,["Item","Unit Price","Stock","Stock Value","Status"],"finance-inventory.csv")}>
              <FileDown size={16}/> Inventory CSV
            </button>
          </div>
          <p className="mt-4 text-xs text-muted">These reports reflect current records at download time; receipt PDFs remain linked to individual payment transactions.</p>
        </div>
      </section>}

      {view==="activity"&&<section className="surface rounded-2xl p-5">
        <h2 className="text-lg font-bold">Finance activity & notifications</h2>
        <p className="mt-2 text-sm text-muted">This is the shared finance activity trail for school Administrators and the Accountant.</p>
        <div className="mt-5 space-y-3">{events.map(e=><div key={e.id} className="flex gap-3 rounded-xl border border-slate-200 p-4">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><History size={17}/></span>
          <div><p className="text-sm font-semibold">{e.message}</p><p className="mt-1 text-xs text-muted">{e.kind.replaceAll("_"," ")} · {e.actor_name} · {new Date(e.created_at).toLocaleString("en-GB")}</p></div>
        </div>)}
        {!events.length&&<Empty>No finance activity recorded yet.</Empty>}</div>
      </section>}

      {payingSale&&(()=>{
        const student=w.students.find(st=>st.id===payingSale.student_id);
        const item=items.find(i=>i.id===payingSale.item_id);
        const charge=charges.find(c=>c.sale_id===payingSale.id&&!c.voided_at);
        const settlement=charge?calculateSaleSettlement(payingSale,charge,allocations,payments):null;
        const availablePayments=payments.filter(p=>
          p.student_id===payingSale.student_id&&!p.voided_at &&
          allocations.some(a=>a.payment_id===p.id&&a.charge_id!==charge?.id)
        );
        return <Modal title="Pay for this item purchase" onClose={()=>setPayingSale(null)}>
          <div className="space-y-4">
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="font-bold text-emerald-950">{item?.name||"Item"} × {payingSale.quantity} · {student?fullName(student):"Student"}</p>
              <p className="mt-2 text-sm">Item price: <strong>{ghs(Number(payingSale.total))}</strong></p>
              <p className="mt-1 text-sm">Already applied to this item: <strong>{ghs(settlement?.paid||0)}</strong></p>
              <p className="mt-1 text-sm">Remaining for this item: <strong className="text-rose-700">{ghs(settlement?.balance||0)}</strong></p>
            </div>
            <form className="space-y-4" onSubmit={submitItemPayment}>
              <Field label="What happened to the payment?">
                <select className="field" value={salePaymentMode} onChange={e=>{
                  setSalePaymentMode(e.target.value as "NEW"|"REALLOCATE");
                  itemPaymentRequestKey.current=null;reassignRequestKey.current=null;
                }}>
                  <option value="NEW">Record a new payment collected for this item</option>
                  <option value="REALLOCATE">Correct a payment already recorded for this student</option>
                </select>
              </Field>
              {salePaymentMode==="REALLOCATE"&&<div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
                <p><strong>Correct an earlier allocation — no new cash received.</strong> This transfers an already recorded payment from older charges to this item, increasing the older charge&apos;s outstanding balance accordingly.</p>
                <Field label="Existing payment to correct">
                  <select className="field" required value={existingPaymentId} onChange={e=>{setExistingPaymentId(e.target.value);reassignRequestKey.current=null;}}>
                    <option value="">Select a payment</option>
                    {availablePayments.map(p=><option key={p.id} value={p.id}>
                      {p.receipt_number} · {ghs(Number(p.amount))} · {p.method}
                    </option>)}
                  </select>
                </Field>
                {availablePayments.length===0&&<p>No existing allocated payments were found for this learner. Choose Record a new payment instead.</p>}
                <Field label="Reason for correction">
                  <textarea className="field" required minLength={8} maxLength={500} rows={2}
                    placeholder="e.g. Cash was paid for the uniform but posted against school fees"
                    value={itemReassignmentReason} onChange={e=>{setItemCorrectionReason(e.target.value);reassignRequestKey.current=null;}}/>
                </Field>
              </div>}
              <Field label="Amount to apply to this item (GHS)">
                <input className="field" type="number" required step="0.01" min="0.01" max={settlement?.balance}
                  value={itemPaymentAmount} onChange={e=>{setItemPaymentAmount(e.target.value);itemPaymentRequestKey.current=null;reassignRequestKey.current=null;}}/>
              </Field>
              {salePaymentMode==="NEW"&&<>
                <Field label="Payment method">
                  <select className="field" value={itemPaymentMethod} onChange={e=>{setItemPaymentMethod(e.target.value);itemPaymentRequestKey.current=null;}}>
                    <option value="CASH">Cash</option><option value="MOMO">Mobile Money</option>
                    <option value="BANK">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Payment reference (optional)">
                  <input className="field" maxLength={120} value={itemPaymentReference}
                    onChange={e=>{setItemPaymentReference(e.target.value);itemPaymentRequestKey.current=null;}}/>
                </Field>
              </>}
              <button type="submit" className="btn-primary w-full"
                disabled={busy||!charge||!settlement||settlement.balance<=0}>
                <CreditCard size={16}/>{salePaymentMode==="REALLOCATE"?"Correct existing payment allocation":"Record item payment"}
              </button>
            </form>
          </div>
        </Modal>;
      })()}
      {correctingCharge&&<Modal title="Correct or cancel a student fee" onClose={()=>{setCorrectingCharge(null);setCorrectionReason("");}}>
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <div className="flex gap-2"><AlertCircle size={20} className="shrink-0"/>
              <div><strong>This is not a payment refund.</strong>
                <p className="mt-1 leading-6">This cancels a fee or levy that was assigned by mistake. The original record stays in the audit history, and the student&apos;s outstanding balance is recalculated. If a student has already paid toward this fee, reverse the affected payment first in <strong>Payments & receipts</strong>.</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm">
            <p className="font-bold text-slate-900">{correctingCharge.description}</p>
            <p className="mt-1 text-xs text-slate-500">{correctingCharge.academic_year} · Term {correctingCharge.term}</p>
            <div className="mt-3 flex items-center justify-between"><span>Original fee</span><strong>{ghs(Number(correctingCharge.amount))}</strong></div>
            <div className="mt-1 flex items-center justify-between"><span>Amount already paid</span><strong className="text-emerald-700">{ghs(chargePaid(correctingCharge.id))}</strong></div>
          </div>
          {chargePaid(correctingCharge.id)>0?(
            <>
              <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                This fee already has payments. It cannot be cancelled until the affected payment has been reversed to keep the ledger accurate.
              </p>
              <button className="btn-secondary w-full" type="button" onClick={()=>{setCorrectingCharge(null);setView("payments");}}>
                Open student payments
              </button>
            </>
          ):(
            <form className="space-y-4" onSubmit={voidCharge}>
              <Field label="Reason for cancelling this charge (required)">
                <textarea className="field" required minLength={8} maxLength={500} rows={3}
                  placeholder="Example: Fee assigned to the wrong student"
                  value={correctionReason} onChange={e=>setCorrectionReason(e.target.value)} />
              </Field>
              <div className="flex flex-wrap gap-3">
                <button className="btn-secondary" type="button" onClick={()=>setCorrectingCharge(null)}>Keep the fee</button>
                <button className="btn-primary !bg-rose-700" type="submit" disabled={busy||correctionReason.trim().length<8}>
                  <AlertCircle size={16}/> Confirm fee cancellation
                </button>
              </div>
            </form>
          )}
        </div>
      </Modal>}
      {feeEditing&&<Modal title="Edit fee draft" onClose={()=>{setFeeEditing(null);setFeeName("");setFeeAmount("");}}>
        <form className="space-y-4" onSubmit={editFee}>
          <Field label="Name"><input className="field" maxLength={150} required value={feeName} onChange={e=>setFeeName(e.target.value)}/></Field>
          <Field label="Charge type"><select className="field" value={feeCategory} onChange={e=>setFeeCategory(e.target.value as "FEE"|"OTHER")}><option value="FEE">Term school fee</option><option value="OTHER">Other custom levy or payment</option></select></Field>
          <Field label="Amount (GHS)"><input className="field" type="number" min="0.01" step="0.01" required value={feeAmount} onChange={e=>setFeeAmount(e.target.value)}/></Field>
          <button className="btn-primary" disabled={busy}>Save draft changes</button>
        </form>
      </Modal>}
      {itemDraft&&<Modal title={itemDraft.id?"Edit school item":"Create school item"} onClose={()=>setItemDraft(null)}>
        <form className="space-y-4" onSubmit={saveItem}>
          <Field label="Item name"><input className="field" minLength={2} maxLength={150} required value={itemDraft.name} onChange={e=>setItemDraft({...itemDraft,name:e.target.value})}/></Field>
          <Field label="Description"><textarea className="field" value={itemDraft.description} maxLength={400} onChange={e=>setItemDraft({...itemDraft,description:e.target.value})} rows={2}/></Field>
          <Field label="Unit price (GHS)"><input className="field" type="number" min="0" step="0.01" value={itemDraft.unit_price} required onChange={e=>setItemDraft({...itemDraft,unit_price:e.target.value})}/></Field>
          <Field label="Available stock"><input className="field" type="number" min="0" step="1" value={itemDraft.stock_quantity} required onChange={e=>setItemDraft({...itemDraft,stock_quantity:e.target.value})}/></Field>
          <Field label="Item photograph (PNG, JPG or WEBP, max 2 MB)"><input className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>setItemDraft({...itemDraft,image:e.target.files?.[0]||null})}/></Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={itemDraft.active} onChange={e=>setItemDraft({...itemDraft,active:e.target.checked})}/>Available for sale</label>
          <button className="btn-primary" disabled={busy}>Save item</button>
        </form>
      </Modal>}
    </div>
  );
}
