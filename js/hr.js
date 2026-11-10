/* The Figma screens: Home, Attendance, Leaves, More, Profile, Payslips, Assets, Announcements, Policies,
   Support tickets, Notifications. Fixes the 18 design defects listed in the Figma review (10 Nov 2026). */
const TODAY=function(){return MStore.db.today;};
function todayD(){return MFmt.iso(TODAY());}
function cmpIso(a,b){return a<b?-1:a>b?1:0;}
function addDays(iso,n){const d=MFmt.iso(iso);d.setDate(d.getDate()+n);return MFmt.isoOf(d);}
function joinIso(p){const d=new Date((p||{}).joinDate||'');return isNaN(d)?'2026-04-01':MFmt.isoOf(d);}
function holidayOn(iso){return MStore.db.hr.holidays.find(function(h){return h.date===iso;})||null;}
function isWeekend(iso){const g=MFmt.iso(iso).getDay();return g===0||g===6;}
function workDays(from,to){let n=0,d=from;while(d<=to){if(!isWeekend(d)&&!(holidayOn(d)&&holidayOn(d).kind==='Regular'))n++;d=addDays(d,1);}return n;}

/* ── Leave figures: one source for Home and Leaves (defects 4, 5) ── */
function leaveStats(p){const h=P.hr(p),t=h.leaveTotals||{};const total=(t.CL||0)+(t.SL||0)+(t.EL||0);
  const taken=(h.leaves||[]).filter(function(l){return l.status==='Approved';}).reduce(function(s,l){return s+l.days;},0);
  const pend=(h.leaves||[]).filter(function(l){return l.status==='Pending';}).reduce(function(s,l){return s+l.days;},0);
  const byType=MStore.db.hr.leaveTypes.map(function(x){const used=(h.leaves||[]).filter(function(l){return l.type===x.code&&l.status==='Approved';}).reduce(function(s,l){return s+l.days;},0);return {code:x.code,name:x.name,total:t[x.code]||0,used:used,left:(t[x.code]||0)-used};});
  return {total:total,taken:taken,pending:pend,avail:total-taken,byType:byType};}
function leaveOn(p,iso){return (P.hr(p).leaves||[]).find(function(l){return l.status==='Approved'&&l.from<=iso&&l.to>=iso;})||null;}
function leaveName(c){const x=MStore.db.hr.leaveTypes.find(function(t){return t.code===c;});return x?x.name:c;}
function leaveDates(l){return l.from===l.to?MFmt.date(l.from):MFmt.dshort(l.from)+' – '+MFmt.date(l.to);}
function leaveTone(s){return s==='Approved'?'ok':s==='Rejected'?'bad':s==='Pending'?'warn':'mut';}

/* ── Attendance: one rule for every screen (defect 7) ── */
function attDay(p,iso){
  if(iso<joinIso(p))return 'N';
  if(iso>TODAY())return 'F';
  const h=holidayOn(iso);if(h&&h.kind==='Regular')return 'H';
  if(isWeekend(iso))return 'W';
  if(leaveOn(p,iso))return 'L';
  if(iso===TODAY())return 'T';
  return 'P';
}
function dayMins(iso){const d=MFmt.iso(iso).getDate();return 540+((d*7)%23)-8;}
function clockInOf(iso){const d=MFmt.iso(iso).getDate();return '09:'+String(10+(d*3)%19).padStart(2,'0');}
function hm(m){return Math.floor(m/60)+'h '+String(Math.round(m%60)).padStart(2,'0')+'m';}
function clockState(){const s=MStore.db.session;return s.clock&&s.clock.date===TODAY()?s.clock:null;}
function weekMins(p){const t=todayD(),dow=(t.getDay()+6)%7;let m=0;for(let i=0;i<dow;i++){const iso=MFmt.isoOf(new Date(t.getFullYear(),t.getMonth(),t.getDate()-dow+i));if(attDay(p,iso)==='P')m+=dayMins(iso);}
  const c=clockState();if(c){m+=((c.out||Date.now())-c.inAt)/60000;}return m;}
function weekTarget(p){const t=todayD(),dow=(t.getDay()+6)%7;let d=0;for(let i=0;i<5;i++){const iso=MFmt.isoOf(new Date(t.getFullYear(),t.getMonth(),t.getDate()-dow+i));const a=attDay(p,iso);if(a!=='H'&&a!=='L'&&a!=='N')d++;}return d*9*60;}
function nowHM(){const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}

function clockCard(big){const p=me(),h=myHR(),c=clockState(),t=todayD();
  const where=E((p.branch||'Office').replace(' Branch',''))+' · Office · '+E(h.shift||'09:30 – 18:30');
  const head='<div class="lbl" style="text-transform:'+(big?'none':'uppercase')+';letter-spacing:'+(big?'0':'.04em')+'">'+(big?MFmt.DAY[t.getDay()]+', '+t.getDate()+' '+MFmt.MONTH[t.getMonth()]+' '+t.getFullYear():MFmt.DAY[t.getDay()]+', '+t.getDate()+' '+MFmt.MON[t.getMonth()])+'</div>';
  if(attDay(p,TODAY())==='L')return '<div class="card">'+head+'<div class="clock-st">On leave today</div><div class="meta">'+where+'</div></div>';
  let st,btn;
  if(!c){st='<div class="clock-st">Not clocked in</div>';btn='<button class="btn" data-act="clockIn" id="clk-btn" style="margin-top:14px">Clock In</button>';}
  else if(!c.out){st='<div class="clock-st live"><span id="clk-timer">'+hm((Date.now()-c.inAt)/60000)+'</span></div><div class="meta">Clocked in at '+E(c.inLabel)+'</div>';btn='<button class="btn sec" data-act="clockOut" style="margin-top:14px">Clock Out</button>';}
  else{st='<div class="clock-st">'+hm((c.out-c.inAt)/60000)+'</div><div class="meta">In '+E(c.inLabel)+' · Out '+E(c.outLabel)+'</div>';btn='';}
  return '<div class="card" id="clk-card">'+head+st+'<div class="meta" style="display:flex;align-items:center;gap:6px;margin-top:4px">'+ic('pin',16)+where+'</div>'+btn+'</div>';}
M.acts.clockIn=function(){const s=MStore.db.session;
  const doIt=function(){const b=document.getElementById('clk-btn');if(b){b.innerHTML='<span class="spin"></span>';b.disabled=true;}
    setTimeout(function(){const card=document.getElementById('clk-card');const lab=nowHM();
      if(card)card.innerHTML='<div class="tick">'+ic('check',28)+'</div><div style="text-align:center"><div class="b" style="font-size:17px">You’re clocked in</div><div class="meta">in at '+E(lab)+'</div></div>';
      setTimeout(function(){MStore.act('attendance.clockIn','',{date:TODAY(),time:lab},function(){s.clock={date:TODAY(),inAt:Date.now(),inLabel:lab};});render();},1100);},900);};
  if(!s.locOk){sheet('','<div class="ico round" style="margin:0 auto 12px;width:48px;height:48px">'+ic('pin',24)+'</div><div class="b" style="font-size:17px;margin-bottom:6px">Allow ADT to use your location?</div><div class="meta" style="margin-bottom:18px">Your location is recorded only when you clock in or out.</div><div class="btns"><button class="btn sec" data-act="closeSheet">Not now</button><button class="btn" id="loc-ok">Allow</button></div>',{dialog:true,after:function(w){w.querySelector('#loc-ok').onclick=function(){s.locOk=true;closeSheet();doIt();};}});}
  else doIt();};
M.acts.clockOut=function(){confirmBox('Clock out now?','Your working hours for today will be saved.','Clock Out',function(){const c=MStore.db.session.clock;const lab=nowHM();MStore.act('attendance.clockOut','',{date:TODAY(),time:lab},function(){c.out=Date.now();c.outLabel=lab;});render();toast('Clocked out at '+lab);});};
setInterval(function(){const t=document.getElementById('clk-timer'),c=clockState();if(t&&c&&!c.out)t.textContent=hm((Date.now()-c.inAt)/60000);},20000);

