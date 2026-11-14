/* ══ MStore: the mobile app's one data layer ════════════════════════════════
   Screens read and write only through MStore - never M_SEED directly.

   Today: a copy of the prepared Nova Retail data (data.js + hr-data.js), kept
   in this phone's browser (localStorage), so a refresh or reopening the app
   keeps what was done on the phone.

   Integration with the web app later: every change is also queued in
   db.outbox as {cid, type, ref, payload, by, at}. A sync adapter can send the
   outbox to the shared ADT store / API and replace load() with a read from it.
   Records keep the web app's IDs and field names (expensesData, advancesData,
   ccCards, ccTxns, ccLoads, ccDisputes), and records made here carry
   origin:'mobile' and a client id (cid), so the web app can match them. */
const MStore=(function(){
  const KEY='adt-mobile-nova';
  let db=null;
  const subs=[];
  const clone=function(o){return JSON.parse(JSON.stringify(o));};
  const maxKey=function(arr){return arr.reduce(function(m,r){return Math.max(m,+r.key||0);},0);};
  function fresh(){
    const s=clone(window.M_SEED);
    s.hr=clone(window.M_HR);
    s.outbox=[];s.notes=[];s.reads={};s.session={};
    s.seq={EXP:maxKey(s.expenses)+1,ADV:maxKey(s.advances)+1,DSP:1002,LV:5001,TKT:3001};
    return s;
  }
  function load(){
    try{const x=JSON.parse(localStorage.getItem(KEY)||'null');if(x&&x.version===window.M_SEED.version&&x.hrVersion===window.M_HR.version)db=x;}catch(e){db=null;}
    if(!db){db=fresh();db.hrVersion=window.M_HR.version;save(true);}
    /* The company is Opendhi and its card OpenDhi x RBL (product owner, 14 Nov 2026): a copy kept on this phone from
       before is renamed in place (the company and the people records), so nothing done on the phone is lost. */
    try{['hr','entity'].forEach(function(k){
      const t=JSON.stringify(db[k]||{});if(!/Nova Retail|Nova card/.test(t))return;
      db[k]=JSON.parse(t.replace(/Nova Retail Pvt Ltd|Nova Retail/g,'Opendhi').replace(/\bNova card\b/g,'OpenDhi x RBL card'));save(true);
    });}catch(e){}
  }
  function save(quiet){try{localStorage.setItem(KEY,JSON.stringify(db));}catch(e){}if(!quiet)subs.forEach(function(f){try{f();}catch(e){}});}
  function cid(){return 'm-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7);}
  function nowParts(){const d=new Date();const t=d.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true}).toUpperCase();return {date:MFmt.date(db.today),time:t};}
  /* One change: applied to the copy, queued for the web app, saved. */
  function act(type,ref,payload,apply){
    const by=db.session.userId||'';
    const r=apply?apply():null;
    db.outbox.push({cid:cid(),type:type,ref:ref||'',payload:payload||{},by:by,at:new Date().toISOString()});
    save();
    return r;
  }
  return {
    load:load,
    get db(){return db;},
    on:function(f){subs.push(f);},
    act:act,
    /* keep the copy (the sync, js/sync.js, after it brings the web app's records) */
    save:save,
    cid:cid,
    now:nowParts,
    next:function(prefix){const n=db.seq[prefix]++;return n;},
    reset:function(){const s=db.session;db=fresh();db.hrVersion=window.M_HR.version;db.session=s;save();},
    signIn:function(userId){db.session={userId:userId,at:new Date().toISOString()};save(true);},
    signOut:function(){db.session={};save(true);}
  };
})();

/* ── Formatting ── */
const MFmt={
  MON:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  MONTH:['January','February','March','April','May','June','July','August','September','October','November','December'],
  DAY:['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],
  iso:function(s){if(!s)return null;if(/^\d{4}-\d{2}-\d{2}/.test(s))return new Date(s.slice(0,10)+'T00:00:00');const d=new Date(s);return isNaN(d)?null:d;},
  date:function(s){const d=MFmt.iso(s);return d?d.getDate()+' '+MFmt.MON[d.getMonth()]+' '+d.getFullYear():(s||'');},
  dshort:function(s){const d=MFmt.iso(s);return d?d.getDate()+' '+MFmt.MON[d.getMonth()]:(s||'');},
  money:function(n,cur){n=Number(n)||0;const neg=n<0;n=Math.abs(n);const s=n.toLocaleString('en-IN',{maximumFractionDigits:2});return (neg?'−':'')+(cur&&cur!=='INR'?cur+' ':'₹')+s;},
  esc:function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});},
  initials:function(n){return String(n||'').split(/\s+/).filter(Boolean).slice(0,2).map(function(x){return x[0];}).join('').toUpperCase();},
  isoOf:function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
};
