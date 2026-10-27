"use client";

import {useState, type FormEvent} from "react";
import {jsPDF, GState} from "jspdf";
import {
  Banknote, Bell, BookOpen, CheckCircle2, ClipboardList, CreditCard, FileDown,
  GraduationCap, History, Menu, Package, Plus, Receipt, ShieldCheck,
  ShoppingBag, UserRound, Users, Wallet
} from "lucide-react";

type DemoStudent = {id:string;name:string;className:string;admission:string};
type DemoCharge = {id:string;studentId:string;label:string;term:string;amount:number};
type DemoPayment = {id:string;studentId:string;amount:number;method:string;reference:string;at:string;receipt:string};
type DemoItem = {id:string;name:string;price:number;stock:number};
type Section="overview"|"fees"|"payments"|"items"|"staff";
const students:DemoStudent[]=[
  {id:"s1",name:"Ama Serwaa",className:"Primary 4",admission:"DEMO-0041"},
  {id:"s2",name:"Kofi Mensah",className:"Primary 5",admission:"DEMO-0042"},
  {id:"s3",name:"Adwoa Boateng",className:"Primary 4",admission:"DEMO-0043"}
];
const money=(n:number)=>"GH₵ "+n.toLocaleString("en-GH",{minimumFractionDigits:2,maximumFractionDigits:2});
const initialCharges:DemoCharge[]=[
  {id:"c1",studentId:"s1",label:"Term school fees",term:"Term 1 · 2026/2027",amount:850},
  {id:"c2",studentId:"s2",label:"Term school fees",term:"Term 1 · 2026/2027",amount:850},
  {id:"c3",studentId:"s3",label:"Term school fees",term:"Term 1 · 2026/2027",amount:850}
];
const initialPayments:DemoPayment[]=[
  {id:"p1",studentId:"s1",amount:600,method:"Mobile Money",reference:"DEMO-MOMO-001",at:"27 Oct 2026",receipt:"DEMO-2026-001"},
  {id:"p2",studentId:"s2",amount:850,method:"Cash",reference:"DEMO-CASH-001",at:"27 Oct 2026",receipt:"DEMO-2026-002"}
];
const initialItems:DemoItem[]=[
  {id:"i1",name:"School uniform set",price:160,stock:25},
  {id:"i2",name:"School exercise books",price:24,stock:68},
  {id:"i3",name:"School sportswear",price:110,stock:18}
];
const sections:{id:Section;label:string;icon:typeof Wallet}[]=[
  {id:"overview",label:"Finance overview",icon:Wallet},
  {id:"fees",label:"Fees & charges",icon:ClipboardList},
  {id:"payments",label:"Payments & receipts",icon:CreditCard},
  {id:"items",label:"Items & sales",icon:ShoppingBag},
  {id:"staff",label:"Assign Accountant",icon:Users}
];
export default function FinanceDemoClient(){
  const [section,setSection]=useState<Section>("overview");
  const [navOpen,setNavOpen]=useState(false);
  const [charges,setCharges]=useState(initialCharges);
  const [payments,setPayments]=useState(initialPayments);
  const [items,setItems]=useState(initialItems);
  const [selectedStudent,setSelectedStudent]=useState(students[0].id);
  const [feeName,setFeeName]=useState("PTA levy");
  const [feeAmount,setFeeAmount]=useState("75");
  const [feeClass,setFeeClass]=useState("All classes");
  const [paymentAmount,setPaymentAmount]=useState("250");
  const [method,setMethod]=useState("Mobile Money");
  const [reference,setReference]=useState("");
  const [itemId,setItemId]=useState(initialItems[0].id);
  const [quantity,setQuantity]=useState("1");
  const [staffName,setStaffName]=useState("");
  const [staffRole,setStaffRole]=useState("ACCOUNTANT");
  const [staff,setStaff]=useState([{name:"Akosua Owusu",role:"ADMIN"},{name:"Daniel Addo",role:"CLASS_TEACHER"}]);
  const [events,setEvents]=useState<string[]>(["Kofi Mensah completed payment of GH₵850.00","Ama Serwaa paid GH₵600.00 via Mobile Money"]);
  const [notice,setNotice]=useState("");
  const [notify,setNotify]=useState(false);
  const current=students.find(s=>s.id===selectedStudent)!;
  const charged=(id:string)=>charges.filter(c=>c.studentId===id).reduce((t,c)=>t+c.amount,0);
  const paid=(id:string)=>payments.filter(p=>p.studentId===id).reduce((t,p)=>t+p.amount,0);
  const due=(id:string)=>Math.max(0,Math.round((charged(id)-paid(id))*100)/100);
  const totalCharges=students.reduce((a,s)=>a+charged(s.id),0);
  const totalPaid=students.reduce((a,s)=>a+paid(s.id),0);
  const viewPayment=[...payments].reverse();
  function message(value:string){setNotice(value);setEvents(e=>[value,...e]);}
  function addFee(e:FormEvent){
    e.preventDefault();const amount=Number(feeAmount);
    if(!Number.isFinite(amount)||amount<=0)return;
    const selected=feeClass==="All classes"?students:students.filter(s=>s.className===feeClass);
    const id=crypto.randomUUID();
    setCharges(old=>[...old,...selected.map((s,i)=>({id:id+"-"+i,studentId:s.id,label:feeName,term:"Term 1 · 2026/2027",amount}))]);
    message(feeName+" of "+money(amount)+" applied to "+selected.length+" demo learners.");
  }
  function addPayment(e:FormEvent){
    e.preventDefault();const amount=Number(paymentAmount);
    if(!(amount>0)||amount>due(selectedStudent)){
      setNotice("Please enter an amount that does not exceed the current balance.");return;
    }
    const receipt="DEMO-2026-"+String(payments.length+1).padStart(3,"0");
    setPayments(old=>[...old,{id:crypto.randomUUID(),studentId:selectedStudent,amount,method,reference,at:"27 Oct 2026",receipt}]);
    message(current.name+" paid "+money(amount)+" via "+method+".");
    setPaymentAmount("");setReference("");
  }
  function sellItem(e:FormEvent){
    e.preventDefault();const n=Number(quantity),item=items.find(i=>i.id===itemId);
    if(!item||!Number.isInteger(n)||n<1||n>item.stock){setNotice("Choose an item and available stock quantity.");return;}
    setItems(old=>old.map(i=>i.id===itemId?{...i,stock:i.stock-n}:i));
    setCharges(old=>[...old,{id:crypto.randomUUID(),studentId:selectedStudent,label:item.name+" × "+n,amount:item.price*n,term:"Term 1 · 2026/2027"}]);
    message(current.name+" purchased "+n+" × "+item.name+".");
  }
  function receipt(p:DemoPayment){
    const student=students.find(s=>s.id===p.studentId)!;
    const doc=new jsPDF({unit:"mm",format:"a4"});
    doc.setDrawColor(11,92,67);doc.setLineWidth(.8);doc.rect(8,8,194,281);
    doc.saveGraphicsState();
    doc.setGState(new GState({opacity:.055}));
    doc.setTextColor(11,92,67);doc.setFont("helvetica","bold");doc.setFontSize(48);
    doc.text("DEMO SCHOOL",105,160,{align:"center",angle:34});
    doc.restoreGraphicsState();
    doc.setFillColor(11,92,67);doc.rect(12,13,186,37,"F");
    doc.setTextColor(255,255,255);doc.setFontSize(17);doc.text("DEMO SCHOOL · GHANA",18,29);
    doc.setFontSize(10);doc.text("OFFICIAL PAYMENT RECEIPT — SAMPLE ONLY",18,41);
    doc.setTextColor(17,47,41);doc.setFontSize(14);doc.text("Payment receipt",18,64);
    doc.setFontSize(10);
    [["Receipt",p.receipt],["Learner",student.name],["Admission",student.admission],
     ["Class",student.className],["Date",p.at],["Method",p.method],["Reference",p.reference||"Not supplied"]].forEach(([label,value],idx)=>{
      doc.setTextColor(86,108,98);doc.text(label,18,80+idx*11);
      doc.setTextColor(17,47,41);doc.text(value,66,80+idx*11);
    });
    doc.setFillColor(238,248,241);doc.roundedRect(15,169,180,32,3,3,"F");
    doc.setFontSize(10);doc.setTextColor(11,92,67);doc.text("TOTAL RECEIVED",20,180);
    doc.setFont("helvetica","bold");doc.setFontSize(18);doc.text(money(p.amount),20,192);
    doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(17,47,41);
    doc.text("Current demo outstanding balance: "+money(due(student.id)),18,217);
    doc.line(18,258,90,258);doc.line(120,258,190,258);
    doc.setFontSize(8);doc.text("Finance office",20,264);doc.text("Authorized school stamp",122,264);
    doc.setTextColor(130,90,25);doc.text("DEMONSTRATION RECEIPT · NOT PROOF OF PAYMENT",105,279,{align:"center"});
    doc.save(p.receipt+".pdf");
  }
  const panel=(children:React.ReactNode)=> <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>;
  const input="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-emerald-600";
  const primary="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800";
  const small="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100";
  const label="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500";
  const studentSelect=<div><label className={label}>Learner</label><select className={input} value={selectedStudent} onChange={e=>setSelectedStudent(e.target.value)}>{students.map(s=><option key={s.id} value={s.id}>{s.name} · {s.className}</option>)}</select></div>;
  return <div className="min-h-screen bg-[#f5f8f5] text-slate-900">
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-center text-xs font-semibold text-amber-950">
      SAFE DEMO · Sample students and amounts only · No real school database access · Changes reset when you refresh
    </div>
    <div className="flex min-h-[calc(100vh-40px)]">
      <aside className={"fixed inset-y-0 left-0 z-30 w-64 bg-[#07513c] text-white shadow-xl lg:sticky lg:top-0 lg:h-screen "+(navOpen?"block":"hidden lg:block")}>
        <div className="flex items-center gap-3 border-b border-white/15 p-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-emerald-800"><GraduationCap/></div>
          <div><div className="font-bold">EduReport</div><div className="text-xs text-emerald-100/80">Finance demo</div></div>
        </div>
        <nav className="space-y-2 p-3" aria-label="Finance demo navigation">
          {sections.map(item=><button key={item.id} type="button" onClick={()=>{setSection(item.id);setNavOpen(false)}} className={"flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm "+(section===item.id?"bg-white font-semibold text-emerald-900":"text-emerald-50 hover:bg-white/10")}><item.icon size={18}/>{item.label}</button>)}
        </nav>
        <div className="mx-4 mt-4 rounded-xl bg-white/10 p-4 text-xs leading-6 text-white/85">
          Sample School<br/><strong>2026/2027 · First Term</strong>
        </div>
      </aside>
      {navOpen&&<button type="button" aria-label="Close demo navigation" onClick={()=>setNavOpen(false)} className="fixed inset-0 z-20 bg-black/45 lg:hidden"/>}
      <main className="min-w-0 flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 lg:px-9">
          <div className="flex items-center gap-3"><button type="button" className="lg:hidden" aria-label="Open demo navigation" onClick={()=>setNavOpen(true)}><Menu/></button><div><h1 className="font-bold">Sample School Finance Portal</h1><p className="text-xs text-slate-500">Interactive, isolated design preview</p></div></div>
          <button type="button" className="relative rounded-xl bg-emerald-50 p-3 text-emerald-800" onClick={()=>setNotify(!notify)} aria-label="Demo notifications"><Bell size={20}/>{events.length>0&&<span className="absolute -right-1 -top-1 rounded-full bg-amber-500 px-1.5 text-[10px] text-white">{events.length}</span>}</button>
        </header>
        <div className="mx-auto max-w-6xl space-y-6 p-4 pb-14 md:p-8">
          {notify&&panel(<div><h2 className="font-bold">Finance notifications</h2>{events.slice(0,5).map((e,i)=><p key={i} className="border-b border-slate-100 py-3 text-sm text-slate-700">{e}</p>)}<button type="button" className={small+" mt-3"} onClick={()=>setNotify(false)}>Close notifications</button></div>)}
          {notice&&<div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><CheckCircle2 size={18} className="mt-0.5 shrink-0"/><span>{notice}</span><button onClick={()=>setNotice("")} className="ml-auto text-xs underline">Dismiss</button></div>}
          <div><span className="text-xs font-bold uppercase tracking-[.16em] text-emerald-700">School Finance · Demo</span><h2 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">{sections.find(s=>s.id===section)?.label}</h2><p className="mt-2 text-sm text-slate-500">Try the sample workflows. Nothing on this screen changes actual student or financial records.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total charges",money(totalCharges),Wallet],
              ["Payments received",money(totalPaid),Banknote],
              ["Outstanding",money(totalCharges-totalPaid),CreditCard],
              ["Fully paid",String(students.filter(s=>due(s.id)===0).length)+" / "+students.length,CheckCircle2]
            ].map(([title,value,Icon])=>{const C=Icon as typeof Wallet;return <div key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">{String(title)}<C size={18} className="text-emerald-700"/></div><div className="mt-3 text-2xl font-bold">{String(value)}</div></div>})}
          </div>
          {section==="overview"&&<div className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
            {panel(<><h3 className="mb-4 text-lg font-bold">Student financial accounts</h3><div className="overflow-x-auto"><table className="w-full min-w-[550px] text-sm"><thead className="border-b text-left text-xs uppercase text-slate-500"><tr><th className="pb-3">Student</th><th className="pb-3 text-right">Charged</th><th className="pb-3 text-right">Paid</th><th className="pb-3 text-right">Balance</th><th className="pb-3 text-right">Status</th></tr></thead><tbody>{students.map(s=><tr key={s.id} className="border-b border-slate-100"><td className="py-4 font-semibold">{s.name}<div className="text-xs font-normal text-slate-500">{s.className}</div></td><td className="text-right">{money(charged(s.id))}</td><td className="text-right">{money(paid(s.id))}</td><td className="text-right font-semibold">{money(due(s.id))}</td><td className="text-right text-xs font-semibold">{due(s.id)===0?"Paid":paid(s.id)>0?"Part paid":"Owing"}</td></tr>)}</tbody></table></div></>)}
            {panel(<><h3 className="font-bold">Recent finance activity</h3><div className="mt-4 space-y-3">{events.slice(0,5).map((e,i)=><div key={i} className="flex items-start gap-2 border-b border-slate-100 pb-3 text-sm"><History size={16} className="mt-0.5 shrink-0 text-emerald-700"/>{e}</div>)}</div></>)}
          </div>}
          {section==="fees"&&<div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
            {panel(<><h3 className="font-bold">Set up a fee</h3><p className="mt-2 text-xs text-slate-500">Enter a charge manually, then apply it to the selected demo class.</p><form onSubmit={addFee} className="mt-5 space-y-4"><div><label className={label}>Fee name</label><input required maxLength={90} className={input} value={feeName} onChange={e=>setFeeName(e.target.value)}/></div><div><label className={label}>Amount (GH₵)</label><input required type="number" min=".01" step=".01" className={input} value={feeAmount} onChange={e=>setFeeAmount(e.target.value)}/></div><div><label className={label}>Applies to</label><select className={input} value={feeClass} onChange={e=>setFeeClass(e.target.value)}><option>All classes</option><option>Primary 4</option><option>Primary 5</option></select></div><button type="submit" className={primary+" w-full"}><Plus size={17}/>Apply sample fee</button></form></>)}
            {panel(<><h3 className="font-bold">Assigned charges</h3><div className="mt-4 space-y-3">{charges.slice().reverse().slice(0,14).map(c=><div key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm"><div><strong>{c.label}</strong><p className="mt-1 text-xs text-slate-500">{students.find(s=>s.id===c.studentId)?.name} · {c.term}</p></div><strong className="shrink-0">{money(c.amount)}</strong></div>)}</div></>)}
          </div>}
          {section==="payments"&&<div className="grid gap-5 lg:grid-cols-[.85fr_1.15fr]">
            {panel(<><h3 className="font-bold">Record a sample payment</h3><form onSubmit={addPayment} className="mt-5 space-y-4">{studentSelect}<div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">Outstanding: <strong>{money(due(selectedStudent))}</strong></div><div><label className={label}>Amount (GH₵)</label><input required type="number" min=".01" step=".01" className={input} value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></div><div><label className={label}>Payment method</label><select value={method} className={input} onChange={e=>setMethod(e.target.value)}>{["Cash","Mobile Money","Bank Transfer","Cheque","Other"].map(m=><option key={m}>{m}</option>)}</select></div><div><label className={label}>Reference</label><input className={input} value={reference} onChange={e=>setReference(e.target.value)} placeholder="Optional transaction reference"/></div><button className={primary+" w-full"} type="submit" disabled={due(selectedStudent)<=0}><CreditCard size={17}/>Record sample payment</button></form></>)}
            {panel(<><h3 className="font-bold">Receipts and payment history</h3><div className="mt-4 space-y-3">{viewPayment.map(p=><div key={p.id} className="rounded-xl border border-slate-200 p-4 text-sm"><div className="flex justify-between gap-3"><div><strong>{students.find(s=>s.id===p.studentId)?.name}</strong><p className="mt-1 text-xs text-slate-500">{p.receipt} · {p.method}</p></div><strong>{money(p.amount)}</strong></div><button className={small+" mt-3 inline-flex items-center gap-2"} onClick={()=>receipt(p)}><FileDown size={15}/>Download sample PDF</button></div>)}</div></>)}
          </div>}
          {section==="items"&&<div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
            {panel(<><h3 className="font-bold">School shop · Inventory</h3><div className="mt-4 space-y-3">{items.map(i=><div key={i.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Package size={25}/></div><div className="flex-1"><div className="text-sm font-bold">{i.name}</div><p className="text-xs text-slate-500">{i.stock} in stock</p></div><strong className="text-sm">{money(i.price)}</strong></div>)}</div></>)}
            {panel(<><h3 className="font-bold">Record a sample item sale</h3><form onSubmit={sellItem} className="mt-4 space-y-4">{studentSelect}<div><label className={label}>Item</label><select className={input} value={itemId} onChange={e=>setItemId(e.target.value)}>{items.map(i=><option value={i.id} key={i.id}>{i.name} · {money(i.price)}</option>)}</select></div><div><label className={label}>Quantity</label><input className={input} value={quantity} onChange={e=>setQuantity(e.target.value)} type="number" min="1" step="1"/></div><button className={primary+" w-full"} type="submit"><ShoppingBag size={17}/>Record sample sale</button><p className="text-xs text-slate-500">The sample stock decreases and the student gets a new charge.</p></form></>)}
          </div>}
          {section==="staff"&&<div className="grid gap-5 lg:grid-cols-[.95fr_1.05fr]">
            {panel(<><div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700"/><h3 className="font-bold">School Admin · Assign a role</h3></div><p className="mt-3 text-sm text-slate-600">This shows how an existing School Administrator can appoint an Accountant using the usual staff-role management.</p><form onSubmit={e=>{e.preventDefault();if(!staffName.trim())return;setStaff(x=>[...x,{name:staffName.trim(),role:staffRole}]);message(staffName+" assigned the "+staffRole+" role (demo only).");setStaffName("");}} className="mt-5 space-y-4"><div><label className={label}>Staff member</label><input className={input} required maxLength={75} value={staffName} onChange={e=>setStaffName(e.target.value)} placeholder="Enter sample staff name"/></div><div><label className={label}>Role</label><select className={input} value={staffRole} onChange={e=>setStaffRole(e.target.value)}><option value="ACCOUNTANT">Accountant</option><option value="ADMIN">Administrator</option><option value="HEADTEACHER">Headteacher</option><option value="CLASS_TEACHER">Class Teacher</option><option value="SUBJECT_TEACHER">Subject Teacher</option></select></div><button className={primary+" w-full"}><UserRound size={17}/>Assign sample staff role</button></form></>)}
            {panel(<><h3 className="font-bold">Sample school staff</h3><div className="mt-4 space-y-3">{staff.map((s,i)=><div key={i} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"><span className="font-semibold">{s.name}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{s.role.replaceAll("_"," ")}</span></div>)}</div></>)}
          </div>}
          <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><Receipt className="mt-0.5 shrink-0"/><span><strong>Demonstration only.</strong> This page does not authenticate staff, send real notifications, assign fees to real learners or use a real database. After a separate staging database is provisioned, the actual accountant workflow can be tested end to end.</span></div>
        </div>
      </main>
    </div>
  </div>;
}