/* ── Home ── */
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':'Good evening';}
route('/home',function(){const p=me(),ls=leaveStats(p),wm=weekMins(p),wt=weekTarget(p)||2700;
  const h=myHR(),up=(h.leaves||[]).filter(function(l){return l.to>=TODAY()&&l.status!=='Rejected'&&l.status!=='Cancelled';}).sort(function(a,b){return cmpIso(a.from,b.from);})[0];
  const hol=MStore.db.hr.holidays.filter(function(x){return x.date>=TODAY();})[0];
  const anns=MStore.db.hr.announcements.slice(0,2),rd=MStore.db.reads[myUid()]||{};
  const att=expAttention(),appr=approvalsFor(myUid()).length;
  let html='<div class="stack">'+clockCard(false)
   +'<div class="tiles"><div class="tile" data-go="#/leaves"><span class="lbl">Leave balance</span><div class="val">'+ls.avail+'</div><div class="bar5"><i style="width:'+(ls.total?Math.round(ls.avail/ls.total*100):0)+'%"></i></div><div class="cap">of '+ls.total+' days · '+ls.taken+' used</div></div>'
   +'<div class="tile" data-go="#/attendance"><span class="lbl">This week</span><div class="val">'+hm(wm)+'</div><div class="bar5 ink"><i style="width:'+Math.min(100,Math.round(wm/wt*100))+'%"></i></div><div class="cap">'+(wm>=wt?'Target met':hm(wt-wm)+' to '+Math.round(wt/60)+'h')+'</div></div></div>';
  if(appr||att.length){html+='<div class="card"><div class="card-h"><span class="card-t">Needs your attention</span></div>'
    +(appr?rowHTML({icon:'approve',t:appr+' request'+(appr>1?'s':'')+' to approve',s:'Expenses, advances and card loads',go:'#/approvals',r:'<span class="cnt">'+appr+'</span>'}):'')
    +att.slice(0,3).map(function(a){return rowHTML({icon:a.icon,t:E(a.t),s:E(a.s),go:a.go});}).join('')+'</div>';}
  html+='<div class="card"><div class="card-h"><span class="card-t">Announcements</span><button class="link" data-go="#/announcements">View all</button></div>'
   +anns.map(function(a){return '<div class="row tap" data-go="#/announcements/'+a.id+'"><div class="row-m"><div class="row-t">'+(rd[a.id]?'':'<span class="tag" style="margin-right:6px;background:#FDF0E1;color:var(--orange)">NEW</span>')+E(a.title)+'</div><div class="row-s">'+E(a.src)+' · '+E(MFmt.dshort(a.when))+'</div></div><span class="chev">'+ic('chev',18)+'</span></div>';}).join('')+'</div>';
  html+='<div class="card"><div class="card-t" style="margin-bottom:4px">Coming up</div>'
   +(up?rowHTML({t:E(leaveName(up.type))+' · '+E(leaveDates(up)),s:E(up.status),go:'#/leaves'}):'')
   +(hol?rowHTML({t:E(hol.name)+' · '+E(MFmt.date(hol.date)),s:E(hol.kind)+' holiday',go:'#/leaves'}):'')+'</div>';
  const sc=[['Expenses','receipt','#/expenses',0],['My cards','card','#/cards',0],['Benefits','gift','#/benefits',0]];
  if(isApprover())sc.push(['Approvals','approve','#/approvals',appr]);
  sc.push(['Assets','laptop','#/assets',0],['Payslips','file','#/payslips',0]);
  html+='<div class="sec-h">Shortcuts</div><div class="shorts">'+sc.map(function(s){return '<button class="short" data-go="'+s[2]+'"><span class="ico">'+ic(s[1])+'</span>'+s[0]+(s[3]?'<span class="cnt">'+s[3]+'</span>':'')+'</button>';}).join('')+'</div></div>';
  return {title:greet()+', '+firstName(p),home:true,tab:'home',html:html};});

/* ── Attendance ── */
route('/attendance',function(){const p=me();const t=todayD();
  if(!M.state.attM)M.state.attM=[t.getFullYear(),t.getMonth()];
  const y=M.state.attM[0],m=M.state.attM[1],c=clockState();
  const startD=new Date(y,m,1),days=new Date(y,m+1,0).getDate(),lead=(startD.getDay()+6)%7;
  const jm=MFmt.iso(joinIso(p));const canPrev=(y>jm.getFullYear()||(y===jm.getFullYear()&&m>jm.getMonth())),canNext=(y<t.getFullYear()||(y===t.getFullYear()&&m<t.getMonth()));
  const cnt={P:0,L:0,A:0,H:0};let cells='';for(let i=0;i<lead;i++)cells+='<div></div>';
  for(let d=1;d<=days;d++){const iso=MFmt.isoOf(new Date(y,m,d)),a=attDay(p,iso);let cls='d',dot='';
    if(a==='P'){cnt.P++;dot='<i class="g"></i>';}else if(a==='L'){cnt.L++;cls+=' lv';dot='<i class="o"></i>';}else if(a==='H'){cnt.H++;dot='<i class="s"></i>';}else if(a==='W')cls+=' off';else if(a==='F'||a==='N')cls+=' fut';
    if(a==='T'){if(c){cnt.P++;dot='<i class="g"></i>';}cls+=' today';}
    cells+='<div class="'+cls+'"'+(a==='H'?' title="'+E(holidayOn(iso).name)+'"':'')+'>'+d+(dot||'<i></i>')+'</div>';}
  const ci=c?c.inLabel:'—',co=c&&c.out?c.outLabel:'—',hrs=c?hm(((c.out||Date.now())-c.inAt)/60000):'0h 00m';
  const html='<div class="stack">'+clockCard(true)
   +'<div class="tiles t3"><div class="tile"><span class="lbl">Clock In</span><div class="val" style="font-size:20px">'+E(ci)+'</div></div><div class="tile"><span class="lbl">Clock Out</span><div class="val" style="font-size:20px">'+E(co)+'</div></div><div class="tile"><span class="lbl">Hours</span><div class="val" style="font-size:20px">'+E(hrs)+'</div></div></div>'
   +'<div class="card"><div class="cal-h"><button class="ib" data-act="attMonth" data-d="-1"'+(canPrev?'':' disabled style="opacity:.3"')+'>'+ic('back',20)+'</button><span class="b" style="font-size:17px">'+MFmt.MONTH[m]+' '+y+'</span><button class="ib" data-act="attMonth" data-d="1"'+(canNext?'':' disabled style="opacity:.3"')+'>'+ic('chev',20)+'</button></div>'
   +'<div class="cal">'+['M','T','W','T','F','S','S'].map(function(x){return '<div class="dn">'+x+'</div>';}).join('')+cells+'</div>'
   +'<div class="legend"><span><i class="g"></i>'+cnt.P+' Present</span><span><i class="o"></i>'+cnt.L+' Leave</span><span><i class="r"></i>'+cnt.A+' Absent</span><span><i class="s"></i>'+cnt.H+' Holiday</span></div></div></div>';
  return {title:'Attendance',tab:'attendance',html:html};});
M.acts.attMonth=function(el){const d=+el.getAttribute('data-d');let y=M.state.attM[0],m=M.state.attM[1]+d;if(m<0){m=11;y--;}if(m>11){m=0;y++;}M.state.attM=[y,m];render();};

