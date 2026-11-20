"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {MessageSquareText,Send,Users,RefreshCcw,ShieldCheck,FileSpreadsheet} from "lucide-react";
import {useWorkspace} from "@/components/workspace";
import {PageHeader} from "@/components/ui";
import {browserClient} from "@/lib/supabase/client";
type Guardian={student_id:string;guardian_name:string;phone_e164:string;consent_status:string;consent_source:string|null};
type Learner={id:string;admission_number:string;first_name:string;last_name:string;class_id:string;guardian:Guardian|null};
type School={id:string;name:string};
type Choice={id:string;name:string};
type Preview={selected_learners:number;eligible_guardians:number;missing:number;consent_needed:number;duplicates:number;segments:number;estimated_credits:number;message_preview:string};
type Campaign={id:string;created_at:string;sender_id:string;status:string;recipient_count:number;message_body:string};
type CustomTestState={available:boolean;used:boolean;sender_id:string;recipient_ending:string|null;message:string;history?:{created_at:string;status:string;sender_id:string}[]};
function parseCsv(csv:string){
  const rows:string[][]=[];let r:string[]=[],c="",quoted=false;
  for(let i=0;i<csv.length;i++){
    const t=csv[i];
    if(t==='"'){if(quoted&&csv[i+1]==='"'){c+='"';i++;}else quoted=!quoted;}
    else if(t===","&&!quoted){r.push(c);c="";}
    else if((t==="\n"||t==="\r")&&!quoted){
      if(t==="\r"&&csv[i+1]==="\n")i++;
      r.push(c);if(r.some(v=>v.trim()))rows.push(r);
      r=[];c="";
    }else c+=t;
  }
  if(quoted)throw Error("Invalid CSV quoting");
  r.push(c);if(r.some(v=>v.trim()))rows.push(r);
  if(rows.length<2)throw Error("CSV needs a header and at least one row");
  const h=rows[0].map(s=>s.replace(/^\uFEFF/,"").trim().toLowerCase());
  const indexes=["admission_number","guardian_name","phone"].map(k=>h.indexOf(k));
  if(indexes.some(i=>i<0))throw Error("CSV headings must be admission_number,guardian_name,phone");
  return rows.slice(1).map(row=>({
    admission_number:(row[indexes[0]]||"").trim(),
    guardian_name:(row[indexes[1]]||"").trim(),
    phone:(row[indexes[2]]||"").trim()
  }));
}
export default function GuardianSms(){
  const {data:w}=useWorkspace();
  const permitted=w.operator||w.profile.role==="ADMIN";
  const testing=process.env.NEXT_PUBLIC_EDUREPORT_TESTING==="true";
  const [schools,setSchools]=useState<School[]>([]);
  const [schoolId,setSchoolId]=useState(w.school.id);
  const [classes,setClasses]=useState<Choice[]>([]);
  const [learners,setLearners]=useState<Learner[]>([]);
  const [senderOptions,setSenderOptions]=useState<string[]>(["EDUREPORT"]);
  const [sender,setSender]=useState("EDUREPORT");
  const [filter,setFilter]=useState("");
  const [edit,setEdit]=useState<string|null>(null);
  const [guardianName,setGuardianName]=useState("");
  const [guardianPhone,setGuardianPhone]=useState("");
  const [consent,setConsent]=useState<string|null>(null);
  const [consentStatus,setConsentStatus]=useState("OPTED_IN");
  const [consentSource,setConsentSource]=useState("");
  const [consentConfirmed,setConsentConfirmed]=useState(false);
  const [scope,setScope]=useState("selected");
  const [selected,setSelected]=useState<string[]>([]);
  const [classId,setClassId]=useState("");
  const [message,setMessage]=useState("");
  const [preview,setPreview]=useState<Preview|null>(null);
  const [saved,setSaved]=useState<string|null>(null);
  const [history,setHistory]=useState<Campaign[]>([]);
  const [sendingConfirm,setSendingConfirm]=useState(false);
  const [customTest,setCustomTest]=useState<CustomTestState|null>(null);
  const [customTestText,setCustomTestText]=useState("Hello, this is a custom message test from Ark Academy.");
  const [customTestConfirm,setCustomTestConfirm]=useState(false);
  const [customTestBusy,setCustomTestBusy]=useState(false);
  const [customTestFeedback,setCustomTestFeedback]=useState("");
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [error,setError]=useState(""),[notice,setNotice]=useState("");
  const call=useCallback(async(action:string,rest:Record<string,unknown>={})=>{
    const {data,error}=await browserClient().functions.invoke("guardian-messages",
      {body:{action,school_id:schoolId,...rest}});
    if(error){
      const context=(error as {context?:unknown}).context;
      if(context instanceof Response){
        const body=await context.clone().json().catch(()=>null);
        if(typeof body?.error==="string")throw Error(body.error);
      }
      throw Error(error.message);
    }
    if(data?.error)throw Error(String(data.error));
    return data;
  },[schoolId]);
  const refresh=useCallback(async()=>{
    if(!permitted)return;
    setLoading(true);setError("");
    try{
      const [data,h]=await Promise.all([call("contacts"),call("campaigns")]);
      setLearners(data.learners||[]);setClasses(data.classes||[]);
      setSenderOptions(data.sender_options||["EDUREPORT"]);
      setSender(old=>data.sender_options?.includes(old)?old:data.sender_id);
      setHistory(h.campaigns||[]);
    }catch(e){setError(e instanceof Error?e.message:"Could not load contacts");}
    finally{setLoading(false);}
  },[call,permitted]);
  useEffect(()=>{void Promise.resolve().then(refresh);},[refresh]);
  useEffect(()=>{
    if(!permitted)return;
    void Promise.resolve().then(async()=>{
      const {data}=await browserClient().functions.invoke("guardian-messages",{body:{action:"schools"}});
      if(Array.isArray(data?.schools))setSchools(data.schools);
    });
  },[permitted]);
  const reloadCustomTest=useCallback(async()=>{
    if(!testing||!w.operator)return;
    try{
      const result=await call("custom_test_status");
      setCustomTest(result as CustomTestState);
    }catch(e){
      setCustomTest(null);
      setCustomTestFeedback(e instanceof Error?e.message:"Custom SMS test status unavailable");
    }
  },[testing,w.operator,call]);
  useEffect(()=>{void Promise.resolve().then(reloadCustomTest);},[reloadCustomTest]);
  async function sendCustomTest(){
    if(!customTest?.available||customTestBusy)return;
    setCustomTestConfirm(false);setCustomTestBusy(true);setCustomTestFeedback("");
    try{
      const result=await call("custom_test_send",{
        message:customTestText.trim(),
        test_confirmed:true,test_request_id:crypto.randomUUID()
      });
      setCustomTestFeedback(String(result.message||"Custom SMS test request completed"));
    }catch(e){
      setCustomTestFeedback(e instanceof Error?e.message:"Could not verify the test outcome. Do not retry.");
    }finally{
      await reloadCustomTest();setCustomTestBusy(false);
    }
  }
  const visible=useMemo(()=>learners.filter(l=>
    [l.first_name,l.last_name,l.admission_number,l.guardian?.guardian_name||""]
      .join(" ").toLowerCase().includes(filter.toLowerCase())
  ),[learners,filter]);
  const enrolled=learners.length;
  const opted=learners.filter(x=>x.guardian?.consent_status==="OPTED_IN").length;
  const clear=()=>{setPreview(null);setSaved(null);};
  async function act(task:()=>Promise<string>){
    setBusy(true);setError("");setNotice("");
    try{setNotice(await task());await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Request failed");}
    finally{setBusy(false);}
  }
  const audience=()=>scope==="all"?{scope}:scope==="class"?{scope,class_id:classId}:{scope,selected_ids:selected};
  async function showPreview(){
    setBusy(true);setError("");setNotice("");
    try{setPreview(await call("preview",{...audience(),message,sender_id:sender}));setSaved(null);}
    catch(e){setError(e instanceof Error?e.message:"Preview failed");}
    finally{setBusy(false);}
  }
  async function importFile(file:File){
    try{
      const rows=parseCsv(await file.text());
      if(rows.length>1000)throw Error("Import up to 1,000 rows per file");
      await act(async()=>{
        let total=0;
        for(let i=0;i<rows.length;i+=200){
          const result=await call("import_contacts",{rows:rows.slice(i,i+200)});
          total+=Number(result.imported||0);
        }
        clear();return String(total)+" guardian contacts imported. Consent is not automatically granted.";
      });
    }catch(e){setError(e instanceof Error?e.message:"Cannot read CSV");}
  }
  if(!permitted)return <section className="surface rounded-2xl p-6">
    <h1 className="font-bold">Guardian SMS restricted</h1>
    <p className="mt-2 text-sm">Only School Administrators and Platform Administrators can send school messages.</p>
  </section>;
  return <div className="space-y-6">
    <PageHeader eyebrow="School communication" title="Parent/Guardian SMS"
      description="Manage school contacts and consent, preview messages and create controlled SMS campaigns.">
      <button className="btn-secondary" disabled={busy} onClick={()=>void refresh()}><RefreshCcw size={16}/>Refresh</button>
    </PageHeader>
    {testing&&<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <strong>STAGING ONLY.</strong> Contact management, previews and drafts are enabled. No paid guardian SMS can be sent here.
    </div>}
    {error&&<p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>}
    {notice&&<p role="status" className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900">{notice}</p>}
    {w.operator&&<section className="surface rounded-xl p-4">
      <label className="block text-sm font-semibold">Select school
        <select className="field mt-2 max-w-lg" value={schoolId} onChange={e=>{
          setSchoolId(e.target.value);setSelected([]);setLearners([]);setHistory([]);clear();
        }}>
          {schools.length?schools.map(x=><option key={x.id} value={x.id}>{x.name}</option>):
            <option value={schoolId}>{w.school.name}</option>}
        </select>
      </label>
    </section>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="surface rounded-xl p-4"><Users className="text-emerald-700" size={20}/><p className="text-xs text-muted">Active learners</p><strong className="text-2xl">{enrolled}</strong></div>
      <div className="surface rounded-xl p-4"><ShieldCheck className="text-emerald-700" size={20}/><p className="text-xs text-muted">Learners with guardian consent</p><strong className="text-2xl">{opted}</strong></div>
      <div className="surface rounded-xl p-4"><MessageSquareText className="text-emerald-700" size={20}/><p className="text-xs text-muted">School Sender ID</p><strong>{senderOptions.join(" / ")}</strong></div>
    </div>
    {testing&&w.operator&&<section className="surface rounded-2xl border-2 border-emerald-200 p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Send size={18}/>Real custom SMS — one-time test</h2>
      <p className="mt-2 text-sm text-muted">
        This sends one real SMS through Arkesel to the previously opted-in staging pilot phone only.
        It does not contact parents or enable normal school payment SMS.
      </p>
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        <p>Sender ID: <strong>Ark Academy</strong></p>
        <p>Recipient: <strong>{customTest?.recipient_ending?"Authorized pilot, ending "+customTest.recipient_ending:"Not verified"}</strong></p>
        <p>Test availability: <strong>{customTest?.available?"Ready for one attempt":customTest?.used?"Already used":"Not ready"}</strong></p>
        <p className="mt-1 text-xs text-muted">{customTest?.message||"Checking the one-time test setup…"}</p>
      </div>
      <label className="mt-3 block text-sm font-semibold">Write your custom test message
        <textarea className="field mt-2 min-h-24 w-full" maxLength={140}
          value={customTestText} disabled={customTestBusy||!customTest?.available}
          onChange={e=>setCustomTestText(e.target.value)}/>
      </label>
      <p className="mt-1 text-xs text-muted">
        The delivered message will start with TEST: and must fit a single SMS segment.
        Only one paid attempt is allowed; an uncertain response cannot be retried.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button type="button" className="btn-primary"
          disabled={!customTest?.available||!customTestText.trim()||customTestBusy}
          onClick={()=>setCustomTestConfirm(true)}>Send one custom test SMS</button>
        <button type="button" className="btn-secondary" disabled={customTestBusy}
          onClick={()=>void reloadCustomTest()}>Check test status</button>
      </div>
      {customTestFeedback&&<p role="status" className="mt-3 rounded-xl bg-slate-100 p-3 text-sm">{customTestFeedback}</p>}
      {customTest?.history?.length? <div className="mt-3 text-sm">
        <p className="font-semibold">Custom diagnostic history</p>
        {customTest.history.map((test,i)=><p className="mt-1" key={i}>
          {new Date(test.created_at).toLocaleString("en-GB")} · {test.sender_id} · {test.status}
        </p>)}
      </div>:null}
      {customTestConfirm&&<div role="dialog" aria-modal="true" aria-label="Confirm custom SMS test"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <h3 className="text-lg font-bold">Confirm one paid custom SMS</h3>
          <p className="mt-2 text-sm">
            Send one message from <strong>Ark Academy</strong> to the authorized
            pilot phone ending <strong>{customTest?.recipient_ending||"—"}</strong>?
          </p>
          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">{"TEST: "+customTestText.trim()}</p>
          <p className="mt-2 text-sm text-amber-800">
            One Arkesel SMS credit may be charged. This permission will be consumed even if the provider times out.
            Do not retry an unknown result.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button className="btn-secondary" onClick={()=>setCustomTestConfirm(false)}>Cancel</button>
            <button className="btn-primary" disabled={customTestBusy||!customTest?.available}
              onClick={()=>void sendCustomTest()}>Confirm and send</button>
          </div>
        </div>
      </div>}
    </section>}
    <section className="surface rounded-2xl p-5">
      <h2 className="text-lg font-bold">Guardian contact book</h2>
      <p className="mt-1 text-sm text-muted">Match numbers to existing admission numbers. Imports are pending until actual guardian permission is recorded.</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="btn-secondary cursor-pointer"><FileSpreadsheet size={16}/>Import CSV
          <input type="file" accept=".csv" className="sr-only" disabled={busy} onChange={e=>{
            const file=e.target.files?.[0];e.currentTarget.value="";
            if(file)void importFile(file);
          }}/></label>
        <a className="text-sm font-semibold text-emerald-700 underline"
          href={"data:text/csv;charset=utf-8,"+encodeURIComponent("admission_number,guardian_name,phone\nADM001,Guardian Example,0241234567\n")}
          download="guardian_sms_import_sample.csv">Download CSV template</a>
        <span className="text-xs text-muted">Do not upload real parent contacts into staging.</span>
      </div>
      <input className="field mt-4 max-w-md" placeholder="Search learner or admission number"
        aria-label="Search guardian contacts" value={filter} onChange={e=>setFilter(e.target.value)}/>
      <div className="mt-3 max-h-[420px] overflow-auto rounded-xl border">
        <table className="data-table">
          <thead><tr><th>Learner</th><th>Guardian</th><th>Phone</th><th>Consent</th><th>Actions</th></tr></thead>
          <tbody>{visible.slice(0,500).map(l=><tr key={l.id}>
            <td><strong>{l.first_name} {l.last_name}</strong><span className="block text-xs">{l.admission_number}</span></td>
            <td>{l.guardian?.guardian_name||"—"}</td>
            <td className="font-mono text-xs">{l.guardian?.phone_e164||"Missing"}</td>
            <td>{l.guardian?.consent_status||"PENDING"}</td>
            <td>
              <button className="mr-3 text-sm font-semibold text-emerald-700" onClick={()=>{
                setEdit(l.id);setGuardianName(l.guardian?.guardian_name||"");setGuardianPhone(l.guardian?.phone_e164||"");
              }}>Edit</button>
              {l.guardian&&<button className="text-sm font-semibold text-emerald-700" onClick={()=>{
                setConsent(l.id);setConsentSource("");setConsentConfirmed(false);
              }}>Consent</button>}
            </td>
          </tr>)}</tbody>
        </table>
        {!loading&&!visible.length&&<p className="p-4 text-sm text-muted">No matching learners.</p>}
      </div>
      {visible.length>500&&<p className="text-xs text-amber-800">Showing 500 rows. Use search for others.</p>}
    </section>
    {edit&&<section className="surface rounded-2xl border-2 border-emerald-200 p-5">
      <h3 className="font-bold">Update guardian contact</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Guardian name<input className="field mt-1" value={guardianName} onChange={e=>setGuardianName(e.target.value)} maxLength={120}/></label>
        <label className="text-sm">Ghana phone<input className="field mt-1" type="tel" value={guardianPhone} onChange={e=>setGuardianPhone(e.target.value)}/></label>
      </div>
      <p className="mt-2 text-xs text-muted">Changing the phone number resets SMS consent.</p>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={()=>void act(async()=>{
          await call("save_contact",{student_id:edit,guardian_name:guardianName,phone:guardianPhone});
          setEdit(null);clear();return "Contact saved. Confirm guardian SMS consent separately.";
        })}>Save</button>
        <button className="btn-secondary" onClick={()=>setEdit(null)}>Cancel</button>
      </div>
    </section>}
    {consent&&<section className="surface rounded-2xl border-2 border-emerald-200 p-5">
      <h3 className="font-bold">Record guardian SMS permission</h3>
      <p className="mt-1 text-sm text-muted">Only record genuine permission provided by the guardian. A stored phone number alone is not permission.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Preference
          <select className="field mt-1" value={consentStatus} onChange={e=>setConsentStatus(e.target.value)}>
            <option value="OPTED_IN">Guardian agreed to SMS</option>
            <option value="OPTED_OUT">Guardian declined / withdrew SMS</option>
          </select>
        </label>
        <label className="text-sm">Evidence of preference
          <select className="field mt-1" value={consentSource} onChange={e=>setConsentSource(e.target.value)}>
            <option value="">Select evidence</option>
            <option value="Written guardian permission held by school">Written permission held by school</option>
            <option value="Guardian gave permission by telephone">Confirmed by telephone</option>
            <option value="Guardian gave permission at school">Confirmed in person</option>
            <option value="Guardian requested to stop SMS communication">Guardian requested opt-out</option>
          </select>
        </label>
      </div>
      <label className="mt-3 flex gap-2 text-sm"><input type="checkbox" checked={consentConfirmed} onChange={e=>setConsentConfirmed(e.target.checked)}/>
        I confirm that this accurately records the guardian&apos;s choice.</label>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={busy||!consentConfirmed||!consentSource} onClick={()=>void act(async()=>{
          await call("record_consent",{student_id:consent,consent_action:consentStatus,consent_source:consentSource});
          setConsent(null);clear();return "Guardian SMS preference recorded.";
        })}>Save permission</button>
        <button className="btn-secondary" onClick={()=>setConsent(null)}>Cancel</button>
      </div>
    </section>}
    <section className="surface rounded-2xl p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Send size={18}/>Custom SMS composer</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Recipients
          <select className="field mt-1" value={scope} onChange={e=>{setScope(e.target.value);clear();}}>
            <option value="selected">One or selected learners</option><option value="class">A whole class</option><option value="all">All school learners</option>
          </select>
        </label>
        <label className="text-sm">Sender ID
          <select className="field mt-1" value={sender} onChange={e=>{setSender(e.target.value);clear();}}>
            {senderOptions.map(id=><option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </div>
      {scope==="class"&&<select className="field mt-3 max-w-md" value={classId} onChange={e=>{setClassId(e.target.value);clear();}}>
        <option value="">Select a class</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      {scope==="selected"&&<div className="mt-3 max-h-44 overflow-auto rounded-xl border p-3">
        {learners.map(l=><label className="flex items-center gap-2 py-1 text-sm" key={l.id}>
          <input type="checkbox" checked={selected.includes(l.id)} onChange={e=>{
            setSelected(prev=>e.target.checked?[...prev,l.id]:prev.filter(id=>id!==l.id));clear();
          }}/>{l.first_name} {l.last_name} <span className="text-xs text-muted">({l.admission_number})</span>
        </label>)}
      </div>}
      <label className="mt-3 block text-sm">Write message
        <textarea className="field mt-1 min-h-28 w-full" value={message} maxLength={320}
          onChange={e=>{setMessage(e.target.value);clear();}} placeholder="Dear Parent/Guardian, ..." />
      </label>
      <p className="mt-1 text-xs text-muted">{message.length} / 320 characters. Provider rates and segments may vary.</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button className="btn-secondary" disabled={busy||!message.trim()} onClick={()=>void showPreview()}>Preview recipients and credits</button>
        <button className="btn-primary" disabled={busy||!preview||preview.eligible_guardians===0||!!saved}
          onClick={()=>void act(async()=>{
            const result=await call("draft",{...audience(),message,sender_id:sender,request_key:crypto.randomUUID()});
            setSaved(String(result.id));return "Draft saved. No SMS has been sent.";
          })}>Save SMS draft</button>
      </div>
      {preview&&<div className="mt-4 rounded-xl border bg-slate-50 p-4 text-sm">
        <h3 className="font-bold">Review before sending</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <span>{preview.selected_learners} learners selected</span>
          <span>{preview.eligible_guardians} unique eligible guardians</span>
          <span>{preview.estimated_credits} estimated credits</span>
          <span>{preview.missing} missing phone records</span>
          <span>{preview.consent_needed} without SMS consent</span>
          <span>{preview.duplicates} duplicate phones removed</span>
        </div>
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3">{preview.message_preview}</p>
      </div>}
      {saved&&<div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
        <strong>Draft saved.</strong> Campaign ID: <span className="font-mono text-xs">{saved}</span>
        <button className="btn-primary mt-3 block" disabled={busy||testing} onClick={()=>setSendingConfirm(true)}>
          Send saved campaign</button>
        {testing&&<p className="mt-1 text-xs text-amber-800">Staging sending is disabled until authorized production release.</p>}
      </div>}
    </section>
    <section className="surface rounded-2xl p-5">
      <h2 className="text-lg font-bold">Message history</h2>
      <div className="mt-3 overflow-x-auto"><table className="data-table"><thead>
        <tr><th>Date</th><th>Sender</th><th>Guardians</th><th>Status</th><th>Message</th></tr>
      </thead><tbody>{history.map(c=><tr key={c.id}>
        <td>{new Date(c.created_at).toLocaleString("en-GB")}</td>
        <td>{c.sender_id}</td><td>{c.recipient_count}</td><td>{c.status}</td>
        <td className="max-w-xs truncate">{c.message_body}</td>
      </tr>)}</tbody></table>{!history.length&&<p className="p-3 text-sm text-muted">No custom messages yet.</p>}</div>
    </section>
    {sendingConfirm&&<div role="dialog" aria-modal="true" aria-label="Confirm SMS send"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="font-bold">Confirm paid guardian SMS</h3>
        <p className="mt-2 text-sm">Send to {preview?.eligible_guardians||0} unique guardians? Approximately {preview?.estimated_credits||0} SMS credits may be required.</p>
        <p className="mt-2 text-sm text-amber-800">Confirm only once. Do not retry an uncertain provider response.</p>
        <div className="mt-4 flex justify-end gap-3">
          <button className="btn-secondary" onClick={()=>setSendingConfirm(false)}>Cancel</button>
          <button className="btn-primary" disabled={busy||testing} onClick={()=>void act(async()=>{
            setSendingConfirm(false);
            const result=await call("send",{campaign_id:saved});
            return String(result.message||"Campaign request completed");
          })}>Confirm send</button>
        </div>
      </div>
    </div>}
  </div>;
}
