/* Expenses & Advances, Approvals, My cards & wallets, Transactions, Disputes, My benefits.
   Records, statuses and approval routes follow the web app (Default - Manager then Finance; card loads by the Card approver). */
const SUBS={'Travel Reimbursement':['One Way','Round Trip','Local Conveyance'],'Accommodation':['Hotel Stay','Guest House'],'Meal Allowance':['Working Meal','Client Meal'],'Office Events':['Monthly','One-time'],'Telecom':['Mobile Bill','Internet'],'Office Supplies':['Stationery','Equipment']};
const ADV_SUBS=['Travel Advance','Event Advance','Project Advance'];
const PAID={Employee:'Paid by me','Corporate Card':'Company card','Company Advance':'Travel advance'};
const MCC={'4121':'Taxi and cabs','5812':'Restaurant','5814':'Café and fast food','5541':'Fuel station','5943':'Stationery','7523':'Parking','7011':'Hotel','7338':'Printing','4814':'Telecom','5732':'Electronics'};
const WICON={CORP:'corp',MEAL:'meal',FUEL:'fuel',GIFT:'gift',TEL:'tel'};
const FIN_UID='U-1029',FIN_ALT_UID='U-1038',CARD_APPR_UID='U-1031';
const DB=function(){return MStore.db;};

function reqTotal(r){return (r.lines||[]).reduce(function(s,l){return s+(+l.amount||0);},0);}
function allReqs(){return DB().expenses.concat(DB().advances);}
function findRec(ref){return allReqs().concat(DB().loads).find(function(r){return r.ref===ref;})||null;}
function ownerEid(r){if(r.kind==='card load'){const c=cardById(r.cardId);return c?c.employeeEid:'';}return r.employeeEid;}
function ownerOf(r){return P.byEid(ownerEid(r));}
function myReqs(){const e=me().eid;return allReqs().filter(function(r){return r.employeeEid===e;}).sort(function(a,b){const d=cmpIso(b.appliedOn||'',a.appliedOn||'');return d||((b.id||0)-(a.id||0));});}
function expDraftCount(){return myReqs().filter(function(r){return r.status==='Draft';}).length;}
function decWord(d){return {Approve:'Approved',Approved:'Approved',Reject:'Rejected',Rejected:'Rejected','Follow-Up':'Sent back'}[d.decision||'Approved']||d.decision;}
function showStatus(r){if(r.kind==='expense'&&r.status==='Approved'&&r.pay&&r.pay.status==='Paid')return 'Paid';
  if(r.kind==='advance'&&r.status==='Approved'){return advIssued(r)?'Paid':'Approved';}
  return {'Awaiting Approval':'Awaiting approval','Follow-Up':'Sent back'}[r.status]||r.status;}
function tone(s){return /Paid|Approved|Recorded|Closed|Resolved/.test(s)?'ok':/Reject|Failed|Block/.test(s)?'bad':/Draft|Withdrawn|Not /.test(s)?'mut':'warn';}
function kindLabel(r){return r.kind==='advance'?'Advance':r.kind==='card load'?'Card load':'Claim';}
function cardById(id){return DB().cards.find(function(c){return c.id===id;})||null;}
function walletName(code){return {CORP:'Corporate Expense',MEAL:'Meal',FUEL:'Fuel',GIFT:'Gift',TEL:'Telecom'}[code]||code;}

/* ── Approval routes (web: AWF-18 / AWF-19; card loads: Card approver review) ── */
function uidOfEid(eid){return P.userOf(P.byEid(eid));}
function stageOneApprovers(ownerE,creatorUid){let m=(P.byEid(ownerE)||{}).managerEid;let u=uidOfEid(m);
  if(u&&u===creatorUid){const cm=(P.byUser(creatorUid)||{}).managerEid;u=uidOfEid(cm);} return u?[u]:[];}
function financeApprover(r){const used=[uidOfEid(ownerEid(r)),r.createdBy].concat((r.wf&&r.wf.stages||[]).reduce(function(a,s){return a.concat((s.decisions||[]).map(function(d){return d.who;}));},[]));return used.indexOf(FIN_UID)>=0?FIN_ALT_UID:FIN_UID;}
function buildWf(kind,ownerE,creatorUid){return {wfKey:kind==='advance'?'AWF-19':'AWF-18',wfName:kind==='advance'?'Advance - Manager then Finance':'Default - Manager then Finance',open:true,current:0,
  stages:[{n:1,name:'Manager review',type:'Reporting Manager',approvers:stageOneApprovers(ownerE,creatorUid),status:'Awaiting Decision',decisions:[]},{n:2,name:'Finance review',type:'Finance',approvers:[],status:'Not Started',decisions:[]}]};}
function activeStage(r){return r.wf&&r.wf.open?r.wf.stages[r.wf.current]||null:null;}
function canDecide(r,uid){const st=activeStage(r);if(!st||st.status!=='Awaiting Decision')return false;if((st.approvers||[]).indexOf(uid)<0)return false;
  if(uidOfEid(ownerEid(r))===uid||r.createdBy===uid)return false;return true;}
function approvalsFor(uid){if(!uid)return [];return allReqs().concat(DB().loads).filter(function(r){return canDecide(r,uid);});}
function decidedBy(uid){return allReqs().concat(DB().loads).filter(function(r){return r.wf&&r.wf.stages.some(function(s){return (s.decisions||[]).some(function(d){return d.who===uid;});});});}
function isApprover(){const p=me(),u=myUid();if(!p)return false;if(P.reports(p).length||p.dept==='Finance')return true;return allReqs().concat(DB().loads).some(function(r){return r.wf&&r.wf.stages.some(function(s){return (s.approvers||[]).indexOf(u)>=0;});});}
function logTo(r,status,action){const n=MStore.now();r.logs=r.logs||[];r.logs.unshift({date:n.date,time:n.time,user:me().name,userId:myUid(),status:status,action:action});}
function names(uids){return (uids||[]).map(P.nameOfUser).join(', ')||'an approver';}
function decide(r,decision,comment){const st=activeStage(r),who=me().name;
  MStore.act('approval.'+decision.toLowerCase(),r.ref,{stage:st.n,comment:comment},function(){const n=MStore.now();
    st.decisions=st.decisions||[];st.decisions.push({who:myUid(),date:n.date,time:n.time,decision:{Approve:'Approved',Reject:'Rejected','Follow-Up':'Follow-Up'}[decision],reason:comment});
    if(decision==='Approve'){st.status='Approved';const nx=r.wf.stages[r.wf.current+1];
      if(nx){r.wf.current++;nx.status='Awaiting Decision';if(!nx.approvers||!nx.approvers.length)nx.approvers=[financeApprover(r)];
        logTo(r,r.status,'Stage '+st.n+' ('+st.name+') approved by '+who+(comment?': '+comment:'')+'. Stage '+nx.n+' of '+r.wf.stages.length+' ('+nx.name+') assigned to '+names(nx.approvers)+'.');}
      else{r.wf.open=false;r.status='Approved';r.finalAt=TODAY();r.approvedAmt=reqTotal(r)||r.amount;(r.lines||[]).forEach(function(l){l.status='Approved';l.approved=l.amount;});
        if(r.kind==='expense'){const pay=(r.lines||[]).filter(function(l){return l.paidBy==='Employee';}).reduce(function(s,l){return s+(+l.amount||0);},0);
          r.pay={status:pay>0?'Ready for Payment':'Not Applicable',payable:pay,settled:0,route:'',events:[]};
          logTo(r,'Approved','Final approval complete: '+money(r.approvedAmt)+' approved by '+who+'. '+(pay>0?'Reimbursement of '+money(pay)+' is ready for payment.':'Nothing to reimburse (paid by company card or advance).'));}
        else if(r.kind==='advance')logTo(r,'Approved','Final approval complete: '+money(r.approvedAmt)+' approved by '+who+'. Ready for Finance to pay.');
        else logTo(r,'Approved','Card load approved by '+who+'. Finance records the load with the card provider.');}}
    else if(decision==='Reject'){st.status='Rejected';r.wf.open=false;r.status='Rejected';r.rejectReason=comment;logTo(r,'Rejected','Rejected by '+who+' at stage '+st.n+' ('+st.name+'): '+comment);}
    else{st.status='Follow-Up Requested';r.status='Follow-Up';r.followUp={by:myUid(),comment:comment,date:TODAY()};logTo(r,'Follow-Up','Sent back by '+who+' for more information: '+comment);}});}

/* ── Things that need the person's attention (Home) and notifications ── */
function advIssued(a){return (a.ledger||[]).filter(function(x){return x.type==='Issuance';}).reduce(function(s,x){return s+x.amount;},0);}
function advUsed(a){return (a.ledger||[]).filter(function(x){return x.type==='Utilization';}).reduce(function(s,x){return s+x.amount;},0);}
function advReturned(a){return (a.ledger||[]).filter(function(x){return x.type==='Return';}).reduce(function(s,x){return s+x.amount;},0);}
function advBalance(a){return advIssued(a)-advUsed(a)-advReturned(a);}
function advReturnBy(a){return addDays(a.periodTo||TODAY(),7);}
function expAttention(){const out=[];myReqs().forEach(function(r){
  if(r.status==='Draft')out.push({icon:'receipt',t:'Finish your draft '+r.ref,s:r.title,go:'#/r/'+r.ref});
  if(r.status==='Follow-Up')out.push({icon:'receipt',t:r.ref+' was sent back',s:(r.followUp||{}).comment||'',go:'#/r/'+r.ref});
  if(r.kind==='advance'&&r.status==='Approved'&&advIssued(r)&&advBalance(r)>0&&advUsed(r)>0)out.push({icon:'adv',t:'Return '+money(advBalance(r))+' from '+r.ref,s:'Due by '+MFmt.date(advReturnBy(r)),go:'#/r/'+r.ref});});return out;}
function expNotices(){const out=[],p=me();if(!p)return out;const u=myUid();
  approvalsFor(u).forEach(function(r){const o=ownerOf(r);out.push({id:'ap-'+r.ref+'-'+(r.wf.current||0),icon:'approve',t:(o?o.name+'’s ':'')+kindLabel(r).toLowerCase()+' '+r.ref+' needs your approval',s:r.title||r.reason||'',when:TODAY(),go:'#/r/'+r.ref});});
  myReqs().filter(function(r){return r.status!=='Draft';}).forEach(function(r){const st=showStatus(r);const lg=(r.logs||[])[0]||{};
    out.push({id:'st-'+r.ref+'-'+r.status+'-'+(r.logs||[]).length,icon:r.kind==='advance'?'adv':'receipt',t:r.ref+' · '+st,s:lg.action?lg.action.slice(0,90):r.title,when:TODAY(),go:'#/r/'+r.ref});});
  myCards().forEach(function(c){DB().loads.filter(function(l){return l.cardId===c.id&&l.status==='Approved'&&l.wallet!=='CORP';}).slice(0,4).forEach(function(l){out.push({id:'ld-'+l.ref,icon:WICON[l.wallet]||'wallet',t:money(l.amount)+' loaded to your '+walletName(l.wallet)+' wallet',s:l.ref+' · card •••• '+c.last4,when:TODAY(),go:'#/cards'});});});
  DB().disputes.filter(function(d){return d.employeeEid===p.eid;}).forEach(function(d){out.push({id:'dsp-'+d.ref+'-'+d.status,icon:'dispute',t:'Dispute '+d.ref+' · '+d.status,s:d.merchant+' · '+money(d.amount),when:d.iso||TODAY(),go:'#/t/'+d.txnKey});});
  return out;}