/* ── Leaves ── */
route('/leaves',function(){const p=me(),h=myHR(),ls=leaveStats(p);const tab=M.state.lvTab||'up';
  const all=(h.leaves||[]).slice().sort(function(a,b){return cmpIso(b.from,a.from);});
  const up=all.filter(function(l){return l.to>=TODAY();}).reverse(),hist=all.filter(function(l){return l.to<TODAY();});
  const row=function(l){return '<div class="row tap" data-act="leaveInfo" data-id="'+l.id+'"><div class="row-m"><div class="row-t">'+E(leaveName(l.type))+'</div><div class="row-s">'+E(leaveDates(l))+' · '+l.days+' day'+(l.days>1?'s':'')+'</div></div>'+badge(l.status,leaveTone(l.status))+'</div>';};
  let html='<div class="tiles t3"><div class="tile"><span class="lbl">Available</span><div class="val">'+ls.avail+'<small>days</small></div><div class="bar5"><i style="width:'+(ls.total?Math.round(ls.avail/ls.total*100):0)+'%"></i></div></div>'
   +'<div class="tile"><span class="lbl">Availed</span><div class="val">'+ls.taken+'<small>days</small></div><div class="bar5 ink"><i style="width:'+(ls.total?Math.round(ls.taken/ls.total*100):0)+'%"></i></div></div>'
   +'<div class="tile"><span class="lbl">Total</span><div class="val">'+ls.total+'<small>/ year</small></div><div class="bar5 gr"><i style="width:100%"></i></div></div></div>'
   +'<button class="btn" data-act="later" data-m="Applying for leave" style="margin-top:12px">Apply leave</button>';
  if(!all.length)html+='<div style="margin-top:12px">'+emptyHTML('cal','No leave requests yet','Leaves you apply for will appear here with their status.')+'</div>';
  else{html+='<div class="tabs" style="margin-top:14px"><button class="'+(tab==='up'?'on':'')+'" data-act="lvTab" data-t="up">Upcoming</button><button class="'+(tab==='hist'?'on':'')+'" data-act="lvTab" data-t="hist">History</button></div>';
    if(tab==='up')html+=up.length?'<div class="card p0" style="margin-top:12px">'+up.map(row).join('')+'</div>':'<div class="card" style="margin-top:12px"><div class="meta">No upcoming leave.</div></div>';
    else{const yr=M.state.lvYear||todayD().getFullYear(),mon=M.state.lvMon;const inY=hist.filter(function(l){return +l.from.slice(0,4)===yr;});
      const months=MFmt.MON.map(function(n,i){const has=inY.some(function(l){return +l.from.slice(5,7)===i+1;});return '<button class="'+(mon===i?'on':'')+(has?'':' na')+'" data-act="lvMon" data-m="'+i+'">'+n+(has?'<i></i>':'')+'</button>';}).join('');
      const shown=mon==null?inY:inY.filter(function(l){return +l.from.slice(5,7)===mon+1;});
      const days=shown.filter(function(l){return l.status==='Approved';}).reduce(function(s,l){return s+l.days;},0);
      html+='<div class="card" style="margin-top:12px"><div class="cal-h"><span class="b">'+yr+'</span>'+(mon!=null?'<button class="link" data-act="lvMon" data-m="">All months</button>':'')+'</div><div class="mgrid">'+months+'</div></div>'
        +'<div class="sec-h">'+(mon!=null?MFmt.MONTH[mon]:'This year')+' · '+shown.length+' request'+(shown.length===1?'':'s')+' · '+days+' day'+(days===1?'':'s')+' taken</div>'
        +(shown.length?'<div class="card p0">'+shown.map(row).join('')+'</div>':'<div class="card"><div class="meta">No leave in this period.</div></div>');}}
  html+='<div class="card" style="margin-top:12px"><div class="card-t" style="margin-bottom:4px">Upcoming holidays</div>'+MStore.db.hr.holidays.filter(function(x){return x.date>=TODAY();}).map(function(x){const d=MFmt.iso(x.date);return '<div class="row"><div class="row-m"><div class="row-t">'+E(x.name)+'</div><div class="row-s">'+MFmt.DAY[d.getDay()].slice(0,3)+', '+E(MFmt.date(x.date))+'</div></div>'+badge(x.kind,x.kind==='Optional'?'info':'mut')+'</div>';}).join('')+'</div>';
  return {title:'Leaves',tab:'leaves',html:html};});
M.acts.lvTab=function(el){M.state.lvTab=el.getAttribute('data-t');render();};
M.acts.lvMon=function(el){const v=el.getAttribute('data-m');M.state.lvMon=v===''?null:+v;render();};
M.acts.leaveInfo=function(el){const l=(myHR().leaves||[]).find(function(x){return x.id===el.getAttribute('data-id');});if(!l)return;const mgr=P.byEid(me().managerEid);
  sheet(leaveName(l.type),'<div>'+kv('Dates',E(leaveDates(l)))+kv('Days',String(l.days))+kv('Status',badge(l.status,leaveTone(l.status)))+kv('Reason',E(l.reason||'—'))+kv('Approver',E(mgr?mgr.name:'Reporting manager'))+'</div>'+(l.note?'<div class="callout bad">'+E(l.note)+'</div>':'')
   +(l.status==='Pending'?'<button class="btn danger" style="margin-top:14px" data-act="leaveCancel" data-id="'+l.id+'">Cancel request</button>':''));};
M.acts.leaveCancel=function(el){const id=el.getAttribute('data-id');closeSheet();confirmBox('Cancel this leave request?','Your manager will be told it is cancelled.','Cancel request',function(){const h=myHR();MStore.act('leave.cancel',id,{},function(){const l=h.leaves.find(function(x){return x.id===id;});l.status='Cancelled';});render();toast('Leave request cancelled');},true);};

route('/leaves/apply',function(){const p=me(),ls=leaveStats(p),mgr=P.byEid(p.managerEid),f=M.state.lvForm||(M.state.lvForm={type:'CL',mode:'one',from:addDays(TODAY(),1),to:addDays(TODAY(),1),reason:'',cc:[]});
  const types=ls.byType.filter(function(t){return t.total>0;}).map(function(t){return [t.code,t.name+' · '+t.left+' left'];});
  const html='<div class="card">'+field('Leave type',select('lv-type',types,f.type),{req:true})
   +'<div class="fg"><span class="lbl">Duration</span><div class="seg" style="margin-top:6px"><button class="'+(f.mode==='one'?'on':'')+'" data-act="lvMode" data-m="one">One day</button><button class="'+(f.mode==='multi'?'on':'')+'" data-act="lvMode" data-m="multi">Multiple days</button></div></div>'
   +(f.mode==='one'?field('Date',input('lv-from',f.from,{type:'date',min:TODAY()}),{req:true}):'<div class="two">'+field('From',input('lv-from',f.from,{type:'date',min:TODAY()}),{req:true})+field('To',input('lv-to',f.to,{type:'date',min:TODAY()}),{req:true})+'</div>')
   +field('Reason',textarea('lv-reason',f.reason,'Tell your manager why'),{req:true})+'</div>'
   +'<div class="card" style="margin-top:12px"><div class="card-t" style="margin-bottom:8px">Recipients</div><div class="lbl" style="margin-bottom:6px">Approver</div><div class="tools" style="flex-wrap:wrap"><span class="pill">'+E(mgr?mgr.name:'Reporting manager')+' · Reporting manager</span></div>'
   +'<div class="lbl" style="margin:12px 0 6px">Cc</div><div class="tools" style="flex-wrap:wrap" id="lv-cc">'+f.cc.map(function(eid){const x=P.byEid(eid);return '<button class="pill" data-act="ccRemove" data-eid="'+eid+'">'+E(x?x.name:eid)+' '+ic('x',14)+'</button>';}).join('')+'<button class="pill" data-act="ccPick">'+ic('plus',16)+' Add person</button></div></div>'
   +'<div class="card" style="margin-top:12px" id="lv-sum"></div>';
  return {title:'Apply leave',up:'#/leaves',html:html,foot:'<div class="btns"><button class="btn" data-act="lvSubmit">Submit</button><button class="btn sec" data-act="lvCancelForm">Cancel</button></div>',
    after:function(){const upd=function(){lvRead();const s=lvSummary();document.getElementById('lv-sum').innerHTML=kv('Days requested',String(s.days))+kv(leaveName(f.type)+' balance after',s.after+' of '+s.total);};
      ['lv-type','lv-from','lv-to'].forEach(function(id){const el=document.getElementById(id);if(el)el.addEventListener('change',upd);});upd();}};});
