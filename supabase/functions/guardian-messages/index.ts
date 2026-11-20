import { createClient } from "npm:@supabase/supabase-js@2.117.2";

/** School-scoped guardian communications. No production activation on deploy.
 * Server-owned phone resolution, positive consent, atomic drafts, sender policy
 * and explicit live gate prevent abuse of the existing finance SMS gateway.
 */
const url=(Deno.env.get("SUPABASE_URL")||"").replace(/\/$/,"");
const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";
const serviceRole=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const providerKey=Deno.env.get("ARKESEL_API_KEY")||"";
const sendingAllowed=Deno.env.get("GUARDIAN_SMS_LIVE_ENABLED")==="true";
const isStaging=url==="https://ymoyqresvsxetvnkwsxq.supabase.co";
const originAllowed=(origin:string)=>
  /^https:\/\/terminal-report-system(?:-[a-z0-9-]+-mawuenam)?\.vercel\.app$/.test(origin)
  || origin==="http://localhost:3000";
const cors=(origin:string)=>({
  "Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin",
  "Access-Control-Allow-Origin":originAllowed(origin)?origin:"https://terminal-report-system.vercel.app",
  "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
});
const reply=(origin:string,status:number,data:unknown)=>
  new Response(JSON.stringify(data),{status,headers:cors(origin)});
const uuid=(v:unknown):v is string=>
  typeof v==="string"&&/^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/.test(v);
const normalized=(value:unknown)=>{
  const p=String(value||"").replace(/[\s()-]/g,"");
  const n=p.replace(/^0([25]\d{8})$/,"+233$1").replace(/^233([25]\d{8})$/,"+233$1");
  return /^\+233[25]\d{8}$/.test(n)?n:null;
};
const asciiGsm=new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);
const gsmExtra=new Set("^{}\\[~]|€");
function segments(body:string){
  let units=0,ascii=true;
  for(const char of body){
    if(gsmExtra.has(char))units+=2;
    else if(asciiGsm.has(char))units++;
    else {ascii=false;break;}
  }
  if(ascii)return Math.ceil(units/(units<=160?160:153));
  const total=[...body].reduce((acc,c)=>acc+(c.codePointAt(0)!>65535?2:1),0);
  return Math.ceil(total/(total<=70?70:67));
}
type Student={id:string;school_id:string;class_id:string;admission_number:string;first_name:string;last_name:string;status:string};
type Guardian={student_id:string;school_id:string;guardian_name:string;phone_e164:string;consent_status:string;consent_source:string|null;consent_recorded_at:string|null};
type Campaign={id:string;school_id:string;sender_id:string;message_body:string;status:string;created_by:string;recipient_count:number;segment_estimate:number};
type Payload={
  action?:string;school_id?:string;student_id?:string;admission_number?:string;
  guardian_name?:string;phone?:string;consent_action?:"OPTED_IN"|"OPTED_OUT";consent_source?:string;
  rows?:{admission_number:string;guardian_name:string;phone:string}[];
  scope?:"selected"|"class"|"all";selected_ids?:string[];class_id?:string;
  message?:string;sender_id?:string;request_key?:string;campaign_id?:string;
  test_request_id?:string;test_confirmed?:boolean;
};