/* ── Expenses list ── */
route('/expenses',function(){const all=myReqs(),f=M.state.ex||(M.state.ex={kind:'All',q:'',sort:'new',st:'All'});
  if(!all.length)return {title:'Expenses',up:'#/more',tab:'more',html:emptyHTML('receipt','No claims yet','Claim business expenses or request an advance. Track every request here.','<button class="btn" data-act="rqNew">New request</button>')};
  const claims=all.filter(function(r){return r.kind==='expense';});
  const sub=claims.filter(function(r){return r.status!=='Draft'&&r.status!=='Withdrawn';}).reduce(function(s,r){return s+reqTotal(r);},0);
  const paid=claims.reduce(function(s,r){return s+((r.pay&&r.pay.settled)||0);},0);
  const drafts=all.filter(function(r){return r.status==='Draft';});
  let list=all.filter(function(r){return r.status!=='Draft';});
  if(f.kind!=='All')list=list.filter(function(r){return kindLabel(r)===f.kind;});
  if(f.st!=='All')list=list.filter(function(r){return showStatus(r)===f.st;});
  if(f.q)list=list.filter(function(r){return (r.title+' '+r.ref+' '+(r.category||'')).toLowerCase().indexOf(f.q.toLowerCase())>=0;});
  list.sort(function(a,b){if(f.sort==='hi')return reqTotal(b)-reqTotal(a);if(f.sort==='lo')return reqTotal(a)-reqTotal(b);const d=(b.key||0)-(a.key||0);return f.sort==='old'?-d:d;});
  const row=function(r){const st=showStatus(r),n=(r.lines||[]).filter(function(l){return l.proof;}).length;
    const meta=r.kind==='advance'?'Advance · '+E(r.category)+' · needed by '+E(MFmt.dshort(r.requiredBy)):E(r.category)+' · '+E(MFmt.dshort(r.appliedOn))+' · '+n+' receipt'+(n===1?'':'s');
    let extra='';if(r.status==='Rejected')extra='<div class="callout bad" style="margin:0 16px 14px">'+E(r.rejectReason||'Rejected')+'<button class="btn sm sec" style="margin-top:10px" data-act="rqCopy" data-ref="'+r.ref+'">Edit and resubmit</button></div>';
    if(r.status==='Follow-Up')extra='<div class="callout warn" style="margin:0 16px 14px"><b>'+E(P.nameOfUser((r.followUp||{}).by))+':</b> '+E((r.followUp||{}).comment||'')+'<button class="btn sm sec" style="margin-top:10px" data-go="#/r/'+r.ref+'">Respond</button></div>';
    return '<div><div class="row tap" data-go="#/r/'+r.ref+'"'+(extra?' style="border-bottom:0"':'')+'><div class="row-m"><div class="row-t">'+E(r.title)+'</div><div class="row-s">'+meta+'</div></div><div class="row-r"><span class="b num">'+money(reqTotal(r))+'</span>'+badge(st,tone(st))+'</div></div>'+extra+'</div>';};
  let html='<div class="card"><div class="tiles t3"><div class="tile flat"><span class="lbl">Submitted</span><div class="val num">'+money(sub)+'</div></div><div class="tile flat"><span class="lbl">Reimbursed</span><div class="val num ok-t">'+money(paid)+'</div></div><div class="tile flat"><span class="lbl">Drafts</span><div class="val">'+drafts.length+'</div></div></div></div>'
   +'<button class="btn" style="margin-top:12px" data-act="rqNew">New request</button>';
  if(drafts.length)html+='<div class="h2">Drafts <span class="meta" style="font-weight:400">— not submitted yet. Finish these to get paid.</span></div><div class="card p0">'+drafts.map(function(r){return '<div class="row"><div class="row-m"><div class="row-t">'+E(r.title)+'</div><div class="row-s">'+E(r.ref)+' · '+(r.lines||[]).length+' item'+((r.lines||[]).length===1?'':'s')+' · '+money(reqTotal(r))+'</div></div>'+badge('Draft','mut')+'<button class="btn sm sec" data-go="#/r/'+r.ref+'">Continue</button></div>';}).join('')+'</div>';
  html+='<div class="h2">All requests</div><div class="tools"><label class="search">'+ic('search',18)+'<input id="ex-q" placeholder="Search" value="'+E(f.q)+'"></label><button class="pill" data-act="exSort">Sort '+ic('sort',16)+'</button><button class="pill'+(f.st!=='All'?' on':'')+'" data-act="exStatus">'+(f.st==='All'?'Status':E(f.st))+' '+ic('down',16)+'</button></div>'
   +'<div class="chips" style="margin-top:10px">'+['All','Claim','Advance'].map(function(k){return '<button class="pill'+(f.kind===k?' on':'')+'" data-act="exKind" data-k="'+k+'">'+(k==='All'?'All':k+'s')+'</button>';}).join('')+'</div>'
   +'<div class="card p0" style="margin-top:12px">'+(list.length?list.map(row).join(''):'<div class="row"><div class="meta">No requests match.</div></div>')+'</div>';
  return {title:'Expenses',up:'#/more',tab:'more',html:html,after:function(){const q=document.getElementById('ex-q');q.addEventListener('change',function(){f.q=q.value.trim();render();});q.addEventListener('search',function(){f.q=q.value.trim();render();});}};});
M.acts.exKind=function(el){M.state.ex.kind=el.getAttribute('data-k');render();};
M.acts.exSort=function(){const f=M.state.ex,o=[['new','Newest first'],['old','Oldest first'],['hi','Amount: high to low'],['lo','Amount: low to high']];
  sheet('Sort by',o.map(function(x){return '<button class="opt'+(f.sort===x[0]?' on':'')+'" data-act="exSortSet" data-v="'+x[0]+'">'+x[1]+(f.sort===x[0]?'<span>'+ic('check',20)+'</span>':'')+'</button>';}).join(''),{reset:'exSortReset'});};
M.acts.exSortSet=function(el){M.state.ex.sort=el.getAttribute('data-v');closeSheet();render();};
M.acts.exSortReset=function(){M.state.ex.sort='new';closeSheet();render();};
M.acts.exStatus=function(){const f=M.state.ex,o=['All','Awaiting approval','Sent back','Approved','Paid','Rejected','Withdrawn'];
  sheet('Status',o.map(function(x){return '<button class="opt'+(f.st===x?' on':'')+'" data-act="exStSet" data-v="'+x+'">'+x+(f.st===x?'<span>'+ic('check',20)+'</span>':'')+'</button>';}).join(''),{reset:'exStReset'});};
M.acts.exStSet=function(el){M.state.ex.st=el.getAttribute('data-v');closeSheet();render();};
M.acts.exStReset=function(){M.state.ex.st='All';closeSheet();render();};