function lvRead(){const f=M.state.lvForm;if(!f)return;if(document.getElementById('lv-type'))f.type=val('lv-type');if(document.getElementById('lv-from'))f.from=val('lv-from');f.to=f.mode==='one'?f.from:(val('lv-to')||f.from);if(document.getElementById('lv-reason'))f.reason=val('lv-reason');}
function lvSummary(){const f=M.state.lvForm,t=leaveStats(me()).byType.find(function(x){return x.code===f.type;})||{left:0,total:0};const days=f.from&&f.to&&f.to>=f.from?workDays(f.from,f.to):0;return {days:days,after:t.left-days,total:t.total};}
M.acts.lvMode=function(el){lvRead();M.state.lvForm.mode=el.getAttribute('data-m');render();};
M.acts.ccRemove=function(el){lvRead();const f=M.state.lvForm;f.cc=f.cc.filter(function(x){return x!==el.getAttribute('data-eid');});render();};
M.acts.ccPick=function(){lvRead();const f=M.state.lvForm,mine=me();const list=function(q){return P.all().filter(function(x){return x.eid!==mine.eid&&x.eid!==mine.managerEid&&(!q||x.name.toLowerCase().indexOf(q)>=0||x.email.indexOf(q)>=0);}).map(function(x){const on=f.cc.indexOf(x.eid)>=0;return '<button class="opt" data-act="ccToggle" data-eid="'+x.eid+'"><span style="display:flex;gap:10px;align-items:center"><span class="av" style="width:32px;height:32px;font-size:12px">'+E(MFmt.initials(x.name))+'</span><span><span style="display:block;font-weight:500">'+E(x.name)+'</span><span class="cap">'+E(x.jobTitle||x.dept)+' · '+E(x.email)+'</span></span></span>'+(on?'<span class="ok-t">'+ic('check',20)+'</span>':'')+'</button>';}).join('')||'<div class="meta" style="padding:14px 0">No one found.</div>';};
  sheet('Add to Cc','<div class="search" style="margin-bottom:8px">'+ic('search',18)+'<input id="cc-q" placeholder="Search by name or email"></div><div id="cc-list">'+list('')+'</div><button class="btn" style="margin-top:12px" data-act="ccDone">Done</button>',{after:function(w){w.querySelector('#cc-q').addEventListener('input',function(e){w.querySelector('#cc-list').innerHTML=list(e.target.value.trim().toLowerCase());});}});};
M.acts.ccToggle=function(el){const f=M.state.lvForm,eid=el.getAttribute('data-eid');const i=f.cc.indexOf(eid);if(i>=0)f.cc.splice(i,1);else f.cc.push(eid);const on=f.cc.indexOf(eid)>=0;const tail=el.querySelector('.ok-t');if(on&&!tail)el.insertAdjacentHTML('beforeend','<span class="ok-t">'+ic('check',20)+'</span>');if(!on&&tail)tail.remove();};
M.acts.ccDone=function(){closeSheet();render();};
M.acts.lvCancelForm=function(){M.state.lvForm=null;back('#/leaves');};
M.acts.lvSubmit=function(){lvRead();const f=M.state.lvForm,s=lvSummary();
  if(!f.from||(f.mode==='multi'&&f.to<f.from)){toast('Choose valid dates');return;}
  if(!s.days){toast('These dates have no working days');return;}
  if(s.after<0){toast('Not enough '+leaveName(f.type)+' left');return;}
  if(f.reason.length<3){markErr('lv-reason',true);toast('Add a reason');return;}
  const h=myHR(),rec={id:'LV-'+MStore.next('LV'),type:f.type,from:f.from,to:f.to,days:s.days,status:'Pending',reason:f.reason,cc:f.cc.slice(),origin:'mobile',cid:MStore.cid()};
  MStore.act('leave.apply',rec.id,rec,function(){h.leaves.unshift(rec);});M.state.lvForm=null;M.state.lvTab='up';toast('Leave request sent to your manager');back('#/leaves');};

/* ── More ── */
route('/more',function(){const p=me(),h=myHR(),pend=approvalsFor(myUid()).length,ack=MStore.db.hr.policies.filter(function(x){return policyNeeds(x);}).length;
  const grp=function(t,rows){return '<div class="card p0" style="margin-top:12px"><div class="sec-h up" style="margin:14px 16px 2px">'+t+'</div>'+rows.join('')+'</div>';};
  const r=function(icon,t,go,cnt){return rowHTML({icon:icon,t:t,go:go,r:cnt?'<span class="cnt">'+cnt+'</span>':null});};
  const html='<div class="card p0">'+'<div class="row tap" data-go="#/profile" style="padding:16px"><span class="av lg" style="width:52px;height:52px;font-size:17px">'+E(MFmt.initials(p.name))+'</span><div class="row-m"><div class="row-t" style="font-size:17px">'+E(p.name)+'</div><div class="row-s">'+E(p.jobTitle)+' · '+E(p.empId)+'</div></div><span class="chev">'+ic('chev',18)+'</span></div></div>'
   +grp('Work',[r('laptop','My assets','#/assets',(h.assets||[]).length),r('receipt','Expenses','#/expenses',expDraftCount()),isApprover()?r('approve','Approvals','#/approvals',pend):'',r('shield','Policies','#/policies',ack)])
   +grp('Money & records',[r('card','My cards & wallets','#/cards'),r('gift','My benefits','#/benefits'),r('file','Payslips','#/payslips')])
   +grp('Help',[r('ticket','Support tickets','#/support',(h.tickets||[]).filter(function(t){return t.s==='Open';}).length)])
   +grp('Account',[rowHTML({icon:'swap',t:'Switch user',s:'Use the app as another person',act:'switchUser',r:''})])
   +'<div class="card p0" style="margin-top:12px"><div class="row tap" data-act="signOut"><span class="ico" style="background:var(--bad-bg);color:var(--bad)">'+ic('out')+'</span><div class="row-m"><div class="row-t bad-t">Sign out</div></div></div></div>'
   +'<div class="cap" style="text-align:center;margin-top:16px">ADT · Employee v1.0 · '+E(MStore.db.entity.name)+'</div><div style="text-align:center;margin-top:6px"><button class="cap" style="text-decoration:underline" data-act="resetData">Reset app data</button></div>';
  return {title:'More',tab:'more',html:html};});
M.acts.resetData=function(){confirmBox('Reset app data?','Everything done in the app on this phone is removed and the prepared Nova Retail data comes back.','Reset',function(){MStore.reset();M.state={};render();toast('App data reset');},true);};

/* ── Profile ── */
function completeness(p){const h=P.hr(p),items=[[!!h.emergency,'Add an emergency contact'],[(h.bank||{}).status==='Verified','Bank details waiting for verification'],[!(h.docs&&h.docs.todo.some(function(d){return d.m;})),'Upload your mandatory documents'],[!(h.docs&&h.docs.up.some(function(d){return d.s==='Re-upload';})),'Re-upload a document'],[!!(h.addr&&h.addr.line),'Add your address']];
  const done=items.filter(function(x){return x[0];}).length;const miss=items.find(function(x){return !x[0];});return {pct:Math.round(60+done/items.length*40),hint:miss?miss[1]+' to reach 100%.':'Your profile is complete.'};}