Deno.serve(async(request:Request)=>{
  const origin=request.headers.get("origin")||"";
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
  if(request.method!=="POST")return reply(origin,405,{error:"POST required"});
  if(origin&&!originAllowed(origin))return reply(origin,403,{error:"Origin rejected"});
  if(!url||!anon||!serviceRole)return reply(origin,503,{error:"Gateway not configured"});
  const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();
  if(!token)return reply(origin,401,{error:"Sign in to EduReport"});
  let data:Payload;
  try{
    if(Number(request.headers.get("content-length")||0)>52000)throw Error();
    data=await request.json();
    if(!data||typeof data!=="object")throw Error();
  }catch{return reply(origin,400,{error:"Invalid request"});}
  const userDb=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:"Bearer "+token}}});
  const {data:identity,error:authError}=await userDb.auth.getUser(token);
  if(authError||!identity.user)return reply(origin,401,{error:"Session expired"});
  const actor=identity.user.id;
  const db=createClient(url,serviceRole,{auth:{persistSession:false,autoRefreshToken:false}});
  const [{data:staff,error:staffError},{data:operator,error:operatorError}]=await Promise.all([
    db.from("school_users").select("id,school_id,role,active,must_change_password")
      .eq("auth_user_id",actor).maybeSingle(),
    db.from("platform_operators").select("auth_user_id").eq("auth_user_id",actor).maybeSingle(),
  ]);
  if(staffError||operatorError||!staff||!staff.active||staff.must_change_password)
    return reply(origin,403,{error:"Active school account required"});
  const isOperator=!!operator;
  if(!isOperator&&staff.role!=="ADMIN")
    return reply(origin,403,{error:"School Administrator or Platform Administrator required"});
  const action=String(data.action||"");
  // Independent one-time diagnostic for a custom text. It uses the existing
  // opted-in staging pilot phone and never treats test numbers as parents.
  if(action==="custom_test_status"||action==="custom_test_send"){
    if(!isOperator)return reply(origin,403,{error:"Platform Administrator required for the paid diagnostic"});
    if(!isStaging)return reply(origin,403,{error:"Diagnostic is available in staging only"});
    const pilotSchool=Deno.env.get("ARKESEL_SMS_PILOT_SCHOOL_ID")||"";
    const pilotPhones=(Deno.env.get("ARKESEL_SMS_PILOT_RECIPIENTS")||"")
      .split(",").map(v=>v.trim()).filter(Boolean);
    const pilotPhone=pilotPhones.length===1?pilotPhones[0]:"";
    const allowPhone=normalized(pilotPhone)===pilotPhone&&!!pilotPhone;
    const chosenSchool=data.school_id||staff.school_id;
    const validPilot=uuid(pilotSchool)&&chosenSchool===pilotSchool&&allowPhone;
    const {data:permit,error:permitError}=await db
      .from("guardian_custom_test_permit")
      .select("enabled,consumed_at").eq("singleton",true).maybeSingle();
    const {data:cfg,error:cfgError}=await db.from("sms_central_settings")
      .select("sending_enabled,sender_id,global_daily_limit,school_daily_limit")
      .eq("singleton",true).maybeSingle();
    const {data:schoolSender,error:senderError}=await db
      .from("sms_school_sender_ids")
      .select("sender_id,enabled_for_school_sms")
      .eq("school_id",pilotSchool).maybeSingle();
    const {data:pilotStaff,error:staffError}=await db.from("school_users")
      .select("id,phone").eq("school_id",pilotSchool)
      .eq("phone",pilotPhone).eq("active",true).eq("must_change_password",false)
      .eq("sms_opt_in",true).in("role",["ADMIN","ACCOUNTANT"]);
    const {data:pilotSchoolRecord,error:schoolError}=await db.from("schools")
      .select("active,deleted_at").eq("id",pilotSchool).maybeSingle();
    const {count:diagnostics,error:diagnosticsError}=await db.from("sms_test_outbox")
      .select("id",{count:"exact",head:true});
    const available=validPilot&&!permitError&&!!permit?.enabled&&!permit.consumed_at&&
      !cfgError&&cfg?.sending_enabled===false&&cfg.sender_id==="EDUREPORT"&&
      cfg.global_daily_limit===2&&cfg.school_daily_limit===2&&
      !senderError&&schoolSender?.sender_id==="Ark Academy"&&
      schoolSender.enabled_for_school_sms===false&&
      !staffError&&Array.isArray(pilotStaff)&&pilotStaff.length===1&&
      !schoolError&&pilotSchoolRecord?.active===true&&
      pilotSchoolRecord.deleted_at===null&&
      !diagnosticsError&&diagnostics===1&&!!providerKey;
    if(action==="custom_test_status"){
      const {data:recent}=await db.from("sms_test_outbox")
        .select("created_at,status,sender_id,credits_used")
        .like("message","TEST: %").order("created_at",{ascending:false}).limit(2);
      return reply(origin,200,{
        available,used:!!permit?.consumed_at,
        sender_id:"Ark Academy",recipient_ending:allowPhone?pilotPhone.slice(-4):null,
        max_one_message:true,history:recent||[],
        message:available?"One real custom SMS can be sent to the opted-in staging pilot.":
          permit?.consumed_at?"The one-time custom SMS test was already used.":
          "Custom SMS test is not ready. No message will be sent.",
      });
    }
    if(!available)return reply(origin,409,{
      error:"One-time custom test is unavailable or has already been used."
    });
    const raw=typeof data.message==="string"?data.message.trim():"";
    const message="TEST: "+raw;
    if(raw.length<1||raw.length>140||segments(message)!==1||
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message))
      return reply(origin,400,{error:"Write a custom test message that fits one SMS segment."});
    if(!uuid(data.test_request_id)||data.test_confirmed!==true)
      return reply(origin,400,{error:"Confirm the one-time paid test."});
    // Atomic claim. Once consumed, a provider timeout never allows a retry.
    const {data:claimed,error:claimError}=await db.from("guardian_custom_test_permit")
      .update({consumed_at:new Date().toISOString(),consumed_by:actor,
        request_key:data.test_request_id,updated_at:new Date().toISOString()})
      .eq("singleton",true).eq("enabled",true).is("consumed_at",null)
      .select("singleton").maybeSingle();
    if(claimError||!claimed)return reply(origin,409,{
      error:"Test authorization has already been used."
    });
    const {data:audit,error:auditError}=await db.from("sms_test_outbox")
      .insert({request_key:data.test_request_id,requested_by:actor,
        phone_e164:pilotPhone,sender_id:"Ark Academy",message,
        status:"PROCESSING",send_started_at:new Date().toISOString()})
      .select("id").maybeSingle();
    if(auditError||!audit)return reply(origin,500,{
      error:"Could not create a diagnostic audit record. Test permit consumed; no SMS sent."
    });
    let status="UNKNOWN",providerId:string|null=null,credits=0,verified=false;
    let lastError:string|null="Provider response uncertain. Do not retry.";
    try{
      const call=await fetch("https://sms.arkesel.com/api/v2/sms/send",{
        method:"POST",signal:AbortSignal.timeout(12000),
        headers:{"Content-Type":"application/json","api-key":providerKey},
        body:JSON.stringify({sender:"Ark Academy",message,recipients:[pilotPhone]}),
      });
      const body=await call.json().catch(()=>null);
      const item=Array.isArray(body?.data)?body.data[0]:body?.data;
      const accepted=call.ok&&body?.status==="success"&&
        typeof item?.id==="string"&&item.id.length>0;
      const ambiguous=call.ok&&body?.status==="success"&&!accepted;
      status=accepted?"SUBMITTED":ambiguous?"UNKNOWN":"FAILED";
      providerId=accepted?item.id:null;
      lastError=accepted?null:ambiguous?
        "Provider accepted request without tracking ID. Do not retry.":
        "Provider rejected request. Review Arkesel records.";
      const reported=item?.credits_used??body?.credits_used;
      verified=accepted&&reported!==null&&reported!==undefined&&
        (typeof reported==="number"||typeof reported==="string"&&/^\d+$/.test(reported))&&
        Number.isSafeInteger(Number(reported))&&Number(reported)>=0;
      credits=accepted?(verified?Number(reported):1):0;
    }catch{/* UNKNOWN: never retry automatically. */}
    const {error:writeError}=await db.from("sms_test_outbox")
      .update({status,provider_message_id:providerId,credits_used:credits,
        credits_verified:verified,last_error:lastError,updated_at:new Date().toISOString()})
      .eq("id",audit.id).eq("status","PROCESSING");
    if(writeError)return reply(origin,200,{mode:"UNKNOWN",
      message:"Audit update uncertain. Check Arkesel and handset; do not retry."});
    return reply(origin,200,{
      mode:status==="SUBMITTED"?"TEST_SUBMITTED":
        status==="FAILED"?"TEST_FAILED":"UNKNOWN",
      sender_id:"Ark Academy",recipient_ending:pilotPhone.slice(-4),
      message:status==="SUBMITTED"?
        "Arkesel accepted the custom test SMS. Check the handset for delivery.":
        status==="FAILED"?
        "Arkesel rejected the custom SMS. One-time permit consumed.":
        "Provider response is uncertain; check records and handset. Do not retry.",
    });
  }
  if(action==="schools"){
    const query=db.from("schools").select("id,name").eq("active",true)
      .is("deleted_at",null).order("name").limit(500);
    const {data:schools,error}=await (isOperator?query:query.eq("id",staff.school_id));
    if(error)return reply(origin,503,{error:"School list unavailable"});
    return reply(origin,200,{schools:schools||[],platform:isOperator});
  }
  const schoolId=isOperator?(data.school_id||staff.school_id):staff.school_id;
  if(!uuid(schoolId)||(!isOperator&&data.school_id&&data.school_id!==staff.school_id))
    return reply(origin,403,{error:"School selection not authorized"});
  const {data:school,error:schoolError}=await db.from("schools")
    .select("id,name,active,deleted_at").eq("id",schoolId).maybeSingle();
  if(schoolError||!school||!school.active||school.deleted_at)
    return reply(origin,403,{error:"School is inactive or unavailable"});
  const {data:schoolOverride,error:overrideError}=await db.from("sms_school_sender_ids")
    .select("sender_id,enabled_for_school_sms").eq("school_id",schoolId).maybeSingle();
  if(overrideError)return reply(origin,503,{error:"Sender routing unavailable"});
  const schoolSender=schoolOverride?.enabled_for_school_sms?schoolOverride.sender_id:"EDUREPORT";
  const senderOptions=isOperator&&schoolSender==="Ark Academy"
    ?["EDUREPORT","Ark Academy"]:[schoolSender];
  const senderIsAllowed=(chosen:string)=>
    senderOptions.includes(chosen)&&
    (chosen!=="Ark Academy"||school.name==="THE ARK ACADEMY");

  const getStudents=async()=>{
    const result:Student[]=[];
    for(let start=0;start<10000;start+=1000){
      const {data:students,error}=await db.from("students")
        .select("id,school_id,class_id,admission_number,first_name,last_name,status")
        .eq("school_id",schoolId).order("id").range(start,start+999);
      if(error)throw Error("Cannot load school learners");
      result.push(...(students as Student[]||[]));
      if(!students||students.length<1000)break;
    }
    return result;
  };
  const getContacts=async()=>{
    const result:Guardian[]=[];
    for(let start=0;start<10000;start+=1000){
      const {data:contacts,error}=await db.from("guardian_sms_contacts")
        .select("student_id,school_id,guardian_name,phone_e164,consent_status,consent_source,consent_recorded_at")
        .eq("school_id",schoolId).order("student_id").range(start,start+999);
      if(error)throw Error("Cannot load guardian contacts");
      result.push(...(contacts as Guardian[]||[]));
      if(!contacts||contacts.length<1000)break;
    }
    return result;
  };
  const chooseStudents=(students:Student[])=>{
    const active=students.filter(s=>s.status==="ACTIVE");
    if(data.scope==="all")return active;
    if(data.scope==="class"){
      if(!uuid(data.class_id))throw Error("Choose a valid class");
      if(!students.some(s=>s.class_id===data.class_id))
        throw Error("Class has no learners in this school");
      return active.filter(s=>s.class_id===data.class_id);
    }
    if(data.scope==="selected"){
      if(!Array.isArray(data.selected_ids)||data.selected_ids.length<1||
        data.selected_ids.length>500||data.selected_ids.some(id=>!uuid(id)))
        throw Error("Select up to 500 school learners");
      const distinct=new Set(data.selected_ids);
      const list=active.filter(s=>distinct.has(s.id));
      if(list.length!==distinct.size)throw Error("Some learners do not belong to this school");
      return list;
    }
    throw Error("Choose one, multiple, a class or all learners");
  };
  const summary=(students:Student[],contacts:Guardian[])=>{
    const byId=new Map(contacts.map(c=>[c.student_id,c]));
    const phones=new Set<string>(),blockedPhones=new Set(contacts.filter(c=>c.consent_status==="OPTED_OUT").map(c=>c.phone_e164)),reasons={missing:0,consent_needed:0,duplicates:0};
    for(const s of students){
      const contact=byId.get(s.id);
      if(!contact){reasons.missing++;continue;}
      if(contact.consent_status!=="OPTED_IN"||!contact.consent_recorded_at||blockedPhones.has(contact.phone_e164)){
        reasons.consent_needed++;continue;
      }
      if(phones.has(contact.phone_e164)){reasons.duplicates++;continue;}
      phones.add(contact.phone_e164);
    }
    return {
      selected_learners:students.length,eligible_guardians:phones.size,
      missing:reasons.missing,consent_needed:reasons.consent_needed,
      duplicates:reasons.duplicates,
    };
  };

  try{
    if(action==="contacts"){
      const [students,contacts,{data:classes,error:classesError}]=await Promise.all([
        getStudents(),getContacts(),
        db.from("classes").select("id,name").eq("school_id",schoolId).limit(500),
      ]);
      if(classesError)throw Error("Class list is unavailable");
      const byId=new Map(contacts.map(c=>[c.student_id,c]));
      return reply(origin,200,{
        school:{id:school.id,name:school.name},classes:classes||[],
        sender_id:schoolSender,sender_options:senderOptions,platform:isOperator,
        learners:students.filter(s=>s.status==="ACTIVE").map(s=>({
          ...s,guardian:byId.get(s.id)||null,
        })),
      });
    }
    if(action==="save_contact"){
      if(!uuid(data.student_id))throw Error("Select a learner");
      const phone=normalized(data.phone);
      const name=String(data.guardian_name||"").trim().replace(/\s+/g," ");
      if(!phone||name.length<2||name.length>120)throw Error("Enter a valid guardian name and Ghana mobile number");
      const {data:learner}=await db.from("students").select("id").eq("id",data.student_id)
        .eq("school_id",schoolId).eq("status","ACTIVE").maybeSingle();
      if(!learner)throw Error("Learner not active in this school");
      const {error}=await db.from("guardian_sms_contacts").upsert({
        student_id:learner.id,school_id:schoolId,guardian_name:name,phone_e164:phone,
        updated_by:actor,
      },{onConflict:"student_id"});
      if(error)throw Error("Guardian contact could not be saved");
      return reply(origin,200,{saved:1,message:"Contact saved. Consent is required before messaging."});
    }
    if(action==="import_contacts"){
      const rows=data.rows;
      if(!Array.isArray(rows)||rows.length<1||rows.length>200)
        throw Error("Import 1 to 200 CSV rows at once");
      const students=await getStudents();
      const map=new Map(students.filter(s=>s.status==="ACTIVE")
        .map(s=>[s.admission_number.trim().toLowerCase(),s]));
      const used=new Set<string>(),items=[];
      for(const row of rows){
        const key=String(row.admission_number||"").trim().toLowerCase();
        const name=String(row.guardian_name||"").trim();
        const phone=normalized(row.phone);
        const learner=map.get(key);
        if(!learner||used.has(key)||!phone||name.length<2||name.length>120)
          throw Error("Invalid or duplicate admission number, guardian or phone. Correct the CSV before import.");
        used.add(key);
        items.push({
          student_id:learner.id,school_id:schoolId,guardian_name:name,
          phone_e164:phone,consent_status:"PENDING",
          consent_source:null,consent_recorded_at:null,consent_recorded_by:null,
          updated_by:actor,
        });
      }
      const {error}=await db.from("guardian_sms_contacts")
        .upsert(items,{onConflict:"student_id"});
      if(error)throw Error("Contact import failed; verify the file and try again");
      return reply(origin,200,{
        imported:items.length,message:"Contacts imported. None was automatically opted into SMS.",
      });
    }
    if(action==="record_consent"){
      if(!uuid(data.student_id)||!["OPTED_IN","OPTED_OUT"].includes(String(data.consent_action)))
        throw Error("Choose a valid guardian and consent action");
      const source=String(data.consent_source||"").trim();
      if(source.length<12||source.length>300)
        throw Error("Record how the guardian granted or withdrew consent");
      const {data:changed,error}=await db.from("guardian_sms_contacts")
        .update({
          consent_status:data.consent_action,consent_source:source,
          consent_recorded_at:new Date().toISOString(),
          consent_recorded_by:actor,updated_by:actor,
        }).eq("student_id",data.student_id).eq("school_id",schoolId)
        .select("student_id").maybeSingle();
      if(error||!changed)throw Error("Contact is not registered in the selected school");
      return reply(origin,200,{saved:true,message:"Consent preference recorded with an audit timestamp."});
    }
    if(action==="preview"||action==="draft"){
      const [students,contacts]=await Promise.all([getStudents(),getContacts()]);
      const selected=chooseStudents(students);
      if(selected.length===0)throw Error("No active learners in this selection");
      const counts=summary(selected,contacts);
      const message=String(data.message||"").trim();
      const sender=String(data.sender_id||schoolSender);
      if(!senderIsAllowed(sender))throw Error("The selected Sender ID cannot represent this school");
      if(message.length<1||message.length>320)throw Error("Write an SMS of 1–320 characters");
      if(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(message))
        throw Error("Message contains unsupported control characters");
      const parts=segments(message);
      if(parts>6)throw Error("Message is too long for the permitted SMS segment limit");
      const estimatedCredits=counts.eligible_guardians*parts;
      if(action==="preview")return reply(origin,200,{
        school_id:schoolId,sender_id:sender,...counts,
        segments:parts,estimated_credits:estimatedCredits,
        message_preview:message,
        can_send:!isStaging&&sendingAllowed&&!!providerKey,
      });
      if(counts.eligible_guardians===0)throw Error("No opted-in guardians in this selection");
      if(!uuid(data.request_key))throw Error("An idempotent draft request ID is required");
      const {data:draft,error}=await db.rpc("guardian_sms_prepare_draft",{
        p_school_id:schoolId,p_request_key:data.request_key,p_actor:actor,
        p_sender_id:sender,p_message:message,p_segment_estimate:parts,
        p_student_ids:selected.map(s=>s.id),
      });
      if(error)throw Error(error.message||"Draft could not be created");
      return reply(origin,200,{...draft,estimated_credits:estimatedCredits,
        message:"Draft saved; no SMS has been sent."});
    }
    if(action==="campaigns"){
      const {data:campaigns,error}=await db.from("guardian_sms_campaigns")
        .select("id,school_id,sender_id,message_body,status,recipient_count,segment_estimate,created_at,confirmed_at")
        .eq("school_id",schoolId).order("created_at",{ascending:false}).limit(50);
      if(error)throw Error("Campaign history unavailable");
      return reply(origin,200,{campaigns:campaigns||[]});
    }
    if(action==="send"){
      // Separate explicit production authorization required to set this secret.
      if(isStaging||!sendingAllowed||!providerKey)
        return reply(origin,409,{error:"Guardian SMS sending is disabled in staging or awaiting release approval."});
      if(!uuid(data.campaign_id))throw Error("Choose a saved campaign draft");
      const {data:campaign,error:campaignError}=await db.from("guardian_sms_campaigns")
        .select("id,school_id,sender_id,message_body,status,created_by,recipient_count,segment_estimate")
        .eq("id",data.campaign_id).eq("school_id",schoolId).maybeSingle();
      if(campaignError||!campaign)throw Error("Campaign not found in this school");
      const c=campaign as Campaign;
      if(!senderIsAllowed(c.sender_id))throw Error("Sender ID is no longer permitted for this school");
      const {data:config,error:configError}=await db.from("sms_central_settings")
        .select("sending_enabled").eq("singleton",true).maybeSingle();
      if(configError||!config?.sending_enabled)
        throw Error("Central SMS sending has not been enabled");
      const {data:authorization,error:permitError}=await db.rpc("guardian_sms_authorize_campaign",{
        p_campaign_id:c.id,p_actor:actor,
      });
      if(permitError)throw Error(permitError.message||"Campaign could not be authorized");
      if(authorization?.duplicate&&authorization?.status!=="QUEUED"&&
         authorization?.status!=="PROCESSING")
        return reply(origin,200,{mode:"ALREADY_PROCESSED",...authorization});
      const {data:claimed,error:claimError}=await db.rpc("guardian_sms_claim_batch",{
        p_campaign_id:c.id,p_max:10,
      });
      if(claimError)throw Error("Could not safely claim recipient batch");
      let submitted=0,failed=0,unknown=0;
      for(const item of claimed||[]){
        const {data:nowConsented,error:consentError}=await db.from("guardian_sms_contacts")
          .select("student_id,phone_e164,consent_status,consent_recorded_at")
          .eq("school_id",schoolId).eq("phone_e164",item.phone_e164);
        const consentValid=!consentError&&Array.isArray(nowConsented)&&
          !nowConsented.some(x=>x.consent_status==="OPTED_OUT") && nowConsented.some(
            (x)=>item.student_ids.includes(x.student_id)&&x.consent_status==="OPTED_IN"&&!!x.consent_recorded_at
          );
        let status="UNKNOWN",providerId:string|null=null,credits=0,verified=false;
        let lastError:string|null="Provider response uncertain. Do not retry.";
        if(!consentValid){
          status="FAILED";failed++;lastError="Guardian consent changed or could not be verified; no message sent.";
        }else{
          try{
            const call=await fetch("https://sms.arkesel.com/api/v2/sms/send",{
              method:"POST",signal:AbortSignal.timeout(12000),
              headers:{"Content-Type":"application/json","api-key":providerKey},
              body:JSON.stringify({sender:c.sender_id,message:c.message_body,recipients:[item.phone_e164]}),
            });
            const body=await call.json().catch(()=>null);
            const provider=Array.isArray(body?.data)?body.data[0]:body?.data;
            const accepted=call.ok&&body?.status==="success"&&
              typeof provider?.id==="string"&&provider.id.length>0;
            const ambiguous=call.ok&&body?.status==="success"&&!accepted;
            status=accepted?"SUBMITTED":ambiguous?"UNKNOWN":"FAILED";
            if(accepted)submitted++;else if(ambiguous)unknown++;else failed++;
            providerId=accepted?provider.id:null;
            lastError=accepted?null:ambiguous?"Provider response missing message ID; do not retry.":
              "Arkesel rejected request; inspect provider dashboard.";
            const raw=provider?.credits_used??body?.credits_used;
            verified=accepted&&raw!==null&&raw!==undefined&&
              (typeof raw==="number"||typeof raw==="string"&&/^\d+$/.test(raw))&&
              Number.isSafeInteger(Number(raw))&&Number(raw)>=0;
            credits=accepted?(verified?Number(raw):c.segment_estimate):0;
          }catch{unknown++;}
        }
        await db.from("guardian_sms_recipients")
          .update({status,provider_message_id:providerId,credits_used:credits,
            credits_verified:verified,last_error:lastError,updated_at:new Date().toISOString()})
          .eq("id",item.id).eq("status","PROCESSING");
      }
      const {data:recipients,error:resultError}=await db.from("guardian_sms_recipients")
        .select("status").eq("campaign_id",c.id);
      if(resultError)throw Error("Provider outcome recorded; campaign summary pending");
      const left=(recipients||[]).filter(r=>r.status==="QUEUED"||r.status==="PROCESSING").length;
      if(!left){
        const partial=(recipients||[]).some(r=>r.status!=="SUBMITTED"&&r.status!=="DELIVERED");
        await db.from("guardian_sms_campaigns")
          .update({status:partial?"PARTIAL":"COMPLETE",updated_at:new Date().toISOString()})
          .eq("id",c.id);
      }
      return reply(origin,200,{
        mode:left?"BATCH_SUBMITTED":"CAMPAIGN_FINISHED",
        submitted,failed,unknown,remaining:left,
        message:left?"Batch submitted. Confirm remaining batches only after checking provider records.":
          "Campaign processing completed. SUBMITTED is provider acceptance, not handset delivery.",
      });
    }
    return reply(origin,400,{error:"Unknown action"});
  }catch(error){
    const reason=error instanceof Error?error.message:"Guardian message request failed";
    return reply(origin,400,{error:reason});
  }
});