/* ── New request: Category (Expense claim | Advance) → Sub Category → Expense Type, line items, receipts ── */
function blankLine(){return {title:'',date:TODAY(),merchant:'',invoice:'',amount:'',paidBy:'Employee',file:'',size:'',att:null,busy:false,auto:{}};}
function fsize(n){return n>1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';}
/* Attachments (js/att.js): the file is saved on the phone; the form and the claim keep a link to it. */
function attTile(link,act,label){return '<button class="att" '+act+'><span class="att-th">'+(link.src?'<img src="'+E(link.src)+'" alt="">':'<img data-att-id="'+E(link.id)+'" alt="">')+'</span><span class="att-m"><span class="att-n">'+E(link.name||label)+'</span><span class="cap">'+E(label)+' · Tap to view</span></span><span class="chev">'+ic('chev',16)+'</span></button>';}
function lineAtt(r,l){return l.att||MAtt.seed(r.ref,l.id,l.proof);}
/* Item receipts and the advance document: one Attach button that picks a photo or PDF already on the phone
   (photographing a receipt is done with Take photo in Scan receipt at the top). */
function attachBtn(attrs){return '<div class="pick2"><label class="btn sec pick-b">'+ic('clip',18)+'Attach<input type="file" accept="image/*,application/pdf" '+attrs+'></label></div><div class="cap" style="margin-top:6px">Photo or PDF from your phone, up to 10 MB</div>';}
function advAtt(r){return r.att||MAtt.seed(r.ref,'doc',r.proof);}
/* Save a picked file for a form item (obj = a line, or the advance); the form redraws when it is ready. */
function rqAttach(f,obj,file,from){obj.file=file.name&&!/^image\.\w+$/i.test(file.name)?file.name:'receipt-'+String(Date.now()).slice(-6)+'.jpg';obj.size='';obj.att=null;obj.busy=true;
  const again=function(){if(M.state.rq===f&&/^#\/expenses\/new/.test(location.hash)){rqRead();render();}};
  return MAtt.save(file,from).then(function(link){obj.att=link;obj.file=link.name;obj.size=fsize(link.size)+(link.from==='pdf'?' · PDF saved as an image':'');obj.busy=false;again();})
    .catch(function(e){obj.busy=false;obj.file='';obj.size='';obj.att=null;again();toast(e&&e.message?e.message:'Could not attach the file. Try again.');});}
function rqBusy(f){return f.type==='claim'?f.lines.some(function(l){return l.busy;}):!!(f.adv&&f.adv.busy);}
M.acts.attForm=function(el){const f=M.state.rq;if(!f)return;rqRead();const i=el.getAttribute('data-i'),o=i==='doc'?f.adv:f.lines[+i];if(o&&o.att)MAtt.view(o.att,i==='doc'?'Advance document':'Receipt · Item '+(+i+1));};
M.acts.attView=function(el){const r=findRec(el.getAttribute('data-ref'));if(!r)return;const i=el.getAttribute('data-i');
  if(i==='doc'){MAtt.view(advAtt(r),r.ref+' · Advance document');return;}
  const l=r.lines[+i];if(l)MAtt.view(lineAtt(r,l),r.ref+' · Item '+(+i+1)+(l.title?' · '+l.title:''));};
function rqBlank(){return {type:'claim',title:'',forWho:'self',forEid:'',subCat:'',expType:'',lines:[blankLine()],notes:'',just:'',adv:{sub:'Travel Advance',amount:'',requiredBy:addDays(TODAY(),3),from:addDays(TODAY(),4),to:addDays(TODAY(),6),cc:'',purpose:'',file:''},editRef:''};}
M.acts.rqNew=function(){M.state.rq=rqBlank();go('#/expenses/new');};
M.acts.rqNewAdv=function(){M.state.rq=rqBlank();M.state.rq.type='advance';go('#/expenses/new');};
function myOpenAdvances(eid){return DB().advances.filter(function(a){return a.employeeEid===eid&&a.status==='Approved'&&advIssued(a)&&advBalance(a)>0;});}
function myCards(){const p=me();return p?DB().cards.filter(function(c){return c.employeeEid===p.eid;}):[];}
function policyFor(f,ownerE){if(f.type!=='claim'||!f.subCat)return null;const p=P.byEid(ownerE)||me();const tot=f.lines.reduce(function(s,l){return s+(+l.amount||0);},0);
  const month=TODAY().slice(0,7),prior=DB().expenses.filter(function(r){return r.employeeEid===p.eid&&r.category===f.subCat&&['Awaiting Approval','Approved','Follow-Up'].indexOf(r.status)>=0&&(r.appliedOn||'').slice(0,7)===month&&r.ref!==f.editRef;}).reduce(function(s,r){return s+reqTotal(r);},0);
  if(f.subCat==='Travel Reimbursement'){const lim=p.dept==='Sales'?5000:3000;return {name:(p.dept==='Sales'?'Sales':'Local')+' travel limit',limit:lim,used:prior,now:tot,over:prior+tot-lim,per:'a month'};}
  if(f.subCat==='Accommodation'){const mx=f.lines.reduce(function(m,l){return Math.max(m,+l.amount||0);},0);return {name:'Hotel limit',limit:4500,used:0,now:mx,over:mx-4500,per:'a night'};}
  if(f.subCat==='Meal Allowance'){const mx=f.lines.reduce(function(m,l){return Math.max(m,+l.amount||0);},0);return {name:'Meal limit',limit:1500,used:0,now:mx,over:mx-1500,per:'a meal'};}
  return null;}
function rqRead(){const f=M.state.rq;if(!f)return;const g=function(id,d){const el=document.getElementById(id);return el?el.value:d;};
  f.title=g('rq-title',f.title).trim();f.notes=g('rq-notes',f.notes);f.just=g('rq-just',f.just);
  if(document.getElementById('rq-for'))f.forWho=g('rq-for',f.forWho);if(document.getElementById('rq-member'))f.forEid=g('rq-member',f.forEid);
  if(f.type==='claim'){f.subCat=g('rq-sub',f.subCat);f.expType=g('rq-type',f.expType);
    f.lines.forEach(function(l,i){l.title=g('ln-t-'+i,l.title).trim();l.date=g('ln-d-'+i,l.date);l.merchant=g('ln-m-'+i,l.merchant).trim();l.invoice=g('ln-i-'+i,l.invoice||'').trim();l.amount=g('ln-a-'+i,l.amount);l.paidBy=g('ln-p-'+i,l.paidBy);});}
  else{const a=f.adv;a.sub=g('av-sub',a.sub);a.amount=g('av-amt',a.amount);a.requiredBy=g('av-req',a.requiredBy);a.from=g('av-from',a.from);a.to=g('av-to',a.to);a.cc=g('av-cc',a.cc);a.purpose=g('av-pur',a.purpose);}}
route('/expenses/new',function(){if(!M.state.rq)M.state.rq=rqBlank();const f=M.state.rq,p=me(),reps=P.reports(p);
  const owner=f.forWho==='team'&&f.forEid?P.byEid(f.forEid):p;
  const A=f.auto||{};
  /* Scan receipt: title, then Take photo and Gallery. Take photo needs capture: without it newer
     Android phones open only the gallery. Gallery picks a photo already on the phone. */
  let html='<div class="scan scan-card"><div class="scan-h"><span class="ico">'+ic('camera',20)+'</span><div class="row-m"><div class="b">Scan receipt</div><div class="cap">Details fill in for you</div></div></div>'
    +'<div class="pick2"><label class="btn pick-b">'+ic('camera',18)+'Take photo<input type="file" id="rq-scan" accept="image/*" capture="environment"></label>'
    +'<label class="btn sec pick-b">'+ic('image',18)+'Gallery<input type="file" id="rq-scan-g" accept="image/*"></label></div></div>';
  if(f.scan)html+='<div class="callout ok" style="margin:0 0 12px"><b>Filled from the receipt:</b> '+E(f.scan.filled.join(', '))+'. Check the highlighted fields and fill the rest.'+(f.scan.fields.tax?'<div class="cap" style="margin-top:4px">GST on receipt '+money(f.scan.fields.tax)+(f.scan.fields.gstin?' · GSTIN '+E(f.scan.fields.gstin):'')+'</div>':'')+(f.scan.fields.currency&&f.scan.fields.currency!=='INR'?'<div class="cap warn-t" style="margin-top:4px">The receipt is in '+E(f.scan.fields.currency)+'. Enter the amount in INR.</div>':'')+'<div style="margin-top:6px"><button class="link" data-act="scanText">View scanned text</button></div></div>';
  html+='<div class="card"><div class="lbl" style="margin-bottom:6px">Category <span class="req">*</span></div><div class="seg"><button class="'+(f.type==='claim'?'on':'')+'" data-act="rqType" data-t="claim">Expense claim</button><button class="'+(f.type==='advance'?'on':'')+'" data-act="rqType" data-t="advance">Advance</button></div>'
   +field('Title',input('rq-title',f.title,{ph:f.type==='claim'?'e.g. Client visit — Whitefield':'e.g. Pune client visits',auto:A.title}),{req:true});
  if(reps.length){html+=field(f.type==='claim'?'Claim for':'Request for',select('rq-for',[['self','Self'],['team','Team member']],f.forWho));
    if(f.forWho==='team')html+=field('Team member',select('rq-member',reps.map(function(x){return [x.eid,x.name+' · '+x.empId];}),f.forEid,{ph:'Select a team member'}),{req:true});}
  html+='<div class="idbox"><div class="b">'+E(owner.name)+' · '+E(owner.empId)+'</div><div class="cap">'+E(owner.email)+'</div></div>';
  if(f.type==='claim'){
    html+=field('Sub Category',select('rq-sub',Object.keys(SUBS),f.subCat,{ph:'Select Sub Category',auto:A.subCat}),{req:true})
     +field('Expense Type',select('rq-type',f.subCat?SUBS[f.subCat]:[],f.expType,{ph:f.subCat?'Select Expense Type':'Select a Sub Category first',lock:!f.subCat,auto:A.expType}),{req:true})+'</div>';
    const advs=myOpenAdvances(owner.eid),cards=DB().cards.filter(function(c){return c.employeeEid===owner.eid&&c.status==='Active';});
    const pays=[['Employee','Paid by me']].concat(cards.length?[['Corporate Card','Company card •••• '+cards[0].last4]]:[]).concat(advs.length?[['Company Advance','Advance '+advs[0].ref+' (₹'+advBalance(advs[0]).toLocaleString('en-IN')+' left)']]:[]);
    html+='<div class="h2">Items</div>'+f.lines.map(function(l,i){return '<div class="item"><div class="item-h"><span class="b">Item '+(i+1)+'</span>'+(f.lines.length>1?'<button class="rm" data-act="lnDel" data-i="'+i+'">Remove</button>':'')+'</div>'
      +field('Description',input('ln-t-'+i,l.title,{ph:'e.g. Cab to client office',auto:(l.auto||{}).title}),{req:true})
      +'<div class="two">'+field('Date',input('ln-d-'+i,l.date,{type:'date',max:TODAY(),auto:(l.auto||{}).date}),{req:true})+field('Amount (INR ₹)',input('ln-a-'+i,l.amount,{type:'number',mode:'decimal',ph:'0',auto:(l.auto||{}).amount}),{req:true})+'</div>'
      +field('Merchant / Vendor',input('ln-m-'+i,l.merchant,{ph:'Where you paid',auto:(l.auto||{}).merchant}))+field('Invoice / Receipt No.',input('ln-i-'+i,l.invoice||'',{ph:'e.g. INV-20931',auto:(l.auto||{}).invoice}))
      +field('Paid by',select('ln-p-'+i,pays,l.paidBy),{req:true})
      +'<div class="fg"><span class="lbl">Receipt'+(l.paidBy==='Employee'?' <span class="req">*</span>':'')+'</span>'+(l.file?'<div class="file" style="border:0">'
        +(l.busy?'<span class="ico"><span class="spin dark sm"></span></span>':l.att?'<button class="att-th sm" data-act="attForm" data-i="'+i+'" aria-label="View receipt"><img data-att-id="'+E(l.att.id)+'" alt=""></button>':'<span class="ico">'+ic(/\.pdf$/i.test(l.file)?'file':'camera')+'</span>')
        +'<div class="row-m"><div class="row-t" style="font-size:14px">'+E(l.file)+'</div><div class="cap">'+(l.busy?'Saving the receipt…':E(l.size||''))+'</div></div><button class="rm" data-act="lnFileDel" data-i="'+i+'">Remove</button></div>'
        :attachBtn('data-ln="'+i+'" data-src="file"'))+'</div></div>';}).join('')
      +'<button class="btn sec" style="margin-top:10px" data-act="lnAdd">'+ic('plus',18)+' Add another item</button>'
      +'<div class="total"><span>Total</span><span class="num" id="rq-total">'+money(f.lines.reduce(function(s,l){return s+(+l.amount||0);},0))+'</span></div><div id="rq-pol"></div>'
      +'<div class="card" style="margin-top:12px">'+field('Notes for your approver',textarea('rq-notes',f.notes,'Optional'))+'</div>';}
  else{const a=f.adv;
    html+=field('Sub Category',select('av-sub',ADV_SUBS,a.sub),{req:true})+field('Amount (INR ₹)',input('av-amt',a.amount,{type:'number',mode:'decimal',ph:'0'}),{req:true})
     +field('Needed by',input('av-req',a.requiredBy,{type:'date',min:TODAY()}),{req:true})
     +'<div class="two">'+field('Trip from',input('av-from',a.from,{type:'date',min:TODAY()}))+field('Trip to',input('av-to',a.to,{type:'date',min:TODAY()}))+'</div>'
     +field('Cost centre',select('av-cc',['Sales - West','Sales - South','Operations','Finance','Administration'],a.cc||(owner.dept==='Sales'?'Sales - South':owner.dept),{ph:'Select'}))
     +field('Purpose',textarea('av-pur',a.purpose,'What is the advance for?'),{req:true})
     +'<div class="fg"><span class="lbl">Itinerary or quote (optional)</span>'+(a.file?'<div class="file" style="border:0">'
       +(a.busy?'<span class="ico"><span class="spin dark sm"></span></span>':a.att?'<button class="att-th sm" data-act="attForm" data-i="doc" aria-label="View document"><img data-att-id="'+E(a.att.id)+'" alt=""></button>':'<span class="ico">'+ic('file')+'</span>')
       +'<div class="row-m"><div class="row-t" style="font-size:14px">'+E(a.file)+'</div><div class="cap">'+(a.busy?'Saving the file…':E(a.size||''))+'</div></div><button class="rm" data-act="avFileDel">Remove</button></div>':attachBtn('id="av-file"'))+'</div>'
     +'<div class="help" style="margin-top:12px">Your manager, then Finance, approve the advance. Settle it with your claims after the trip and return any unspent amount within 7 days.</div></div>';}
  return {title:f.editRef?'Edit '+f.editRef:'New request',up:'#/expenses',html:html,foot:'<div class="btns"><button class="btn" data-act="rqSubmit">Submit</button><button class="btn sec" data-act="rqDraft">Save draft</button></div>',
    after:function(){
      MAtt.thumbs();
      ['rq-scan','rq-scan-g'].forEach(function(k){const sc=document.getElementById(k);if(sc)sc.addEventListener('change',function(){const fl=sc.files&&sc.files[0];if(!fl)return;rqRead();rqScan(fl);sc.value='';});});
      if(f.type==='claim'&&typeof MOcr!=='undefined')setTimeout(function(){MOcr.load().catch(function(){});},1500);
      const sub=document.getElementById('rq-sub');if(sub)sub.addEventListener('change',function(){rqRead();f.expType='';f.auto&&(f.auto.subCat=f.auto.expType=false);render();});
      const fr=document.getElementById('rq-for');if(fr)fr.addEventListener('change',function(){rqRead();if(f.forWho==='self')f.forEid='';render();});
      const mb=document.getElementById('rq-member');if(mb)mb.addEventListener('change',function(){rqRead();render();});
      document.querySelectorAll('[id^="ln-p-"]').forEach(function(el){el.addEventListener('change',function(){rqRead();render();});});
      document.querySelectorAll('input[data-ln]').forEach(function(inp){inp.addEventListener('change',function(){const fl=inp.files&&inp.files[0];if(!fl)return;rqRead();rqAttach(f,f.lines[+inp.getAttribute('data-ln')],fl,'photo');render();});});
      ['av-file'].forEach(function(k){const af=document.getElementById(k);if(af)af.addEventListener('change',function(){const fl=af.files&&af.files[0];if(!fl)return;rqRead();rqAttach(f,f.adv,fl,'photo');render();});});
      const upd=function(){rqRead();const t=document.getElementById('rq-total');if(t)t.textContent=money(f.lines.reduce(function(s,l){return s+(+l.amount||0);},0));
        const pb=document.getElementById('rq-pol');if(!pb)return;const pol=policyFor(f,owner.eid);
        if(!pol||!pol.now){pb.innerHTML='';return;}
        pb.innerHTML=pol.over>0?'<div class="callout warn"><b>Above the '+E(pol.name.toLowerCase())+'</b> of '+money(pol.limit)+' '+pol.per+(pol.used?' ('+money(pol.used)+' already claimed this month)':'')+' by '+money(pol.over)+'. Add a reason for your approver.'+field('Reason',input('rq-just',f.just,{ph:'Why is this above the limit?'}),{req:true})+'</div>'
          :'<div class="callout ok">Within policy · '+E(pol.name)+' '+money(pol.limit)+' '+pol.per+(pol.used?' · '+money(pol.used+pol.now)+' used this month':'')+'</div>';
        const j=document.getElementById('rq-just');if(j)j.addEventListener('input',function(){f.just=j.value;});};
      document.querySelectorAll('[id^="ln-a-"]').forEach(function(el){el.addEventListener('input',upd);});upd();}};});
M.acts.rqType=function(el){rqRead();M.state.rq.type=el.getAttribute('data-t');render();};
M.acts.lnAdd=function(){rqRead();const f=M.state.rq;const l=blankLine();l.paidBy=f.lines[f.lines.length-1].paidBy;f.lines.push(l);render();};
M.acts.lnDel=function(el){rqRead();M.state.rq.lines.splice(+el.getAttribute('data-i'),1);render();};
M.acts.lnFileDel=function(el){rqRead();const l=M.state.rq.lines[+el.getAttribute('data-i')];l.file='';l.size='';l.att=null;l.busy=false;render();};
M.acts.avFileDel=function(){rqRead();const a=M.state.rq.adv;a.file='';a.size='';a.att=null;a.busy=false;render();};
function rqValidate(f,draft){const errs=[];const mark=function(id,bad){markErr(id,bad);if(bad)errs.push(id);};
  mark('rq-title',!f.title);if(draft)return errs;
  if(f.forWho==='team')mark('rq-member',!f.forEid);
  if(f.type==='claim'){mark('rq-sub',!f.subCat);mark('rq-type',!f.expType);
    f.lines.forEach(function(l,i){mark('ln-t-'+i,!l.title);mark('ln-d-'+i,!l.date||l.date>TODAY());mark('ln-a-'+i,!(+l.amount>0));if(l.paidBy==='Employee'&&!l.file)errs.push('receipt '+(i+1));});
    const owner=f.forWho==='team'&&f.forEid?f.forEid:me().eid,pol=policyFor(f,owner);if(pol&&pol.over>0&&!(f.just||'').trim())mark('rq-just',true);}
  else{const a=f.adv;mark('av-amt',!(+a.amount>0));mark('av-req',!a.requiredBy);mark('av-pur',(a.purpose||'').trim().length<10);if(a.from&&a.to&&a.to<a.from)mark('av-to',true);}
  return errs;}
function rqSave(draft){rqRead();if(rqBusy(M.state.rq)){toast('Wait a moment: the receipt is still being saved');return;}const f=M.state.rq,errs=rqValidate(f,draft);
  if(errs.length){const r=errs.find(function(e){return /^receipt/.test(e);});toast(r&&errs.length===1?'Add a receipt for item '+r.split(' ')[1]:'Fill in the highlighted fields');const el=document.querySelector('.inp.err');if(el)el.scrollIntoView({block:'center',behavior:'smooth'});return;}
  const p=me(),owner=f.forWho==='team'&&f.forEid?P.byEid(f.forEid):p,isAdv=f.type==='advance',coll=isAdv?DB().advances:DB().expenses;
  let rec=f.editRef?coll.find(function(r){return r.ref===f.editRef;}):null;
  const fresh=!rec;if(fresh){const k=MStore.next(isAdv?'ADV':'EXP');rec={id:(isAdv?50000:30000)+k,key:k,ref:(isAdv?'ADV-':'EXP-')+k,kind:isAdv?'advance':'expense',currency:'INR',logs:[],origin:'mobile',cid:MStore.cid(),createdBy:myUid()};}
  Object.assign(rec,{title:f.title,employeeEid:owner.eid,name:owner.name,empId:owner.empId,email:owner.email,appliedOn:TODAY(),notes:f.notes||''});
  if(isAdv){const a=f.adv;Object.assign(rec,{category:a.sub,purpose:a.purpose,requiredBy:a.requiredBy,periodFrom:a.from,periodTo:a.to,costCenter:a.cc,proof:a.file,att:a.att||null,ledger:[],lines:[{id:1,title:'Advance',amount:+a.amount||0,subCat:a.sub,start:a.from,end:a.to,proof:a.file,att:a.att||null,status:'Pending'}]});}
  else Object.assign(rec,{category:f.subCat,appType:'Reimbursement',policyJust:f.just||'',lines:f.lines.map(function(l,i){return {id:i+1,title:l.title,amount:+l.amount||0,subCat:f.expType,start:l.date,end:l.date,proof:l.file,att:l.att||null,paidBy:l.paidBy,merchant:l.merchant,invoice:l.invoice||'',ocr:l.ocr||null,txnId:l.txnId||null,cardId:l.cardId||null,advanceId:l.paidBy==='Company Advance'?(myOpenAdvances(owner.eid)[0]||{}).id:'',status:'Pending'};})});
  const total=reqTotal(rec),onBehalf=owner.eid!==p.eid?' on behalf of '+owner.name:'';
  MStore.act(draft?'request.saveDraft':'request.submit',rec.ref,{kind:rec.kind,total:total},function(){
    if(fresh)coll.unshift(rec);
    if(draft){rec.status='Draft';rec.wf=null;logTo(rec,'Draft','Saved as draft with '+rec.lines.length+' item'+(rec.lines.length>1?'s':'')+onBehalf+'.');}
    else{rec.status='Awaiting Approval';rec.submittedAt=TODAY();rec.wf=buildWf(rec.kind,owner.eid,myUid());delete rec.rejectReason;delete rec.followUp;
      logTo(rec,'Awaiting Approval','Submitted for approval'+onBehalf+': '+(isAdv?'advance of '+money(total):rec.lines.length+' item'+(rec.lines.length>1?'s':'')+' ('+money(total)+')')+'. Route '+rec.wf.wfKey+': Manager review → Finance review.');
      logTo(rec,'Awaiting Approval','Stage 1 of 2 (Manager review) assigned to '+names(rec.wf.stages[0].approvers)+'.');}});
  M.state.rq=null;toast(draft?rec.ref+' saved as draft':rec.ref+' sent to '+names(rec.wf.stages[0].approvers));
  replaceTo('#/r/'+rec.ref);}
M.acts.rqSubmit=function(){rqSave(false);};
M.acts.rqDraft=function(){rqSave(true);};
M.acts.rqCopy=function(el){const r=findRec(el.getAttribute('data-ref'));if(!r)return;const f=rqBlank();
  f.type=r.kind==='advance'?'advance':'claim';f.title=r.title;f.editRef=r.status==='Draft'?r.ref:'';
  if(r.employeeEid!==me().eid){f.forWho='team';f.forEid=r.employeeEid;}
  if(f.type==='claim'){f.subCat=r.category;f.expType=(r.lines[0]||{}).subCat||'';f.just=r.policyJust||'';f.notes=r.notes||'';f.lines=r.lines.map(function(l){return {title:l.title||'',date:l.start||TODAY(),merchant:l.merchant||'',invoice:l.invoice||'',amount:String(l.amount||''),paidBy:l.paidBy||'Employee',file:l.proof||'',size:'',att:lineAtt(r,l)||null,busy:false,txnId:l.txnId,cardId:l.cardId,ocr:l.ocr||null,auto:{}};});}
  else f.adv={sub:r.category,amount:String(reqTotal(r)),requiredBy:r.requiredBy,from:r.periodFrom,to:r.periodTo,cc:r.costCenter||'',purpose:r.purpose||'',file:r.proof||'',size:'',att:advAtt(r)||null,busy:false};
  M.state.rq=f;go('#/expenses/new');};

/* ── Request detail (claims, advances, card loads) ── */
function stageLine(r,s){const dec=(s.decisions||[]).slice(-1)[0];const cls=s.status==='Approved'?'ok':s.status==='Rejected'?'bad':s.status==='Awaiting Decision'||/^Follow-Up/.test(s.status)?'warn':'';
  const who=names(s.approvers);let sub;
  if(dec)sub=decWord(dec)+' by '+P.nameOfUser(dec.who)+' · '+dec.date+(dec.time?' '+dec.time.replace(/:\d\d (AM|PM)$/,' $1'):'')+((dec.reason||dec.comment)?' · “'+(dec.reason||dec.comment)+'”':'');
  else if(s.status==='Awaiting Decision')sub='Waiting for '+who;else if(/^Follow-Up/.test(s.status))sub='Sent back — waiting for the requester';else sub='Not started'+(s.approvers&&s.approvers.length?' · '+who:'');
  return '<div class="tl-i '+cls+'"><div class="tl-t">Stage '+s.n+' · '+E(s.name)+'</div><div class="tl-s">'+E(sub)+'</div></div>';}
route('/r/:ref',function(pr){const r=findRec(pr.ref);if(!r)return null;const p=me(),u=myUid(),owner=ownerOf(r)||{},mine=r.kind!=='card load'&&r.employeeEid===p.eid,st=showStatus(r),total=r.kind==='card load'?r.amount:reqTotal(r);
  const appr=canDecide(r,u);
  let html='<div class="card"><div class="card-h"><span class="cap">'+E(r.ref)+' · '+kindLabel(r)+'</span>'+badge(st,tone(st))+'</div><div class="b" style="font-size:20px;line-height:26px">'+E(r.title||r.reason)+'</div><div class="b num" style="font-size:28px;line-height:34px;margin-top:6px">'+money(total)+'</div>'
   +'<div class="meta" style="margin-top:4px">'+(mine?'':E(owner.name||'')+' · ')+(r.kind==='card load'?E(walletName(r.wallet))+' wallet · card •••• '+E((cardById(r.cardId)||{}).last4||''):E(r.category||'')+(r.appliedOn?' · '+E(MFmt.date(r.appliedOn)):''))+'</div></div>';
  if(r.status==='Rejected')html+='<div class="callout bad"><b>Rejected:</b> '+E(r.rejectReason||((r.logs||[]).find(function(l){return l.status==='Rejected';})||{}).action||'')+'</div>';
  if(r.status==='Follow-Up'){const fu=r.followUp||{};const lg=(r.logs||[]).find(function(l){return l.status==='Follow-Up';})||{};html+='<div class="callout warn"><b>Sent back'+(fu.by?' by '+E(P.nameOfUser(fu.by)):'')+':</b> '+E(fu.comment||lg.action||'')+'</div>';}
  if(r.status==='Draft')html+='<div class="callout info">Not submitted yet. Check the items and submit when ready.</div>';
  if(r.policyJust)html+='<div class="callout warn"><b>Above the policy limit.</b> Reason: '+E(r.policyJust)+'</div>';
  if(r.kind==='expense'){html+='<div class="h2">Items · '+r.lines.length+'</div><div class="card p0">'+r.lines.map(function(l,i){const tx=l.txnId?DB().txns.find(function(t){return t.id===l.txnId;}):null;
      return '<div class="row" style="align-items:flex-start"'+(tx?' data-go="#/t/'+tx.ref+'"':'')+'><span class="ico">'+ic(l.paidBy==='Corporate Card'?'card':l.paidBy==='Company Advance'?'adv':'receipt')+'</span><div class="row-m"><div class="row-t" style="white-space:normal">'+E(l.title||l.merchant||('Item '+(i+1)))+'</div><div class="row-s" style="white-space:normal">'+E(l.subCat||'')+(l.start?' · '+E(MFmt.dshort(l.start)):'')+(l.merchant&&l.merchant!==(l.title||l.merchant)?' · '+E(l.merchant):'')+'</div><div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap"><span class="tag">'+E(PAID[l.paidBy]||l.paidBy||'')+(tx?' · '+E(tx.ref):'')+'</span>'+(l.invoice?'<span class="tag">Inv '+E(l.invoice)+'</span>':'')+(l.ocr?'<span class="tag">Scanned</span>':'')+(l.proof&&!lineAtt(r,l)?'<span class="tag">'+ic('file',11).replace('<svg','<svg style="display:inline;vertical-align:-1px"')+' '+E(l.proof)+'</span>':'')+'</div>'
        +(lineAtt(r,l)?attTile(lineAtt(r,l),'data-act="attView" data-ref="'+E(r.ref)+'" data-i="'+i+'"','Receipt'):'')+'</div><div class="row-r"><span class="b num">'+money(l.amount)+'</span></div></div>';}).join('')+'</div>';}
  if(r.kind==='advance'){html+='<div class="h2">Details</div><div class="card">'+kv('Sub Category',E(r.category))+kv('Needed by',E(MFmt.date(r.requiredBy)))+(r.periodFrom?kv('Trip',E(MFmt.dshort(r.periodFrom))+' – '+E(MFmt.date(r.periodTo))):'')+(r.costCenter?kv('Cost centre',E(r.costCenter)):'')+(r.project?kv('Project',E(r.project)):'')+(advAtt(r)?'<div class="kv-col"><span class="k">Attachment</span>'+attTile(advAtt(r),'data-act="attView" data-ref="'+E(r.ref)+'" data-i="doc"','Itinerary or quote')+'</div>':r.proof?kv('Attachment',E(r.proof)):'')+'<div class="kv-col"><span class="k">Purpose</span>'+E(r.purpose||'')+'</div></div>';
    if(r.status==='Approved'){const iss=advIssued(r),used=advUsed(r),ret=advReturned(r),bal=iss-used-ret;
      html+='<div class="h2">Money</div><div class="card">'+(iss?kv('Paid to you',money(iss)+' <span class="cap">'+E(((r.ledger||[]).find(function(x){return x.type==='Issuance';})||{}).ref||'')+'</span>')+kv('Settled with claims',money(used))+(ret?kv('Returned',money(ret)):'')+kv('Balance',(bal>0?'<span class="warn-t b">'+money(bal)+'</span>':money(0))):kv('Payment','<span class="warn-t">Ready for Finance to pay</span>'))
        +(iss&&bal>0&&used>0?'<div class="help">Return the unspent '+money(bal)+' by '+E(MFmt.date(advReturnBy(r)))+'.</div>':'')+(iss&&bal>0&&!used?'<div class="help">Settle it with your claims after the trip.</div>':'')+'</div>';}}
  if(r.kind==='card load'){const c=cardById(r.cardId)||{};html+='<div class="h2">Details</div><div class="card">'+kv('Cardholder',E(owner.name||''))+kv('Card','•••• '+E(c.last4||'')+' · '+E(c.ref||''))+kv('Wallet',E(walletName(r.wallet)))+kv('Purpose',E(r.reason||''))+'</div>';}
  if(r.wf){html+='<div class="h2">Approval</div><div class="card"><div class="tl"><div class="tl-i ok"><div class="tl-t">Submitted</div><div class="tl-s">'+E(r.kind==='card load'?'Finance':(P.nameOfUser(r.createdBy)||owner.name||''))+(r.appliedOn?' · '+E(MFmt.date(r.appliedOn)):'')+'</div></div>'+r.wf.stages.map(function(s){return stageLine(r,s);}).join('')+'</div></div>';}
  if(r.kind==='expense'&&r.status==='Approved'&&r.pay){const py=r.pay;html+='<div class="h2">Reimbursement</div><div class="card">'+kv('Status',badge(py.status,tone(py.status)))+(py.status==='Not Applicable'?'<div class="help">Nothing to pay back: these items were paid with the company card or an advance.</div>':kv('Payable',money(py.payable))+(py.settled?kv('Paid',money(py.settled)+((py.events||[]).find(function(e){return e.ref;})?' <span class="cap">'+E((py.events||[]).find(function(e){return e.ref;}).ref)+'</span>':'')):'<div class="help">Finance pays this with the next reimbursement run, to your salary account.</div>'))+'</div>';}
  const logs=r.logs||[],showAll=M.state.logAll===r.ref,lg=showAll?logs:logs.slice(0,4);
  if(logs.length)html+='<div class="h2">Activity</div><div class="card"><div class="tl">'+lg.map(function(l){return '<div class="tl-i"><div class="tl-t" style="font-weight:400;font-size:14px">'+E(l.action)+'</div><div class="tl-s">'+E(l.user)+' · '+E(l.date)+(l.time?' '+E(l.time.replace(/:\d\d (AM|PM)$/,' $1')):'')+'</div></div>';}).join('')+'</div>'+(logs.length>4?'<button class="link" style="margin-top:10px" data-act="logAll" data-ref="'+r.ref+'">'+(showAll?'Show less':'Show all '+logs.length)+'</button>':'')+'</div>';
  let foot=null;
  if(appr)foot='<div class="btns"><button class="btn danger" data-act="dec" data-d="Reject" data-ref="'+r.ref+'">Reject</button><button class="btn sec" data-act="dec" data-d="Follow-Up" data-ref="'+r.ref+'">Send back</button><button class="btn" data-act="dec" data-d="Approve" data-ref="'+r.ref+'">Approve</button></div>';
  else if(mine&&r.status==='Draft')foot='<div class="btns"><button class="btn" data-act="rqCopy" data-ref="'+r.ref+'">Continue</button><button class="btn danger" data-act="rqDelete" data-ref="'+r.ref+'">Delete</button></div>';
  else if(mine&&r.status==='Awaiting Approval')foot='<button class="btn danger" data-act="rqWithdraw" data-ref="'+r.ref+'">Withdraw request</button>';
  else if(mine&&r.status==='Follow-Up')foot='<div class="btns"><button class="btn" data-act="rqRespond" data-ref="'+r.ref+'">Respond and resubmit</button><button class="btn sec" data-act="rqCopy" data-ref="'+r.ref+'">Edit</button></div>';
  else if(mine&&r.status==='Rejected')foot='<button class="btn" data-act="rqCopy" data-ref="'+r.ref+'">Edit and resubmit</button>';
  else if(mine&&r.kind==='advance'&&r.status==='Approved'&&advIssued(r)&&advBalance(r)>0&&advUsed(r)>0)foot='<button class="btn" data-act="advReturn" data-ref="'+r.ref+'">Return '+money(advBalance(r))+'</button>';
  return {title:r.ref,up:appr?'#/approvals':'#/expenses',tab:'more',html:html,foot:foot,after:function(){MAtt.thumbs();}};});
M.acts.logAll=function(el){const r=el.getAttribute('data-ref');M.state.logAll=M.state.logAll===r?null:r;render();};
M.acts.dec=function(el){const r=findRec(el.getAttribute('data-ref')),d=el.getAttribute('data-d');if(!r||!canDecide(r,myUid())){toast('This request is no longer waiting for you');render();return;}
  const T={Approve:['Approve '+r.ref+'?','Comment (optional)','Approve'],Reject:['Reject '+r.ref+'?','Reason for rejecting','Reject'],'Follow-Up':['Send '+r.ref+' back?','What do you need from them?','Send back']}[d];
  const need=d!=='Approve',st=activeStage(r),nx=r.wf.stages[r.wf.current+1];
  sheet(T[0],'<div class="meta" style="margin-bottom:10px">'+E(r.title||r.reason)+' · '+money(r.kind==='card load'?r.amount:reqTotal(r))+(d==='Approve'?(nx?' · goes to '+E(nx.name)+' next':' · this is the final approval'):'')+'</div>'
    +field(T[1],textarea('dec-c','',need?'Required':'Add a note for the requester'),{req:need,help:need?'At least 5 characters.':''})+'<button class="btn'+(d==='Reject'?' danger':'')+'" style="margin-top:14px" id="dec-ok">'+T[2]+'</button>',
    {after:function(w){w.querySelector('#dec-ok').onclick=function(){const c=w.querySelector('#dec-c').value.trim();if(need&&c.length<5){markErr('dec-c',true);return;}
      decide(r,d,c);closeSheet();toast({Approve:r.ref+' approved',Reject:r.ref+' rejected','Follow-Up':r.ref+' sent back'}[d]+(d==='Approve'&&r.wf.open?' · now with '+names(activeStage(r).approvers):''));back('#/approvals');};}});};
M.acts.rqWithdraw=function(el){const r=findRec(el.getAttribute('data-ref'));confirmBox('Withdraw '+r.ref+'?','Your approvers will no longer see it. You can copy it into a new request later.','Withdraw',function(){MStore.act('request.withdraw',r.ref,{},function(){r.status='Withdrawn';if(r.wf){r.wf.open=false;const s=r.wf.stages[r.wf.current];if(s)s.status='Withdrawn';}logTo(r,'Withdrawn','Withdrawn by '+me().name+'.');});render();toast(r.ref+' withdrawn');},true);};
M.acts.rqDelete=function(el){const r=findRec(el.getAttribute('data-ref'));confirmBox('Delete draft '+r.ref+'?','The draft and its items are removed.','Delete',function(){MStore.act('request.deleteDraft',r.ref,{},function(){const c=r.kind==='advance'?DB().advances:DB().expenses;c.splice(c.indexOf(r),1);});toast('Draft deleted');back('#/expenses');},true);};
M.acts.rqRespond=function(el){const r=findRec(el.getAttribute('data-ref'));sheet('Respond and resubmit',field('Your reply',textarea('rs-c','','Answer the question or explain what you changed'),{req:true})+'<button class="btn" style="margin-top:14px" id="rs-ok">Resubmit</button>',{after:function(w){w.querySelector('#rs-ok').onclick=function(){const c=w.querySelector('#rs-c').value.trim();if(c.length<5){markErr('rs-c',true);return;}
  MStore.act('request.respond',r.ref,{comment:c},function(){const s=activeStage(r);s.status='Awaiting Decision';r.status='Awaiting Approval';logTo(r,'Awaiting Approval','Reply from '+me().name+': '+c+'. Back with '+names(s.approvers)+'.');delete r.followUp;});closeSheet();render();toast(r.ref+' resubmitted');};}});};
M.acts.advReturn=function(el){const r=findRec(el.getAttribute('data-ref')),bal=advBalance(r);sheet('Return '+money(bal),field('How did you pay it back?',select('ar-m',['UPI to company account','Bank transfer','Cash to Finance'],'UPI to company account'))+field('Reference',input('ar-ref','',{ph:'UPI or bank reference'}),{req:true})+'<button class="btn" style="margin-top:14px" id="ar-ok">Record return</button>',
  {after:function(w){w.querySelector('#ar-ok').onclick=function(){const ref=w.querySelector('#ar-ref').value.trim();if(ref.length<4){markErr('ar-ref',true);return;}
    MStore.act('advance.return',r.ref,{amount:bal,ref:ref},function(){r.ledger.push({type:'Return',amount:bal,date:TODAY(),ref:ref,source:r.ref});logTo(r,'Approved','Return of '+money(bal)+' recorded by '+me().name+' ('+w.querySelector('#ar-m').value+', ref '+ref+'). Finance confirms it against the bank statement.');});closeSheet();render();toast('Return of '+money(bal)+' recorded');};}});};

/* ── Approvals ── */
route('/approvals',function(){const u=myUid(),tab=M.state.apTab||'todo',todo=approvalsFor(u),done=decidedBy(u);
  const row=function(r){const o=ownerOf(r)||{},st=activeStage(r),mineDec=r.wf.stages.reduce(function(a,s){return a.concat((s.decisions||[]).filter(function(d){return d.who===u;}));},[]).slice(-1)[0];
    const dw=decWord(mineDec||{}),right=tab==='todo'?badge('Stage '+(st?st.n:''),'warn'):badge(dw,tone(dw));
    return '<div class="row tap" data-go="#/r/'+r.ref+'"><span class="av" style="width:36px;height:36px;font-size:12px">'+E(MFmt.initials(o.name||''))+'</span><div class="row-m"><div class="row-t">'+E(r.title||r.reason)+'</div><div class="row-s">'+E(o.name||'')+' · '+kindLabel(r)+' · '+E(r.ref)+'</div></div><div class="row-r"><span class="b num">'+money(r.kind==='card load'?r.amount:reqTotal(r))+'</span>'+right+'</div></div>';};
  const list=tab==='todo'?todo:done;
  const html='<div class="tabs"><button class="'+(tab==='todo'?'on':'')+'" data-act="apTab" data-t="todo">To approve'+(todo.length?' ('+todo.length+')':'')+'</button><button class="'+(tab==='done'?'on':'')+'" data-act="apTab" data-t="done">Done</button></div>'
   +(list.length?'<div class="card p0" style="margin-top:12px">'+list.map(row).join('')+'</div>':'<div style="margin-top:12px">'+emptyHTML('approve',tab==='todo'?'You’re all caught up':'Nothing decided yet',tab==='todo'?'Claims, advances and card loads waiting for you appear here.':'Requests you approve, reject or send back appear here.')+'</div>');
  return {title:'Approvals',up:'#/more',tab:'more',html:html};});
M.acts.apTab=function(el){M.state.apTab=el.getAttribute('data-t');render();};

/* ── My cards & wallets ── */
function cardAvail(c){return (c.wallets||[]).reduce(function(s,w){return s+(w.balance||0);},0);}
function cardTxns(c){return DB().txns.filter(function(t){return t.cardId===c.id;}).sort(function(a,b){return (b.id||0)-(a.id||0);});}
/* The card drawn as the web app draws it (My Cards): number and expiry blurred until the card is tapped.
   The number is worked out the same way as the web card, from the card's own reference, and never saved. */
const CARD_BANK={rbl:'RBL Bank',icici:'ICICI Bank'};
function cardProg(c){return c.programme||(String(MStore.db.entity.name||'').split(' ')[0]+' Multi Wallet Card').trim();}
function cardSecret(c){const l4=String(c.last4||'----');let h=2166136261;
  (String(c.ref||'').split('-').pop()+'|'+c.id+'|'+c.employeeEid).split('').forEach(function(ch){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;});
  const d=('00000000'+(h%100000000)).slice(-8),iso=/^\d{4}-\d{2}/.test(c.issueDate||'')?c.issueDate:TODAY();
  return {num:'6080 '+d.slice(0,4)+' '+d.slice(4)+' '+l4,exp:iso.slice(5,7)+'/'+String((Number(iso.slice(2,4))+5)%100).padStart(2,'0')};}
const CARD_WAVES='<svg class="vc-waves" viewBox="0 0 340 214" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke-width="1.2">'
  +'<path d="M-10 150 C 70 110, 150 210, 350 120" stroke="rgba(255,96,130,.45)"/><path d="M-10 165 C 80 125, 160 220, 350 135" stroke="rgba(255,96,130,.30)"/>'
  +'<path d="M-10 180 C 90 140, 170 228, 350 150" stroke="rgba(255,255,255,.14)"/><path d="M120 -10 C 170 60, 260 40, 350 90" stroke="rgba(255,255,255,.08)"/></g></svg>';
const CARD_NFC='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M8.5 8.5a5 5 0 0 1 0 7"/><path d="M12 6a8.5 8.5 0 0 1 0 12"/><path d="M15.5 3.5a12 12 0 0 1 0 17"/></svg>';
function cardVisual(c){const p=P.byEid(c.employeeEid)||{},x=cardSecret(c),bank=CARD_BANK[c.provider]||'';
  const ended=c.status==='Blocked'||c.status==='Closed'||c.status==='Expired',flag=ended?c.status:c.hold?'On hold':c.status!=='Active'?c.status:'';
  return '<div class="vc'+(ended?' is-ended':flag?' is-dim':'')+'" role="button" tabindex="0" data-act="cardShow" aria-label="Card ending '+E(c.last4)+'. Tap to see the number">'+CARD_WAVES
   +'<div class="vc-top"><span class="vc-brand"><span class="vc-mark">O</span>OpenDhi</span>'+(bank?'<span class="vc-bank">'+E(bank.toUpperCase())+'</span>':'')+'</div>'
   +'<div class="vc-prog">'+E(cardProg(c))+'</div>'
   +'<div class="vc-mid"><span class="vc-chip"></span>'+CARD_NFC+(flag?'<span class="vc-flag">'+E(flag)+'</span>':'')+'</div>'
   +'<div class="vc-num vc-secret">'+E(x.num)+'</div>'
   +'<div class="vc-row"><div class="vc-who"><div class="vc-lbl">CARDHOLDER</div><div class="vc-name">'+E(String(p.name||'').toUpperCase())+'</div></div>'
   +'<div><div class="vc-lbl">VALID THRU</div><div class="vc-exp vc-secret">'+E(x.exp)+'</div></div>'
   +'<div class="vc-net"><span class="vc-rupay">RuPay<i></i></span><span class="vc-prepaid">PREPAID</span></div></div></div>';}
M.acts.cardShow=function(el){const on=el.classList.toggle('is-shown'),h=document.querySelector('.vc-hint');if(h)h.textContent=on?'Tap to hide number':'Tap to show number';};
function txnRow(t){const credit=t.direction==='Credit'||t.type==='Refund'||t.type==='Reversal';const dsp=(t.disputes||[]).length?DB().disputes.find(function(d){return d.ref===t.disputes[t.disputes.length-1];}):null;
  return '<div class="row tap" data-go="#/t/'+t.ref+'"><span class="ico">'+ic(WICON[t.wallet]||'wallet')+'</span><div class="row-m"><div class="row-t">'+E(t.merchant)+'</div><div class="row-s">'+E(walletName(t.wallet))+' · '+E(MFmt.dshort(t.date))+(t.type!=='Purchase'?' · '+E(t.type):'')+'</div></div><div class="row-r"><span class="b num'+(credit?' ok-t':'')+'">'+(credit?'+':'')+money(t.amount)+'</span>'+(dsp?badge('Dispute '+dsp.status.toLowerCase(),tone(dsp.status)):(t.status!=='Posted'?badge(t.status,'warn'):''))+'</div></div>';}
route('/cards',function(){const cards=myCards(),p=me();
  if(!cards.length)return {title:'My cards',up:'#/more',tab:'more',html:emptyHTML('card','No card yet',p.status==='Onboarding'?'Your company card is issued once your onboarding is complete.':'Your company has not issued you a card yet.','<button class="btn sec" data-go="#/benefits">View my benefits</button>')};
  const c=cards[0],tx=cardTxns(c),av=cardAvail(c);
  const actions=[[c.hold?'Release hold':'Hold card','lock','cardHold'],['Lost or stolen','dispute','cardLost'],['Replace','refresh','cardReplace'],['Details','info','cardDetails']];
  const cst=c.status==='Blocked'?'Blocked':c.hold?'On hold':c.status;
  let html=cardVisual(c)
   +'<div class="vc-foot"><div class="row-m"><div class="row-t">'+E(cardProg(c))+'</div><div class="row-s">'+E(c.ref)+' · '+E(c.type||'Virtual')+' · <span class="vc-hint">Tap to show number</span></div></div>'+badge(cst,cst==='Active'?'ok':tone(cst))+'</div>'
   +'<div class="shorts" style="grid-template-columns:repeat(4,1fr);margin-top:12px">'+actions.map(function(a){return '<button class="short" style="font-size:12px;padding:12px 4px 10px" data-act="'+a[2]+'"'+(c.status==='Blocked'&&a[2]!=='cardDetails'?' disabled style="opacity:.4"':'')+'><span class="ico">'+ic(a[1],18)+'</span>'+a[0]+'</button>';}).join('')+'</div>';
  if(c.hold)html+='<div class="callout warn">Your card is on hold. Payments are declined until you release it.</div>';
  if(c.status==='Blocked')html+='<div class="callout bad">This card is blocked'+(c.replacement?'. A replacement is on its way.':'.')+'</div>';
  html+='<div class="h2">Wallet balances</div><div class="card p0"><div class="row"><div class="row-m"><div class="lbl">Total available</div><div class="b num" style="font-size:24px;line-height:30px">'+money(av)+'</div></div></div>'
   +c.wallets.map(function(w){const pct=w.loads?Math.round(w.balance/(w.loads+(w.credits||0))*100):0;return '<div class="row tap" data-act="txWallet" data-w="'+w.code+'"><span class="ico">'+ic(WICON[w.code]||'wallet')+'</span><div class="row-m"><div class="row-t">'+E(w.name)+'</div><div class="row-s">Loaded '+money(w.loads)+' · spent '+money(w.spent)+(w.credits?' · refunds '+money(w.credits):'')+'</div><div class="bar5" style="margin:6px 0 0"><i style="width:'+pct+'%"></i></div></div><div class="row-r"><span class="b num">'+money(w.balance)+'</span></div></div>';}).join('')+'</div>'
   +'<div class="card p0" style="margin-top:12px">'+rowHTML({icon:'gift',t:'My benefits',s:'Meal, Fuel, Telecom and Gift this month',go:'#/benefits'})+'</div>'+'<div class="h2" style="display:flex;justify-content:space-between;align-items:center">Recent payments <button class="link" data-act="txWallet" data-w="All">View all</button></div>'
   +(tx.length?'<div class="card p0">'+tx.slice(0,5).map(txnRow).join('')+'</div>':'<div class="card"><div class="meta">No payments yet.</div></div>')
   +'<div class="cap" style="text-align:center;margin-top:14px">Card payments are recorded automatically. Raise a dispute if you did not make a payment.</div>';
  return {title:'My cards',up:'#/more',tab:'more',html:html};});
M.acts.txWallet=function(el){M.state.txW=el.getAttribute('data-w');go('#/cards/payments');};
M.acts.cardHold=function(){const c=myCards()[0];if(c.hold){MStore.act('card.releaseHold',c.ref,{},function(){c.hold=null;});render();toast('Hold released. Your card works again.');return;}
  confirmBox('Put your card on hold?','Payments are declined until you release the hold. You can release it any time.','Hold card',function(){MStore.act('card.hold',c.ref,{},function(){c.hold={at:new Date().toISOString(),by:myUid()};});render();toast('Card on hold');});};
M.acts.cardLost=function(){const c=myCards()[0];confirmBox('Report card •••• '+c.last4+' lost or stolen?','The card is blocked at once and cannot be used again. A replacement card is requested for you.','Block card',function(){MStore.act('card.reportLost',c.ref,{},function(){c.status='Blocked';c.hold=null;c.replacement='Requested';});render();toast('Card blocked · replacement requested');},true);};
M.acts.cardReplace=function(){const c=myCards()[0];sheet('Request a replacement',field('Reason',select('rp-r',['Card damaged','Name change','Other'],'Card damaged'),{req:true})+field('Deliver to',select('rp-d',['Office (work location)','Home address'],'Office (work location)'))+'<div class="help" style="margin-top:10px">Your current card keeps working until the new one is active.</div><button class="btn" style="margin-top:14px" id="rp-ok">Request replacement</button>',
  {after:function(w){w.querySelector('#rp-ok').onclick=function(){MStore.act('card.replace',c.ref,{reason:w.querySelector('#rp-r').value,delivery:w.querySelector('#rp-d').value},function(){c.replacement='Requested';});closeSheet();render();toast('Replacement requested');};}});};
M.acts.cardDetails=function(){const c=myCards()[0],p=me();sheet('Card details',kv('Card',E(c.ref))+kv('Number','•••• '+E(c.last4))+kv('Type',E(c.type||'Virtual'))+kv('Name on card',E(String(p.name).toUpperCase()))+kv('Issued',E(MFmt.date(c.issueDate)))+kv('Status',badge(c.status==='Blocked'?'Blocked':c.hold?'On hold':c.status,c.status==='Active'&&!c.hold?'ok':'warn'))+(c.replacement?kv('Replacement',badge(c.replacement,'warn')):'')+kv('Wallets',E(c.wallets.map(function(w){return w.name;}).join(', '))));};
route('/cards/payments',function(){const c=myCards()[0];if(!c)return null;const w=M.state.txW||'All';const tx=cardTxns(c).filter(function(t){return w==='All'||t.wallet===w;});
  const html='<div class="chips">'+[['All','All']].concat(c.wallets.map(function(x){return [x.code,x.name.replace(' Expense','')];})).map(function(x){return '<button class="pill'+(w===x[0]?' on':'')+'" data-act="txW" data-w="'+x[0]+'">'+E(x[1])+'</button>';}).join('')+'</div>'
   +(w!=='All'?(function(){const x=c.wallets.find(function(q){return q.code===w;});return x?'<div class="card" style="margin-top:12px">'+kv('Available',money(x.balance))+kv('Loaded',money(x.loads))+kv('Spent',money(x.spent))+(x.credits?kv('Refunds',money(x.credits)):'')+'</div>':'';})():'')
   +'<div class="card p0" style="margin-top:12px">'+(tx.length?tx.map(txnRow).join(''):'<div class="row"><div class="meta">No payments from this wallet yet.</div></div>')+'</div>';
  return {title:'Payments',up:'#/cards',tab:'more',html:html};});
M.acts.txW=function(el){M.state.txW=el.getAttribute('data-w');render();};

/* ── Payment detail, dispute ── */
function claimOfTxn(t){return DB().expenses.find(function(r){return r.status!=='Withdrawn'&&(r.lines||[]).some(function(l){return l.txnId===t.id;});})||null;}
function disputeOf(t){const k=(t.disputes||[]).slice(-1)[0];return k?DB().disputes.find(function(d){return d.ref===k;}):null;}
function origOfRefund(t){return DB().txns.find(function(x){return x.type==='Purchase'&&x.cardId===t.cardId&&x.merchant===t.merchant&&x.id<t.id;})||null;}
route('/t/:ref',function(pr){const t=DB().txns.find(function(x){return x.ref===pr.ref;});if(!t)return null;const c=cardById(t.cardId)||{},credit=t.type!=='Purchase',cl=claimOfTxn(t),d=disputeOf(t),corp=t.wallet==='CORP';
  const notes=(MStore.db.notes||[]).filter(function(n){return n.ref===t.ref;});
  let html='<div class="card" style="text-align:center;padding:20px 16px"><span class="ico round" style="margin:0 auto 10px;width:48px;height:48px">'+ic(WICON[t.wallet]||'wallet',22)+'</span><div class="b" style="font-size:17px">'+E(t.merchant)+'</div><div class="b num'+(credit?' ok-t':'')+'" style="font-size:28px;line-height:34px;margin:6px 0">'+(credit?'+':'')+money(t.amount)+'</div>'+badge(t.status,t.status==='Posted'?'ok':'warn')+'</div>'
   +'<div class="card" style="margin-top:12px">'+kv('Date',E(MFmt.date(t.date)))+kv('Type',E(t.type))+kv('Wallet',E(walletName(t.wallet)))+kv('Card','•••• '+E(c.last4||''))+kv('Category',E(MCC[t.mcc]||'—'))+kv('Channel',E(t.channel==='POS'?'In store':t.channel||'—'))+kv('Reference',E(t.ref))+(t.reason?kv('Note',E(t.reason)):'')+'</div>';
  html+='<div class="h2">Expense</div><div class="card">'+(cl?rowHTML({icon:'receipt',t:E(cl.title),s:E(cl.ref)+' · '+E(showStatus(cl)),go:'#/r/'+cl.ref,r:badge(showStatus(cl),tone(showStatus(cl)))}):credit?'<div class="meta">A refund is credited back to the same wallet.</div>':corp?'<div class="meta">No claim needed: card payments are recorded automatically.</div><button class="btn sec" style="margin-top:12px" data-act="txExpense" data-ref="'+t.ref+'">Add to an expense claim</button>':'<div class="meta">Benefit spend · no claim needed.</div>')+'</div>';
  html+='<div class="h2">Dispute</div><div class="card">';
  if(d)html+='<div class="tl"><div class="tl-i ok"><div class="tl-t">Raised · '+E(d.reason)+'</div><div class="tl-s">'+money(d.amount)+' · '+E(MFmt.date(d.iso||TODAY()))+(d.description?' · “'+E(d.description)+'”':'')+'</div></div>'
    +'<div class="tl-i '+(d.status==='Closed'?'ok':'warn')+'"><div class="tl-t">'+E(d.status==='Closed'?'Closed':'With Finance')+'</div><div class="tl-s">'+E(d.status==='Closed'?(d.outcome&&d.outcome.result?d.outcome.result+(d.outcome.result==='Resolved Against'?' — the bank found the charge correct':''):'Closed'):'Finance reviews it with the card provider and updates you here.')+'</div></div></div><div class="cap" style="margin-top:8px">'+E(d.ref)+'</div>';
  else if(credit){const o=origOfRefund(t);html+='<div class="meta">Refunds cannot be disputed.'+(o?' Dispute the original payment instead.':'')+'</div>'+(o?'<button class="btn sec" style="margin-top:12px" data-go="#/t/'+o.ref+'">Open '+E(o.ref)+'</button>':'');}
  else html+='<div class="meta">Did not make this payment, or the amount is wrong?</div><button class="btn sec" style="margin-top:12px" data-go="#/t/'+t.ref+'/dispute">Raise a dispute</button>';
  html+='</div><div class="h2">Receipts and notes</div><div class="card">'+(notes.length?notes.map(function(n){return '<div class="file">'+'<span class="ico">'+ic(n.file?'file':'note')+'</span><div class="row-m"><div class="row-t" style="font-size:14px;white-space:normal">'+E(n.file||n.text)+'</div><div class="cap">'+E(n.by)+' · '+E(n.date)+'</div></div></div>';}).join(''):'<div class="meta">Nothing added yet.</div>')
   +'<div class="btns" style="margin-top:12px"><label class="btn sec" style="position:relative">'+ic('camera',18)+' Receipt<input type="file" id="tx-file" accept="image/*,application/pdf" style="position:absolute;inset:0;opacity:0"></label><button class="btn sec" data-act="txNote" data-ref="'+t.ref+'">'+ic('note',18)+' Note</button></div></div>';
  return {title:'Payment',up:'#/cards',tab:'more',html:html,after:function(){const f=document.getElementById('tx-file');f.addEventListener('change',function(){if(!f.files[0])return;const n={ref:t.ref,file:f.files[0].name,by:me().name,date:MStore.now().date};MStore.act('txn.receipt',t.ref,n,function(){MStore.db.notes.push(n);});render();toast('Receipt added');});}};});
M.acts.txNote=function(el){const ref=el.getAttribute('data-ref');sheet('Add a note',field('Note',textarea('tn-t','','e.g. Team lunch with the store staff'),{req:true})+'<button class="btn" style="margin-top:14px" id="tn-ok">Save note</button>',{after:function(w){w.querySelector('#tn-ok').onclick=function(){const v=w.querySelector('#tn-t').value.trim();if(v.length<3){markErr('tn-t',true);return;}const n={ref:ref,text:v,by:me().name,date:MStore.now().date};MStore.act('txn.note',ref,n,function(){MStore.db.notes.push(n);});closeSheet();render();toast('Note saved');};}});};
M.acts.txExpense=function(el){const t=DB().txns.find(function(x){return x.ref===el.getAttribute('data-ref');});const f=rqBlank();
  const g={'7011':['Accommodation','Hotel Stay'],'4121':['Travel Reimbursement','Local Conveyance'],'7523':['Travel Reimbursement','Local Conveyance'],'5812':['Meal Allowance','Client Meal'],'5814':['Meal Allowance','Working Meal'],'5943':['Office Supplies','Stationery'],'7338':['Office Supplies','Stationery']}[t.mcc]||['',''];
  f.title=t.merchant;f.subCat=g[0];f.expType=g[1];f.lines=[{title:t.reason||t.merchant,date:t.date,merchant:t.merchant,amount:String(t.amount),paidBy:'Corporate Card',file:'',size:'',txnId:t.id,cardId:t.cardId}];M.state.rq=f;go('#/expenses/new');};
route('/t/:ref/dispute',function(pr){const t=DB().txns.find(function(x){return x.ref===pr.ref;});if(!t||disputeOf(t))return null;
  const html='<div class="card" style="display:flex;gap:12px;align-items:center"><span class="ico">'+ic(WICON[t.wallet]||'wallet')+'</span><div class="row-m"><div class="b">'+E(t.merchant)+'</div><div class="cap">'+E(t.ref)+' · '+E(MFmt.date(t.date))+' · '+E(walletName(t.wallet))+'</div></div><span class="b num">'+money(t.amount)+'</span></div>'
   +'<div class="card" style="margin-top:12px">'+field('Reason',select('ds-r',['Unrecognized transaction','Incorrect amount','Duplicate charge','Goods or services not received','Refund not received'],'Unrecognized transaction'),{req:true})
   +field('Disputed amount (INR ₹)',input('ds-a',String(t.amount),{type:'number',mode:'decimal'}),{req:true,help:'Up to '+money(t.amount)+'.'})
   +field('What happened?',textarea('ds-d','','At least 10 characters'),{req:true})
   +'<div class="fg"><span class="lbl">Evidence (optional)</span><label class="drop dash" style="margin-top:6px;position:relative">'+ic('upload',22)+'<span class="b" style="font-size:14px" id="ds-fn">Add a file</span><span class="cap">Bill, screenshot or bank SMS · up to 10 MB</span><input type="file" id="ds-f" accept="image/*,application/pdf" style="position:absolute;inset:0;opacity:0"></label></div></div>';
  return {title:'Raise a dispute',up:'#/t/'+t.ref,html:html,foot:'<div class="btns"><button class="btn" data-act="dsSave" data-ref="'+t.ref+'">Submit dispute</button><button class="btn sec" data-back="#/t/'+t.ref+'">Cancel</button></div>',
    after:function(){const f=document.getElementById('ds-f');f.addEventListener('change',function(){if(f.files[0])document.getElementById('ds-fn').textContent=f.files[0].name;});}};});
M.acts.dsSave=function(el){const t=DB().txns.find(function(x){return x.ref===el.getAttribute('data-ref');});const a=+val('ds-a'),d=val('ds-d');let ok=true;
  if(!(a>0&&a<=t.amount)){markErr('ds-a',true);ok=false;}else markErr('ds-a',false);if(d.length<10){markErr('ds-d',true);ok=false;}else markErr('ds-d',false);if(!ok){toast('Check the highlighted fields');return;}
  const k=MStore.next('DSP'),fl=document.getElementById('ds-f'),rec={id:410000+k,ref:'DSP-'+k,txnId:t.id,txnKey:t.ref,cardId:t.cardId,employeeEid:me().eid,merchant:t.merchant,txnAmount:t.amount,amount:a,reason:val('ds-r'),description:d,evidence:fl&&fl.files[0]?fl.files[0].name:'',status:'Open',iso:TODAY(),origin:'mobile',cid:MStore.cid()};
  MStore.act('dispute.raise',rec.ref,rec,function(){DB().disputes.unshift(rec);t.disputes=(t.disputes||[]).concat([rec.ref]);});toast(rec.ref+' raised · Finance will update you');back('#/t/'+t.ref);};

/* ── My benefits ── */
const BENEFITS=[['MEAL','Meal Allowance',2200,'Monthly'],['FUEL','Fuel Allowance',3000,'Monthly'],['TEL','Telecom Allowance',1000,'Monthly'],['GIFT','Festival Gift',5000,'One-time']];
route('/benefits',function(){const p=me(),c=myCards()[0],mon=MFmt.MONTH[todayD().getMonth()]+' '+todayD().getFullYear();
  const onb=p.status==='Onboarding';const tot=BENEFITS.reduce(function(s,b){return s+b[2];},0);
  let html='<div class="card"><div class="lbl">'+E(mon)+' entitlement</div><div class="b num" style="font-size:28px;line-height:34px;margin-top:2px">'+money(onb?0:tot)+'</div><div class="meta">'+(onb?'You become eligible once your onboarding is complete.':c?'Loaded to your card •••• '+E(c.last4)+'. Spend it at any matching store.':'Allocated to you. It is loaded when your card is issued.')+'</div></div>';
  html+='<div class="h2">Your benefits</div><div class="card p0">'+BENEFITS.map(function(b){const w=c?(c.wallets||[]).find(function(x){return x.code===b[0];}):null,ld=c?DB().loads.find(function(l){return l.cardId===c.id&&l.wallet===b[0]&&l.status==='Approved';}):null;
    const st=onb?badge('Not eligible yet','mut'):w&&ld?badge('Loaded','ok'):badge('Allocated','warn');
    return '<div class="row" style="align-items:flex-start"><span class="ico">'+ic(WICON[b[0]])+'</span><div class="row-m"><div class="row-t">'+E(b[1])+'</div><div class="row-s">'+E(b[3])+(ld?' · '+E(ld.ref):'')+'</div>'+(w&&ld?'<div class="bar5" style="margin:8px 0 4px"><i style="width:'+Math.round(w.balance/b[2]*100)+'%"></i></div><div class="cap">'+money(w.balance)+' left of '+money(b[2])+' · spent '+money(w.spent)+'</div>':'')+'</div><div class="row-r"><span class="b num">'+money(b[2])+'</span>'+st+'</div></div>';}).join('')+'</div>'
   +'<div class="cap" style="text-align:center;margin-top:14px">Benefit spends need no expense claim.</div>';
  return {title:'My benefits',up:'#/more',tab:'more',html:html};});

/* ── Receipt scan: Expenses -> New request -> Scan receipt (PaddleOCR in the browser, js/ocr.js) ── */
function rqScan(file){const f=M.state.rq;
  sheet('Scan receipt','<div style="text-align:center;padding:14px 0 6px"><div class="spin dark" style="margin:0 auto 14px"></div><div class="b" id="sc-step">Preparing the receipt reader\u2026</div><div class="cap" style="margin-top:6px">The first scan downloads the receipt reader once (about 20 MB). After that a receipt takes a few seconds.</div></div>');
  /* the photo is saved as the item's receipt while it is being read */
  const saving=MAtt.save(file,'scan');saving.catch(function(){});
  MOcr.read(file,TODAY(),function(t){const el=document.getElementById('sc-step');if(el)el.textContent=t;}).then(function(res){
      closeSheet();const l=rqApplyScan(f,res,file);l.busy=true;l.att=null;
      const again=function(){if(M.state.rq===f&&/^#\/expenses\/new/.test(location.hash)){rqRead();render();}};
      saving.then(function(link){l.att=link;l.file=link.name;l.size=fsize(link.size);l.busy=false;again();})
        .catch(function(e){l.busy=false;l.file='';l.size='';again();toast(e&&e.message?e.message:'Could not attach the photo. Add it again.');});
      render();
      const n=f.scan.filled.filter(function(x){return x!=='Receipt';}).length;
      toast(n?'Filled '+n+' field'+(n>1?'s':'')+' from the receipt. Check them and fill the rest.':'No details could be read from this photo. The photo is attached; fill the fields by hand.');})
    .catch(function(e){closeSheet();toast(e&&e.message?e.message:'Could not read the receipt. Try again.');if(window.console)console.warn(e);});}
function rqApplyScan(f,res,file){const x=res.fields,filled=[];f.type='claim';f.auto=f.auto||{};
  let l=f.lines.find(function(q){return !q.title&&!(+q.amount)&&!q.file;});if(!l){l=blankLine();l.paidBy=f.lines[f.lines.length-1].paidBy;f.lines.push(l);}l.auto={};
  const put=function(obj,flags,k,v,label){if(v==null||v==='')return;obj[k]=v;flags[k]=true;filled.push(label);};
  if(!f.title)put(f,f.auto,'title',x.title,'Title');
  if(!f.subCat&&x.subCat){f.subCat=x.subCat;f.expType=x.expType;f.auto.subCat=f.auto.expType=true;filled.push('Sub Category','Expense Type');}
  put(l,l.auto,'title',x.lineTitle,'Description');put(l,l.auto,'date',x.date,'Date');if(x.amount)put(l,l.auto,'amount',String(x.amount),'Amount');
  put(l,l.auto,'merchant',x.merchant,'Merchant');put(l,l.auto,'invoice',x.invoice,'Invoice No.');
  l.file=file.name&&!/^image\.\w+$/i.test(file.name)?file.name:'receipt-'+String(Date.now()).slice(-6)+'.jpg';l.size=fsize(file.size||0);filled.push('Receipt');
  l.ocr={engine:'PaddleOCR PP-OCRv4',fields:x,rows:(res.rows||[]).slice(0,80)};
  f.scan={filled:filled,rows:res.rows||[],fields:x};return l;}
M.acts.scanText=function(){const f=M.state.rq;if(!f||!f.scan)return;rqRead();
  sheet('Scanned text','<div class="cap" style="margin-bottom:8px">What the reader found on the receipt, top to bottom.</div><div style="font:13px/19px ui-monospace,Menlo,Consolas,monospace;background:var(--muted);border-radius:10px;padding:12px;white-space:pre-wrap;word-break:break-word;max-height:calc(var(--vh,1vh) * 55);overflow:auto">'+E((f.scan.rows||[]).join('\n')||'No text found.')+'</div>');};