route('/profile',function(){const p=me(),c=completeness(p),ent=MStore.db.entity.name;
  const tile=function(icon,t,s,go){return '<button class="card" style="text-align:left" data-go="'+go+'"><span class="ico">'+ic(icon)+'</span><div class="b" style="font-size:17px;margin-top:12px">'+t+'</div><div class="meta" style="margin-top:2px">'+s+'</div></button>';};
  const html='<div class="card"><div style="display:flex;gap:14px;align-items:center"><span class="av lg">'+E(MFmt.initials(p.name))+'</span><div style="min-width:0"><div class="b" style="font-size:20px;line-height:26px">'+E(p.name)+'</div><div class="meta">'+E(p.jobTitle)+' · '+E(p.empId)+'</div><div class="cap">'+E(ent)+' · '+E(p.desc||'Full Time')+'</div></div></div>'
   +'<div style="display:flex;justify-content:space-between;margin-top:14px" class="lbl"><span>Profile completeness</span><span class="b" style="color:var(--ink)">'+c.pct+'%</span></div><div class="bar5"><i style="width:'+c.pct+'%"></i></div><div class="cap">'+E(c.hint)+'</div></div>'
   +'<div class="tiles" style="margin-top:12px">'+tile('info','Basic details','Name, role, date of birth, emergency contact','#/profile/basic')+tile('contact','Contact details','Phone, email, address','#/profile/contact')+tile('bank','Bank details','Salary account, UAN, PAN','#/profile/bank')+tile('file','Documents','KYC and issued papers','#/profile/documents')+'</div>'
   +'<div class="card p0" style="margin-top:12px">'+rowHTML({icon:'swap',t:'Switch user',s:'Signed in as '+E(p.name),act:'switchUser',r:'<span class="link">Switch</span>'})+'</div>';
  return {title:'My profile',up:'#/more',tab:'more',html:html};});
route('/profile/basic',function(){const p=me(),h=myHR(),mgr=P.byEid(p.managerEid);
  const em=h.emergency;
  const html='<div class="card"><div class="card-h"><span class="card-t">Identity</span></div>'+kv('Full name',E(p.name))+kv('Employee ID',E(p.empId))+kv('Designation',E(p.jobTitle))+kv('Department',E(p.dept))+kv('Date of birth',E(MFmt.date(p.dob)))+kv('Gender',E(p.gender||'—'))+'<div class="help">Managed by HR — raise a ticket to change.</div></div>'
   +'<div class="card" style="margin-top:12px"><div class="card-h"><span class="card-t">Employment</span></div>'+kv('Entity',E(MStore.db.entity.name))+kv('Engagement',E(p.desc||'Full Time'))+kv('Joining date',E(MFmt.date(joinIso(p))))+kv('Reporting manager',E(mgr?mgr.name:'—'))+kv('Work location',E(p.branch||'—'))+kv('Shift',E(h.shift||'—'))+'</div>'
   +'<div class="card" style="margin-top:12px"><div class="card-h"><span class="card-t">Emergency contact</span><button class="link" data-act="later" data-m="Editing your profile">'+(em?'Edit':'Add')+'</button></div>'+(em?kv('Name',E(em.name))+kv('Relationship',E(em.rel))+kv('Mobile',E(em.mobile)):'<div class="meta">No emergency contact yet. Add one so HR can reach your family if needed.</div>')+'</div>';
  return {title:'Basic details',up:'#/profile',tab:'more',html:html};});
route('/profile/emergency',function(){const em=myHR().emergency||{};
  const html='<div class="card">'+field('Full name',input('em-name',em.name),{req:true})+field('Relationship',select('em-rel',['Spouse','Mother','Father','Sibling','Friend','Other'],em.rel,{ph:'Select'}),{req:true})+field('Mobile',input('em-mob',em.mobile,{type:'tel',mode:'tel',ph:'+91'}),{req:true})+'<div class="help" style="margin-top:12px">Shared with HR and your reporting manager, only for emergencies.</div></div>';
  return {title:'Emergency contact',up:'#/profile/basic',html:html,foot:'<div class="btns"><button class="btn" data-act="emSave">Save contact</button><button class="btn sec" data-back="#/profile/basic">Cancel</button></div>'};});
M.acts.emSave=function(){const n=val('em-name'),r=val('em-rel'),m=val('em-mob');markErr('em-name',!n);markErr('em-rel',!r);markErr('em-mob',m.replace(/\D/g,'').length<10);
  if(!n||!r||m.replace(/\D/g,'').length<10){toast('Fill in every field');return;}const h=myHR();MStore.act('profile.emergency','',{name:n,rel:r,mobile:m},function(){h.emergency={name:n,rel:r,mobile:m};});toast('Emergency contact saved');back('#/profile/basic');};
route('/profile/contact',function(){const p=me(),h=myHR(),a=h.addr||{},pa=h.perm||{};
  const adr=function(x){return E([x.line,x.city,x.state].filter(Boolean).join(', '))+(x.pin?' – '+E(x.pin):'');};
  const html='<div class="card"><div class="card-h"><span class="card-t">Reach me</span><button class="link" data-act="later" data-m="Editing your profile">Edit</button></div>'+kv('Work email',E(p.email))+kv('Personal email',E(h.personal||'—'))+kv('Mobile',E(p.contact||'—'))+kv('Alternate',E(h.alt||'—'))+'</div>'
   +'<div class="card" style="margin-top:12px"><div class="card-h"><span class="card-t">Current address</span><button class="link" data-act="later" data-m="Editing your profile">Edit</button></div><div style="padding:4px 0">'+adr(a)+'</div>'+(a.since?'<div class="cap">Since '+E(MFmt.date(a.since))+'</div>':'')+'</div>'
   +'<div class="card" style="margin-top:12px"><div class="card-h"><span class="card-t">Permanent address</span></div><div style="padding:4px 0">'+adr(pa)+'</div></div>';
  return {title:'Contact details',up:'#/profile',tab:'more',html:html};});
route('/profile/contact/edit',function(){const p=me(),h=myHR(),a=h.addr||{};
  const html='<div class="card"><div class="card-t" style="margin-bottom:10px">Reach me</div>'+field('Work email',input('ce-work',p.email,{lock:true}),{help:'Managed by HR — raise a ticket to change.'})+field('Personal email',input('ce-pers',h.personal,{type:'email'}))+field('Mobile',input('ce-mob',p.contact,{type:'tel',mode:'tel'}),{req:true})+field('Alternate number',input('ce-alt',h.alt,{type:'tel',mode:'tel'}))+'</div>'
   +'<div class="card" style="margin-top:12px"><div class="card-t" style="margin-bottom:10px">Current address</div>'+field('Address',input('ce-line',a.line),{req:true})+field('City',input('ce-city',a.city),{req:true})+'<div class="two">'+field('State',input('ce-state',a.state),{req:true})+field('PIN code',input('ce-pin',a.pin,{mode:'numeric'}),{req:true})+'</div></div>';
  return {title:'Edit contact details',up:'#/profile/contact',html:html,foot:'<div class="btns"><button class="btn" data-act="ceSave">Save changes</button><button class="btn sec" data-back="#/profile/contact">Cancel</button></div>'};});
M.acts.ceSave=function(){const req=['ce-mob','ce-line','ce-city','ce-state','ce-pin'];let ok=true;req.forEach(function(id){const bad=!val(id);markErr(id,bad);if(bad)ok=false;});if(!/^\d{6}$/.test(val('ce-pin'))){markErr('ce-pin',true);ok=false;}
  if(!ok){toast('Check the highlighted fields');return;}const p=me(),h=myHR();const v={personal:val('ce-pers'),mobile:val('ce-mob'),alt:val('ce-alt'),addr:{line:val('ce-line'),city:val('ce-city'),state:val('ce-state'),pin:val('ce-pin'),since:(h.addr||{}).since}};
  MStore.act('profile.contact','',v,function(){h.personal=v.personal;h.alt=v.alt;p.contact=v.mobile;h.addr=v.addr;});toast('Contact details saved');back('#/profile/contact');};
