/* ADT Employee mobile app - the core: icons, people, routing, layout, sheets, messages, profile picker. */
const E=MFmt.esc,money=MFmt.money;
const M={routes:[],acts:{},state:{}};

/* ── Icons (24px, 1.75 stroke) ── */
const IP={
  home:'<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cal:'<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  dots:'<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  bell:'<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',chev:'<path d="M9 5l7 7-7 7"/>',down:'<path d="M6 9l6 6 6-6"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  laptop:'<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  monitor:'<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
  phone:'<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  headset:'<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
  id:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.4 1.7-2 3-2s2.4.6 3 2M14 10h4M14 13h3"/>',
  file:'<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  shield:'<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
  out:'<path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  card:'<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  wallet:'<path d="M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a2 2 0 0 1 2-2h11"/><circle cx="16" cy="13.5" r="1.3" fill="currentColor" stroke="none"/>',
  gift:'<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5-3.5-5-1.5S10 8 12 8zm0 0c1.5-3 5-3.5 5-1.5S14 8 12 8z"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',x:'<path d="M6 6l12 12M18 6 6 18"/>',plus:'<path d="M12 5v14M5 12h14"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  sort:'<path d="M4 7h10M4 12h7M4 17h4M17 6v12M14 15l3 3 3-3"/>',
  pin:'<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  user:'<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.3-3.6 4.1-5.2 7.5-5.2s6.2 1.6 7.5 5.2"/>',
  contact:'<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="2.6"/><path d="M8 17c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6"/>',
  bank:'<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',arrowR:'<path d="M5 12h14M13 6l6 6-6 6"/>',image:'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',clip:'<path d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l8.6-8.6a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.6a1.8 1.8 0 0 1-2.6-2.6l7.9-7.9"/>',camera:'<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  swap:'<path d="M7 4 3 8l4 4M3 8h13M17 12l4 4-4 4M21 16H8"/>',
  mega:'<path d="M4 10v4a1 1 0 0 0 1 1h2l5 4V5L7 9H5a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6"/>',
  ticket:'<path d="M4 7a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/>',
  approve:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  fuel:'<path d="M5 20V5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v15M3.5 20h12M14 9h2a1.5 1.5 0 0 1 1.5 1.5V16a1.5 1.5 0 0 0 3 0V8l-2.5-2.5M7.5 8h4"/>',
  meal:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M16 3c-2 1.5-2.5 4-2.5 6.5V13h2.5v8"/>',
  tel:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  corp:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M3 12h18"/>',
  lock:'<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  dispute:'<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/>',
  note:'<path d="M5 4h14v11l-5 5H5z"/><path d="M14 20v-5h5M8 9h8M8 12.5h5"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  adv:'<circle cx="12" cy="12" r="9"/><path d="M9 8.5h6M9 11.5h6M12.5 8.5c1.8 0 2.5 1.1 2.5 2.2s-.9 2.3-3 2.3H9.5l4.5 4.5"/>'
};
function ic(n,s){return '<svg width="'+(s||20)+'" height="'+(s||20)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">'+(IP[n]||IP.info)+'</svg>';}

/* ── People ── */
const P={
  all:function(){return MStore.db.people;},
  byEid:function(eid){return MStore.db.people.find(function(p){return p.eid===eid;})||null;},
  userOf:function(p){if(!p)return '';const u=MStore.db.users;return Object.keys(u).find(function(k){return u[k]===p.name;})||'';},
  byUser:function(uid){const n=MStore.db.users[uid];return n?MStore.db.people.find(function(p){return p.name===n;})||{name:n}:null;},
  nameOfUser:function(uid){return MStore.db.users[uid]||(uid==='System'?'System':uid||'');},
  hr:function(p){return (MStore.db.hr.people[(p||{}).email]||{});},
  reports:function(p){return MStore.db.people.filter(function(x){return p&&x.managerEid===p.eid;});}
};
/* The people offered by the profile picker and Switch User: employees and approvers (user decision, 10 Nov 2026). */
const M_PROFILES=[
  ['kabir.joshi@novaretail.in','Employee'],
  ['arjun.rao@novaretail.in','Employee (Cardholder)'],
  ['ritu.sen@novaretail.in','Reporting Manager'],
  ['rohan.mehta@novaretail.in','Finance Admin'],
  ['ananya.iyer@novaretail.in','Card Approver'],
  ['neel.arora@novaretail.in','Card / Funding Verifier']
];
function me(){const uid=MStore.db.session.userId;return uid?P.byUser(uid):null;}
function myUid(){return MStore.db.session.userId||'';}
function myHR(){return P.hr(me());}
function firstName(p){return String((p||{}).name||'').split(' ')[0];}

/* ── Routing ── */
function route(pattern,fn){const keys=[];const rx=new RegExp('^'+pattern.replace(/:[a-z]+/gi,function(k){keys.push(k.slice(1));return '([^/]+)';})+'$');M.routes.push({rx:rx,keys:keys,fn:fn});}
/* In-app history: forward taps push, the back arrow and the phone's back gesture pop. */
M.stack=[];
function go(h){if(location.hash===h)render();else location.hash=h;}
function replaceTo(h){history.replaceState(null,'',h);M.stack[M.stack.length-1]=h;render();}
function back(fallback){if(M.stack.length>1)history.back();else replaceTo(fallback||'#/home');}
window.addEventListener('hashchange',function(){const h=location.hash;const s=M.stack;
  if(s.length>1&&s[s.length-2]===h)s.pop();else if(s[s.length-1]!==h)s.push(h);closeSheet();render();});

/* ── Layout ── */
function bar(t,o){o=o||{};
  if(o.home)return '<header class="bar home-bar"><div class="bar-in"><div class="bar-title">'+E(t)+'</div>'+bellBtn()+'<button class="ib" data-go="#/profile" aria-label="My profile"><span class="av">'+E(MFmt.initials(me().name))+'</span></button></div></header>';
  if(o.root)return '<header class="bar"><div class="bar-in" style="padding-left:16px"><div class="bar-title">'+E(t)+'</div>'+(o.right||'')+bellBtn()+'</div></header>';
  return '<header class="bar"><div class="bar-in"><button class="ib" data-back="'+E(o.up||'#/home')+'" aria-label="Back">'+ic('back',22)+'</button><div class="bar-title">'+E(t)+'</div>'+(o.right||'')+bellBtn()+(o.end||'')+'</div></header>';}
function bellBtn(){const n=unreadCount();return '<button class="ib" data-go="#/notifications" aria-label="Notifications">'+ic('bell',22)+(n?'<span class="dot"></span>':'')+'</button>';}
function nav(tab){const T=[['home','Home','home','#/home'],['attendance','Attendance','clock','#/attendance'],['leaves','Leaves','cal','#/leaves'],['more','More','dots','#/more']];
  return '<nav class="nav">'+T.map(function(t){return '<a href="'+t[3]+'" class="'+(tab===t[0]?'on':'')+'" data-tab="'+t[0]+'">'+ic(t[2],22)+'<span>'+t[1]+'</span></a>';}).join('')+'</nav>';}
function render(){
  const app=document.getElementById('app');
  if(!me()){app.innerHTML=pickerHTML();window.scrollTo(0,0);return;}
  const h=(location.hash||'#/home').slice(1)||'/home';
  let v=null;
  for(const r of M.routes){const m=h.match(r.rx);if(m){const prm={};r.keys.forEach(function(k,i){prm[k]=decodeURIComponent(m[i+1]);});v=r.fn(prm);break;}}
  if(!v){go('#/home');return;}
  const same=M.lastHash===h;M.lastHash=h;const y=window.scrollY;
  app.innerHTML=(v.home?bar(v.title,{home:true}):bar(v.title,{up:v.up,right:v.right,root:v.root,end:v.end}))
    +'<main class="page'+(v.foot?' no-nav':'')+'">'+v.html+'</main>'
    +(v.foot?'<div class="actbar">'+v.foot+'</div>':nav(v.tab||'more'));
  window.scrollTo(0,same?y:0);
  if(v.after)v.after();
}
/* One handler for every tap: data-go navigates, data-back goes back, data-act runs an action. */
document.addEventListener('click',function(e){
  const g=e.target.closest('[data-go]'),b=e.target.closest('[data-back]'),a=e.target.closest('[data-act]');
  /* the innermost target wins: a button inside a tappable row (e.g. a receipt on a card item) does its own action */
  const act=function(){e.preventDefault();const f=M.acts[a.getAttribute('data-act')];if(f)f(a,e);};
  if(a&&(!g||g.contains(a))&&(!b||b.contains(a))){act();return;}
  if(g){e.preventDefault();go(g.getAttribute('data-go'));return;}
  if(b){e.preventDefault();back(b.getAttribute('data-back'));return;}
  if(a){act();return;}
  if(e.target.classList&&e.target.classList.contains('scrim'))closeSheet();
});

/* ── Sheets, dialogs, messages ── */
function sheet(title,html,o){closeSheet();o=o||{};const w=document.createElement('div');w.className='scrim'+(o.dialog?' dialog-wrap':'');w.id='sheet';
  w.innerHTML=o.dialog?'<div class="dialog">'+html+'</div>':'<div class="sheet"><div class="grab"></div><div class="sheet-h"><div class="sheet-t">'+E(title)+'</div>'+(o.reset?'<button class="link" data-act="'+o.reset+'">Reset</button>':'<button class="ib" data-act="closeSheet" aria-label="Close">'+ic('x',20)+'</button>')+'</div>'+html+'</div>';
  document.body.appendChild(w);document.body.style.overflow='hidden';if(o.after)o.after(w);return w;}
function closeSheet(){const s=document.getElementById('sheet');if(s)s.remove();document.body.style.overflow='';}
M.acts.closeSheet=closeSheet;
function confirmBox(title,body,okLabel,onOk,danger){sheet('','<div class="b" style="font-size:17px;margin-bottom:6px">'+E(title)+'</div><div class="meta" style="margin-bottom:18px">'+E(body)+'</div><div class="btns"><button class="btn sec" data-act="closeSheet">Cancel</button><button class="btn'+(danger?' danger':'')+'" id="cb-ok">'+E(okLabel)+'</button></div>',{dialog:true,after:function(w){w.querySelector('#cb-ok').onclick=function(){closeSheet();onOk();};}});}
let toastT=null;
function toast(msg){let t=document.getElementById('toast');if(!t){t=document.createElement('div');t.id='toast';document.body.appendChild(t);}t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(function(){t.classList.remove('on');},2600);}

/* ── Small building blocks ── */
function badge(text,tone){return '<span class="bdg '+(tone||'mut')+'">'+E(text)+'</span>';}
function rowHTML(o){return '<div class="row'+(o.go?' tap':'')+'"'+(o.go?' data-go="'+E(o.go)+'"':'')+(o.act?' data-act="'+o.act+'"'+(o.data||''):'')+'>'+(o.icon?'<span class="ico">'+ic(o.icon)+'</span>':'')+'<div class="row-m"><div class="row-t">'+o.t+'</div>'+(o.s?'<div class="row-s">'+o.s+'</div>':'')+'</div>'+(o.r!=null?'<div class="row-r">'+o.r+'</div>':'')+(o.go&&o.chev!==false?'<span class="chev">'+ic('chev',18)+'</span>':'')+'</div>';}
function kv(k,v){return '<div class="kv"><span class="k">'+E(k)+'</span><span class="v">'+v+'</span></div>';}
function emptyHTML(icon,t,s,btn){return '<div class="card empty"><span class="ico">'+ic(icon,26)+'</span><div class="t">'+E(t)+'</div><div class="meta">'+E(s)+'</div>'+(btn||'')+'</div>';}
function field(label,inner,o){o=o||{};return '<div class="fg"><label class="lbl"'+(o.for?' for="'+o.for+'"':'')+'>'+E(label)+(o.req?' <span class="req">*</span>':'')+'</label>'+inner+(o.help?'<div class="help'+(o.err?' bad':'')+'"'+(o.hid?' id="'+o.hid+'"':'')+'>'+E(o.help)+'</div>':'')+'</div>';}
function input(id,val,o){o=o||{};return '<div class="inp'+(o.lock?' lock':'')+(o.auto?' auto':'')+'"><input id="'+id+'" type="'+(o.type||'text')+'" value="'+E(val||'')+'"'+(o.ph?' placeholder="'+E(o.ph)+'"':'')+(o.lock?' disabled':'')+(o.mode?' inputmode="'+o.mode+'"':'')+(o.min?' min="'+o.min+'"':'')+(o.max?' max="'+o.max+'"':'')+'>'+(o.suf?'<span class="suf">'+o.suf+'</span>':'')+'</div>';}
function select(id,opts,val,o){o=o||{};return '<div class="inp'+(o.lock?' lock':'')+(o.auto?' auto':'')+'"><select id="'+id+'"'+(o.lock?' disabled':'')+'>'+(o.ph?'<option value="">'+E(o.ph)+'</option>':'')+opts.map(function(x){const v=Array.isArray(x)?x[0]:x,l=Array.isArray(x)?x[1]:x;return '<option value="'+E(v)+'"'+(String(v)===String(val)?' selected':'')+'>'+E(l)+'</option>';}).join('')+'</select><span class="suf">'+ic('down',18)+'</span></div>';}
function textarea(id,val,ph){return '<div class="inp"><textarea id="'+id+'" rows="3"'+(ph?' placeholder="'+E(ph)+'"':'')+'>'+E(val||'')+'</textarea></div>';}
function val(id){const el=document.getElementById(id);return el?String(el.value||'').trim():'';}
function markErr(id,on){const el=document.getElementById(id);if(el&&el.closest('.inp'))el.closest('.inp').classList.toggle('err',!!on);}

/* ── Notifications (read state per person) ── */
function myNotices(){return (typeof expNotices==='function'?expNotices():[]).concat(hrNotices());}
function unreadCount(){const r=(MStore.db.reads[myUid()]||{});return myNotices().filter(function(n){return !r[n.id];}).length;}

/* ── Profile picker (sign-in) and Switch User ── */
function profileList(cur){return M_PROFILES.map(function(x){const p=MStore.db.people.find(function(q){return q.email===x[0];});if(!p)return '';const uid=P.userOf(p);
  return '<button class="who'+(uid===cur?' cur':'')+'" data-act="signIn" data-uid="'+uid+'"><span class="av">'+E(MFmt.initials(p.name))+'</span><span class="row-m"><span class="row-t" style="display:block">'+E(p.name)+'</span><span class="row-s" style="display:block">'+E(x[1])+' · '+E(p.jobTitle||'')+'</span></span>'+(uid===cur?badge('Signed in','ok'):'<span class="chev">'+ic('chev',18)+'</span>')+'</button>';}).join('');}
function pickerHTML(){return '<div class="pick"><div class="brand"><img src="icons/logo.png" alt="ADT"></div><h1>Welcome</h1><div class="meta" style="font-size:15px;line-height:21px">'+E(MStore.db.entity.name)+' · choose your profile to continue.</div><div style="margin-top:22px">'+profileList('')+'</div><div class="cap" style="text-align:center;margin-top:28px">ADT \u00b7 Employee v1.0</div></div>';}
M.acts.signIn=function(el){const uid=el.getAttribute('data-uid');const was=myUid();MStore.signIn(uid);closeSheet();M.state={};
  history.replaceState(null,'','#/home');M.stack=['#/home'];render();
  if(was&&was!==uid)toast('You are now '+P.nameOfUser(uid));};
M.acts.switchUser=function(){sheet('Switch user','<div class="meta" style="margin-bottom:4px">Pick who to use the app as. Everything you do is recorded under that person.</div>'+profileList(myUid()));};
M.acts.signOut=function(){confirmBox('Sign out?','You can sign in again as any profile.','Sign out',function(){MStore.signOut();M.state={};history.replaceState(null,'','#/home');M.stack=['#/home'];render();},true);};

/* ── Start ── */
function start(){MStore.load();if(!location.hash)history.replaceState(null,'','#/home');M.stack=[location.hash];render();}
document.addEventListener('DOMContentLoaded',start);