route('/profile/bank',function(){const p=me(),h=myHR(),b=h.bank||{},s=h.stat||{};
  const html='<div class="card"><div class="card-h"><span style="display:flex;gap:10px;align-items:center"><span class="ico">'+ic('bank')+'</span><span><span class="b" style="display:block">'+E(b.name)+'</span><span class="cap">Salary account</span></span></span>'+badge(b.status,b.status==='Verified'?'ok':'warn')+'</div>'
   +kv('Account number','•••• •••• '+E(b.acc))+kv('Account holder',E(p.name))+kv('IFSC',E(b.ifsc))+kv('Branch',E(b.branch))+kv('Account type',E(b.type))+'<button class="btn sec" style="margin-top:12px" data-act="later" data-m="Changing your salary account">Change salary account</button></div>'
   +'<div class="card" style="margin-top:12px"><div class="card-h"><span class="card-t">Statutory</span></div>'+kv('PAN',E(s.pan))+kv('UAN',E(s.uan))+kv('PF number',E(s.pf))+kv('ESI',E(s.esi))+'<div class="help">Managed by HR — raise a ticket to change.</div></div>';
  return {title:'Bank details',up:'#/profile',tab:'more',html:html};});
route('/profile/bank/edit',function(){const p=me(),b=myHR().bank||{};
  const html='<div class="card">'+field('Account holder',input('bk-h',p.name,{lock:true}),{help:'Must match your name as per PAN.'})+field('Account number',input('bk-a','',{type:'password',mode:'numeric',ph:'Enter account number'}),{req:true})+field('Re-enter account number',input('bk-a2','',{mode:'numeric',ph:'Re-enter account number'}),{req:true})+field('IFSC',input('bk-i','',{ph:'e.g. HDFC0000523'}),{req:true})+field('Bank',input('bk-b','',{ph:'Bank name'}),{req:true})+field('Branch',input('bk-br',''))+field('Account type',select('bk-t',['Savings','Current','Salary'],b.type||'Savings'))+'<div class="help" style="margin-top:12px">HR verifies the new account before your next salary is paid into it.</div></div>';
  return {title:'Change salary account',up:'#/profile/bank',html:html,foot:'<div class="btns"><button class="btn" data-act="bkSave">Send for verification</button><button class="btn sec" data-back="#/profile/bank">Cancel</button></div>'};});
M.acts.bkSave=function(){const a=val('bk-a'),a2=val('bk-a2'),i=val('bk-i').toUpperCase(),b=val('bk-b');let ok=true;
  if(!/^\d{9,18}$/.test(a)){markErr('bk-a',true);ok=false;}else markErr('bk-a',false);if(a!==a2){markErr('bk-a2',true);ok=false;}else markErr('bk-a2',false);
  if(!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(i)){markErr('bk-i',true);ok=false;}else markErr('bk-i',false);if(!b){markErr('bk-b',true);ok=false;}
  if(!ok){toast('Check the highlighted fields');return;}const h=myHR();MStore.act('profile.bank','',{acc:'••'+a.slice(-4),ifsc:i,bank:b},function(){h.bank={name:b,acc:a.slice(-4),ifsc:i,branch:val('bk-br')||'—',type:val('bk-t'),status:'Pending verification'};});toast('Sent to HR for verification');back('#/profile/bank');};
route('/profile/documents',function(){const d=myHR().docs||{req:[],up:[],todo:[]};const re=d.up.filter(function(x){return x.s==='Re-upload';});
  const up=function(n){return '<button class="btn sm sec" data-act="later" data-m="Document upload">Upload</button>';};
  let html='';
  if(re.length)html+='<div class="banner" style="margin-bottom:12px"><div class="b">'+re.length+' document needs re-upload</div><div class="meta" style="margin-top:2px">'+E(re[0].n)+': '+E(re[0].note||'')+'</div><button class="btn" data-act="later" data-m="Document upload">Re-upload now</button></div>';
  if(d.req.length)html+='<div class="sec-h">Requested</div><div class="card p0">'+d.req.map(function(x){return '<div class="row"><span class="ico">'+ic('file')+'</span><div class="row-m"><div class="row-t">'+E(x.n)+'</div><div class="row-s warn-t">Due '+E(MFmt.date(x.due))+'</div></div>'+up(x.n)+'</div>';}).join('')+'</div>';
  html+='<div class="sec-h">Uploaded</div>'+(d.up.length?'<div class="card p0">'+d.up.map(function(x){return '<div class="row"><span class="ico">'+ic('file')+'</span><div class="row-m"><div class="row-t">'+E(x.n)+'</div>'+(x.f?'<div class="row-s">'+E(x.f)+'</div>':'')+'</div>'+badge(x.s,x.s==='Approved'?'ok':x.s==='Re-upload'?'bad':'warn')+'</div>';}).join('')+'</div>':'<div class="card"><div class="meta">Nothing uploaded yet.</div></div>');
  if(d.todo.length)html+='<div class="sec-h">Not uploaded</div><div class="card p0">'+d.todo.map(function(x){return '<div class="row"><span class="ico">'+ic('upload')+'</span><div class="row-m"><div class="row-t">'+E(x.n)+'</div>'+(x.m?'<div class="row-s bad-t">Mandatory</div>':'<div class="row-s">Optional</div>')+'</div>'+up(x.n)+'</div>';}).join('')+'</div>';
  return {title:'Documents',up:'#/profile',tab:'more',html:html,after:function(){document.querySelectorAll('input[data-doc]').forEach(function(inp){inp.addEventListener('change',function(){if(!inp.files||!inp.files[0])return;const n=inp.getAttribute('data-doc'),f=inp.files[0].name,d=myHR().docs;
    MStore.act('profile.document',n,{file:f},function(){d.req=d.req.filter(function(x){return x.n!==n;});d.todo=d.todo.filter(function(x){return x.n!==n;});const e=d.up.find(function(x){return x.n===n;});if(e){e.s='Pending';e.f=f;delete e.note;}else d.up.push({n:n,s:'Pending',f:f});});render();toast(n+' uploaded for HR review');});});}};});

/* ── Announcements ── */
route('/announcements',function(){const f=M.state.anF||'All',rd=MStore.db.reads[myUid()]||{};const src=['All','HR','Finance','Admin'];
  const list=MStore.db.hr.announcements.filter(function(a){return f==='All'||a.src===f;});
  const html='<div class="chips">'+src.map(function(s){return '<button class="pill'+(f===s?' on':'')+'" data-act="anF" data-f="'+s+'">'+s+'</button>';}).join('')+'</div>'
   +'<div class="card p0" style="margin-top:12px">'+(list.length?list.map(function(a){return '<div class="ann tap" data-go="#/announcements/'+a.id+'">'+(rd[a.id]?'<span style="width:8px"></span>':'<span class="unread"></span>')+'<div class="row-m"><div class="b" style="line-height:21px">'+E(a.title)+'</div><div class="meta" style="margin-top:2px">'+E(a.preview)+'</div><div class="cap" style="margin-top:6px">'+E(a.src)+' · '+E(a.by)+' · '+E(MFmt.date(a.when))+'</div></div></div>';}).join(''):'<div class="row"><div class="meta">No announcements from '+E(f)+'.</div></div>')+'</div>';
  return {title:'Announcements',up:'#/home',tab:'home',html:html};});
M.acts.anF=function(el){M.state.anF=el.getAttribute('data-f');render();};
function markRead(id){const r=MStore.db.reads[myUid()]||(MStore.db.reads[myUid()]={});if(!r[id]){r[id]=1;MStore.act('notice.read',id,{},null);}}
function bodyHTML(b){return '<div class="body">'+b.map(function(x){return Array.isArray(x)?'<ul>'+x.map(function(i){return '<li>'+E(i)+'</li>';}).join('')+'</ul>':'<p>'+E(x)+'</p>';}).join('')+'</div>';}
route('/announcements/:id',function(pr){const a=MStore.db.hr.announcements.find(function(x){return x.id===pr.id;});if(!a)return null;markRead(a.id);
  const html='<div class="card"><div class="b" style="font-size:20px;line-height:26px">'+E(a.title)+'</div><div style="display:flex;gap:10px;align-items:center;margin:12px 0 14px"><span class="av or" style="width:32px;height:32px;font-size:12px">'+E(MFmt.initials(a.by))+'</span><div><div style="font-size:14px;font-weight:500">'+E(a.by)+' · '+E(a.src)+'</div><div class="cap">'+E(MFmt.date(a.when))+(a.eff?' · Effective from '+E(MFmt.date(a.eff)):'')+'</div></div></div>'+bodyHTML(a.body)+'</div>';
  return {title:'Announcement',up:'#/announcements',tab:'home',html:html};});

/* ── Policies ── */
function policyNeeds(x){const a=(MStore.db.reads[myUid()]||{});return x.need&&!a['ack-'+x.id];}
route('/policies',function(){const pol=MStore.db.hr.policies,need=pol.filter(policyNeeds);const groups=['HR & Leave','Finance','IT & Security'];
  let html=need.length?'<div class="banner" style="margin-bottom:12px"><div class="b">'+need.length+' polic'+(need.length>1?'ies need':'y needs')+' your acknowledgement</div><div class="meta">Read and acknowledge the updated policies.</div><button class="btn" data-go="#/policies/'+need[0].id+'">Review now</button></div>':'';
  groups.forEach(function(g){const l=pol.filter(function(x){return x.group===g;});if(!l.length)return;html+='<div class="sec-h">'+E(g)+'</div><div class="card p0">'+l.map(function(x){return rowHTML({icon:'shield',t:E(x.name),s:E(x.ver),go:'#/policies/'+x.id,r:policyNeeds(x)?badge('Action needed','warn'):badge('Acknowledged','ok')});}).join('')+'</div>';});
  return {title:'Policies',up:'#/more',tab:'more',html:html};});
route('/policies/:id',function(pr){const x=MStore.db.hr.policies.find(function(q){return q.id===pr.id;});if(!x)return null;const need=policyNeeds(x);
  return {title:x.name,up:'#/policies',tab:'more',html:'<div class="card"><div class="cap" style="margin-bottom:10px">'+E(x.group)+' · '+E(x.ver)+'</div>'+bodyHTML(x.body)+'</div>'+(need?'':'<div class="callout ok">'+ic('check',16).replace('<svg','<svg style="display:inline;vertical-align:-3px;margin-right:6px"')+'You have acknowledged this policy.</div>'),
    foot:need?'<button class="btn" data-act="ack" data-id="'+x.id+'">I have read and acknowledge</button>':null};});
M.acts.ack=function(el){const id=el.getAttribute('data-id');const r=MStore.db.reads[myUid()]||(MStore.db.reads[myUid()]={});MStore.act('policy.acknowledge',id,{},function(){r['ack-'+id]=1;});toast('Policy acknowledged');back('#/policies');};

/* ── Payslips ── */
function payLabel(ym){return MFmt.MONTH[+ym.slice(5,7)-1]+' '+ym.slice(0,4);}
function payReleased(ym){const y=+ym.slice(0,4),m=+ym.slice(5,7);const d=new Date(y,m,0);while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()-1);return MFmt.isoOf(d);}
route('/payslips',function(){const ps=(myHR().payslips||[]).slice().sort();
  if(!ps.length)return {title:'Payslips',up:'#/more',tab:'more',html:emptyHTML('file','No payslips yet','Your first payslip appears here after your first salary is paid.')};
  const last=ps[ps.length-1],yr=M.state.psYear||+last.slice(0,4);const years=Array.from(new Set(ps.map(function(x){return +x.slice(0,4);})));
  const grid=MFmt.MON.map(function(n,i){const ym=yr+'-'+String(i+1).padStart(2,'0');const has=ps.indexOf(ym)>=0;return '<button class="'+(has?'':'na')+'"'+(has?' data-go="#/payslips/'+ym+'"':'')+'>'+n+'</button>';}).join('');
  const html='<div class="card"><div class="card-h"><span><span class="lbl">Latest payslip</span><div class="b" style="font-size:17px">'+payLabel(last)+'</div></span>'+badge('Paid','ok')+'</div><div class="meta">Released '+E(MFmt.date(payReleased(last)))+'</div><div class="btns" style="margin-top:12px"><button class="btn" data-go="#/payslips/'+last+'">View</button><button class="btn sec" data-act="psDownload" data-ym="'+last+'">Download</button></div></div>'
   +'<div class="card" style="margin-top:12px"><div class="cal-h"><span class="card-t">All payslips</span>'+(years.length>1?select('ps-year',years,yr):'<span class="pill" style="height:34px">'+yr+'</span>')+'</div><div class="mgrid">'+grid+'</div></div>'
   +'<div class="card" style="margin-top:12px"><div class="card-t" style="margin-bottom:4px">Tax documents</div>'+rowHTML({icon:'file',t:'Form 16 · FY 2026–27',s:'Available after the year ends, by June 2027',r:badge('Not yet','mut')})+'</div>'
   +'<div class="cap" style="text-align:center;margin-top:14px">Salary figures are not shown in the app. Open a payslip to see the details.</div>';
  return {title:'Payslips',up:'#/more',tab:'more',html:html};});
M.acts.psDownload=function(el){toast('Payslip for '+payLabel(el.getAttribute('data-ym'))+' downloaded');};
route('/payslips/:ym',function(pr){const ym=pr.ym;if((myHR().payslips||[]).indexOf(ym)<0)return null;const p=me();
  const html='<div class="pdf">'+ic('file',36)+'<div class="b" style="color:var(--ink)">Payslip · '+payLabel(ym)+'</div><div class="cap">'+E(p.name)+' · '+E(p.empId)+' · '+E(MStore.db.entity.name)+'</div><div class="cap">PDF · 2 pages</div></div>'
   +'<div class="card" style="margin-top:12px">'+kv('Period','1 – '+new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate()+' '+payLabel(ym))+kv('Released',E(MFmt.date(payReleased(ym))))+kv('Payment status',badge('Paid','ok'))+kv('Paid to',E((myHR().bank||{}).name||'')+' •••• '+E((myHR().bank||{}).acc||''))+'</div>';
  return {title:payLabel(ym),up:'#/payslips',tab:'more',html:html,foot:'<div class="btns"><button class="btn" data-act="psDownload" data-ym="'+ym+'">Download</button><button class="btn sec" data-act="later" data-m="Reporting a payslip issue">Report an issue</button></div>'};});
route('/payslips/:ym/report',function(pr){const ym=pr.ym,sel=M.state.psReason||'';const rs=['Salary amount is wrong','Deduction is wrong','Leave or attendance not counted','Bank or payment problem','Something else'];
  const html='<div class="card" style="display:flex;gap:12px;align-items:center"><span class="ico">'+ic('file')+'</span><div class="row-m"><div class="b">Payslip · '+payLabel(ym)+'</div><div class="cap">Released '+E(MFmt.date(payReleased(ym)))+'</div></div>'+badge('Paid','ok')+'</div>'
   +'<div class="card" style="margin-top:12px"><div class="lbl">What is wrong? <span class="req">*</span></div>'+rs.map(function(r){return '<div class="radio'+(sel===r?' on':'')+'" data-act="psReason" data-r="'+E(r)+'"><i></i>'+E(r)+'</div>';}).join('')
   +field('Add details',textarea('ps-det','','Explain the problem'),{req:true})+'<div class="fg"><span class="lbl">Attachment (optional)</span><label class="drop dash" style="margin-top:6px;position:relative">'+ic('upload',22)+'<span class="b" style="font-size:14px" id="ps-fn">Add a file</span><span class="cap">JPG, PNG or PDF · up to 10 MB</span><input type="file" id="ps-file" accept="image/*,application/pdf" style="position:absolute;inset:0;opacity:0"></label></div>'
   +'<div class="help" style="margin-top:12px">This creates a support ticket. Payroll replies within 2 working days.</div></div>';
  return {title:'Report an issue',up:'#/payslips/'+ym,html:html,foot:'<div class="btns"><button class="btn" data-act="psSubmit" data-ym="'+ym+'">Submit issue</button><button class="btn sec" data-back="#/payslips/'+ym+'">Cancel</button></div>',
    after:function(){const f=document.getElementById('ps-file');f.addEventListener('change',function(){if(f.files[0])document.getElementById('ps-fn').textContent=f.files[0].name;});}};});
M.acts.psReason=function(el){const det=val('ps-det');M.state.psReason=el.getAttribute('data-r');render();document.getElementById('ps-det').value=det;};
M.acts.psSubmit=function(el){const ym=el.getAttribute('data-ym'),r=M.state.psReason,d=val('ps-det');if(!r){toast('Choose what is wrong');return;}if(d.length<10){markErr('ps-det',true);toast('Add a few more details');return;}
  const t=newTicket('Payslip '+payLabel(ym)+': '+r,'Payroll',d);M.state.psReason='';toast(t.id+' created · Payroll replies within 2 working days');back('#/payslips/'+ym);};

/* ── Assets ── */
route('/assets',function(){const a=myHR().assets||[];
  if(!a.length)return {title:'My assets',up:'#/more',tab:'more',html:emptyHTML('laptop','No assets assigned','Laptops, phones and cards given to you will appear here.')};
  const html='<div class="sec-h" style="margin-top:4px">Assigned to you · '+a.length+' item'+(a.length>1?'s':'')+'</div><div class="card p0">'+a.map(function(x){return rowHTML({icon:x.i,t:E(x.n),s:E(x.id)+' · '+E(x.t),r:'<span class="cap">'+E(MFmt.date(x.d))+'</span>'});}).join('')+'</div>'
   +'<div class="callout info" style="margin-top:12px">Something wrong with an asset? Raise a ticket from <button class="link" data-go="#/support">Support tickets</button>.</div>';
  return {title:'My assets',up:'#/more',tab:'more',html:html};});

/* ── Support tickets ── */
function newTicket(t,c,m){const h=myHR();h.tickets=h.tickets||[];const rec={id:'TKT-'+MStore.next('TKT'),t:t,c:c,s:'Open',d:TODAY(),m:m,origin:'mobile',cid:MStore.cid()};MStore.act('ticket.create',rec.id,rec,function(){h.tickets.unshift(rec);});return rec;}
route('/support',function(){const t=myHR().tickets||[];
  const html='<button class="btn" data-act="later" data-m="Raising a support ticket">New ticket</button>'+(t.length?'<div class="card p0" style="margin-top:12px">'+t.map(function(x){return '<div class="row tap" data-act="tktInfo" data-id="'+x.id+'"><span class="ico">'+ic('ticket')+'</span><div class="row-m"><div class="row-t">'+E(x.t)+'</div><div class="row-s">'+E(x.id)+' · '+E(x.c)+' · '+E(MFmt.date(x.d))+'</div></div>'+badge(x.s,x.s==='Open'?'warn':'ok')+'</div>';}).join('')+'</div>':'<div style="margin-top:12px">'+emptyHTML('ticket','No tickets yet','Ask HR, Finance, Payroll or IT for help. Your tickets and replies appear here.')+'</div>');
  return {title:'Support tickets',up:'#/more',tab:'more',html:html};});
M.acts.tktInfo=function(el){const x=(myHR().tickets||[]).find(function(q){return q.id===el.getAttribute('data-id');});if(!x)return;sheet(x.id,'<div class="b" style="margin-bottom:8px">'+E(x.t)+'</div>'+kv('Team',E(x.c))+kv('Raised',E(MFmt.date(x.d)))+kv('Status',badge(x.s,x.s==='Open'?'warn':'ok'))+'<div class="callout info">'+E(x.m)+'</div>');};
route('/support/new',function(){const html='<div class="card">'+field('Team',select('tk-c',['HR','Finance','Payroll','IT','Admin'],'Finance'),{req:true})+field('Subject',input('tk-t','',{ph:'What do you need help with?'}),{req:true})+field('Details',textarea('tk-m','','Describe the problem'),{req:true})+'</div>';
  return {title:'New ticket',up:'#/support',html:html,foot:'<div class="btns"><button class="btn" data-act="tkSave">Submit ticket</button><button class="btn sec" data-back="#/support">Cancel</button></div>'};});
M.acts.tkSave=function(){const t=val('tk-t'),m=val('tk-m');markErr('tk-t',!t);markErr('tk-m',m.length<10);if(!t||m.length<10){toast('Add a subject and some details');return;}const r=newTicket(t,val('tk-c'),m);toast(r.id+' created');back('#/support');};

/* ── Notifications ── */
function hrNotices(){const out=[],p=me();if(!p)return out;
  MStore.db.hr.announcements.slice(0,2).forEach(function(a){out.push({id:a.id,icon:'mega',t:a.title,s:a.src+' · '+a.by,when:a.when,go:'#/announcements/'+a.id});});
  MStore.db.hr.policies.filter(policyNeeds).forEach(function(x){out.push({id:'pol-'+x.id,icon:'shield',t:'Acknowledge the '+x.name.toLowerCase(),s:'Updated '+x.ver.split('·')[1].trim(),when:'2026-11-01',go:'#/policies/'+x.id});});
  const d=P.hr(p).docs||{req:[],up:[]};d.up.filter(function(x){return x.s==='Re-upload';}).forEach(function(x){out.push({id:'doc-'+x.n,icon:'file',t:'Re-upload your '+x.n.toLowerCase(),s:x.note||'',when:'2026-11-06',go:'#/profile/documents'});});
  d.req.forEach(function(x){out.push({id:'req-'+x.n,icon:'file',t:'HR requested '+x.n,s:'Due '+MFmt.date(x.due),when:'2026-11-03',go:'#/profile/documents'});});
  const ps=(P.hr(p).payslips||[]).slice().sort().pop();if(ps)out.push({id:'ps-'+ps,icon:'file',t:'Payslip for '+payLabel(ps)+' is ready',s:'Payroll',when:payReleased(ps),go:'#/payslips/'+ps});
  return out;}
route('/notifications',function(){const n=myNotices().sort(function(a,b){return cmpIso(b.when||'',a.when||'');}),rd=MStore.db.reads[myUid()]||{};
  const html=n.length?'<div class="card p0">'+n.map(function(x){return '<div class="ann tap" data-act="openNotice" data-id="'+E(x.id)+'" data-to="'+E(x.go)+'">'+(rd[x.id]?'<span style="width:8px"></span>':'<span class="unread"></span>')+'<span class="ico">'+ic(x.icon)+'</span><div class="row-m"><div class="b" style="font-size:14px;line-height:20px">'+E(x.t)+'</div><div class="meta">'+E(x.s)+'</div><div class="cap" style="margin-top:4px">'+E(MFmt.date(x.when))+'</div></div></div>';}).join('')+'</div>':emptyHTML('bell','You’re all caught up','New updates about your requests, approvals and HR appear here.');
  return {title:'Notifications',up:'#/home',tab:'home',html:html,right:n.some(function(x){return !rd[x.id];})?'<button class="link" style="padding:0 6px" data-act="readAll">Mark all read</button>':''};});
M.acts.openNotice=function(el){markRead(el.getAttribute('data-id'));go(el.getAttribute('data-to'));};
M.acts.readAll=function(){myNotices().forEach(function(n){markRead(n.id);});render();};

/* ── This release: only Expenses works. The other ADT modules are shown as designed; their actions are not available yet. ── */
function later(what){toast(what+' is available in a later release.');}
M.acts.later=function(el){later(el.getAttribute('data-m')||'This');};
M.acts.clockIn=function(){later('Attendance');};
M.acts.clockOut=function(){later('Attendance');};
M.acts.leaveCancel=function(){closeSheet();later('Cancelling leave');};
M.acts.psDownload=function(){later('Payslip download');};
