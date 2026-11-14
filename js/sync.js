/* ══ MSync: the phone ↔ web sync (product owner, 14 Nov 2026) ═════════════════════════════════════════════════════
   Through the Supabase project in js/sync-config.js. Off (and the app exactly as before) while that file is empty.

   The web app is the one engine; the phone never decides a request's outcome itself:
   - What the phone does to a request - submit a claim or an advance, approve / reject / send back, withdraw, respond
     to a Follow-Up, record an advance return - is sent to the web app as a command. The web app files it through
     its own rules as this person and answers: the web number, or why it was not accepted.
   - The phone reads what the web app publishes: Nova Retail's claims and advances (the web's status words and
     Pending At), the people, the Sub Category / Expense Type / Advance Type lists, the wallet balances.
   - Receipts and documents are uploaded to the project's file store; the web app opens them from there.
   - No connection: everything waits on the phone (db.sync.out) and goes once the phone is back online.
   Records keep the web app's IDs and field names, so the same request is the same record on both. */
const MSync=(function(){
  const CFG=window.M_SYNC_CONFIG||{};
  const ON=!!(CFG.url&&CFG.key);
  const BASE=String(CFG.url||'').replace(/\/+$/,''),KEY=CFG.key||'',BUCKET='ems-files';
  const enc=encodeURIComponent;
  let running=false,wait=0;
  function S(){const db=MStore.db;if(!db.sync)db.sync={cursor:'',live:false,out:[],pend:{}};const s=db.sync;s.out=s.out||[];s.pend=s.pend||{};return s;}
  function rest(method,path,body,prefer){
    const h={apikey:KEY,'Content-Type':'application/json'};if(prefer)h.Prefer=prefer;
    return fetch(BASE+'/rest/v1/'+path,{method:method,headers:h,body:body!=null?JSON.stringify(body):undefined,cache:'no-store'})
      .then(function(r){return r.text().then(function(t){
        if(!r.ok){const e=new Error(r.status+' '+String(t||'').slice(0,200));e.status=r.status;e.body=t;throw e;}
        return t?JSON.parse(t):null;});});
  }
  /* A file to the shared store; an object already there (a retry) counts as uploaded. */
  async function upload(blob,path){
    const url=BASE+'/storage/v1/object/'+BUCKET+'/'+path;
    const go=function(bearer){const h={apikey:KEY,'Content-Type':blob.type||'image/jpeg'};if(bearer)h.Authorization='Bearer '+KEY;return fetch(url,{method:'POST',headers:h,body:blob});};
    const there=function(r,t){return r.status===409||/duplicate|already exists/i.test(t||'');};
    let r=await go(false),t=r.ok?'':await r.text().catch(function(){return '';});
    if(!r.ok&&!there(r,t)&&[400,401,403].indexOf(r.status)>=0){const r2=await go(true);const t2=r2.ok?'':await r2.text().catch(function(){return '';});if(r2.ok||there(r2,t2)){r=r2;t='';}}
    if(!r.ok&&!there(r,t))throw new Error('upload '+r.status+' '+String(t).slice(0,120));
    return BASE+'/storage/v1/object/public/'+BUCKET+'/'+path;
  }
  const ms=function(ts){return Date.parse(String(ts||'').replace(/(\.\d{3})\d+/,'$1'))||0;};

  /* ── Sending ── */
  /* type, payload, {cid, ref, files:[{att|src, path, line}]} → the command waits in db.sync.out until it is sent. */
  function send(type,payload,o){
    o=o||{};const s=S(),cid=o.cid||MStore.cid();
    s.out.push({cid:cid,type:type,payload:payload,by:myUid(),at:new Date().toISOString(),sent:false,files:o.files||[]});
    s.pend[cid]={type:type,wid:payload.wid||'',ref:o.ref||'',at:Date.now()};
    MStore.save(true);kick();
    return cid;
  }
  function putUrl(it,f){
    if(f.line==='doc')it.payload.proofUrl=f.url;
    else if(it.payload.lines&&it.payload.lines[f.line])it.payload.lines[f.line].proofUrl=f.url;
  }
  async function blobOf(f){
    if(f.att){const b=await MAtt.blob(f.att);if(b)return b;}
    if(f.src){const r=await fetch(f.src);if(r.ok)return await r.blob();}
    return null;
  }
  async function flush(){
    const s=S();
    for(const it of s.out){
      if(it.sent)continue;
      for(const f of (it.files||[])){
        if(f.url||f.gone)continue;
        if(f.src&&/^https?:/.test(f.src)&&f.src.indexOf(BASE)===0){f.url=f.src;putUrl(it,f);continue;}
        const b=await blobOf(f);
        if(!b){f.gone=true;continue;}   // the file is no longer on this phone: the request still goes, with the file's name
        f.url=await upload(b,f.path);putUrl(it,f);MStore.save(true);
      }
      try{await rest('POST','ems_commands',{id:it.cid,type:it.type,payload:it.payload,by_uid:it.by},'return=minimal');}
      catch(e){if(!(e.status===409||/duplicate key/i.test(e.body||'')))throw e;}
      it.sent=true;MStore.save(true);
    }
  }

  /* ── Reading what the web app published ── */
  function people(d){
    const db=MStore.db;
    if(d.people&&d.people.length)db.people=d.people;
    if(d.users&&Object.keys(d.users).length)db.users=d.users;
  }
  function wallets(d){
    const db=MStore.db;db.wallets=db.wallets||{};db.wallets[d.eid]=d;
    db.cards.filter(function(c){return c.employeeEid===d.eid;}).forEach(function(c){
      const wc=(d.cards||[]).find(function(x){return x.id===c.id;})||(d.cards||[])[0];if(!wc)return;
      c.wallets=wc.wallets.map(function(code){
        const old=(c.wallets||[]).find(function(w){return w.code===code;})||{},x=(d.wallets||{})[code]||{};
        return Object.assign({},old,{code:code,name:x.name||old.name||code,balance:x.available||0,loads:x.loaded||0,spent:x.spent||0,credits:x.refunded||0});
      });
    });
  }
  const goTo={};
  function record(d){
    const db=MStore.db,coll=d.kind==='advance'?db.advances:db.expenses;
    [db.expenses,db.advances].forEach(function(c){
      for(let i=c.length-1;i>=0;i--){
        const r=c[i];
        if(r.wid===d.wid&&r!==d){c.splice(i,1);continue;}
        /* the request this phone sent, waiting for its number */
        if(d.syncCid&&r.sendState&&r.cid===d.syncCid){goTo[r.ref]=d.ref;c.splice(i,1);continue;}
        if(r.synced||r.sendState||r.ref!==d.ref)continue;
        /* a draft made on this phone under the same number: renamed, nothing lost */
        if(r.origin==='mobile'&&r.status==='Draft'){r.ref='DRF-'+(r.key||i);continue;}
        /* the copy this phone came with (before the sync): the web app's record replaces it */
        c.splice(i,1);
      }
    });
    coll.unshift(d);
  }
  function index(ids){
    const s=S(),db=MStore.db,keep={};ids.forEach(function(k){keep[k]=1;});
    [db.expenses,db.advances].forEach(function(c){
      for(let i=c.length-1;i>=0;i--){
        const r=c[i];
        if(r.synced){if(!keep[r.wid])c.splice(i,1);continue;}
        if(r.sendState||(r.origin==='mobile'&&r.status==='Draft'))continue;   // on its way, or a draft made on this phone
        c.splice(i,1);   // this phone's own earlier copy: the web app's records replace it
      }
    });
    s.live=true;
  }
  function rows(list){
    let idx=null,changed=false;
    list.forEach(function(row){
      const id=row.id,d=row.data;if(!d)return;changed=true;
      if(id==='meta:people')people(d);
      else if(id==='meta:lists')MStore.db.lists=d;
      else if(id==='meta:index')idx=d.ids||[];
      else if(/^wallets:/.test(id))wallets(d);
      else if(/^(exp|adv):/.test(id))record(d);
    });
    if(idx)index(idx);
    return changed;
  }
  async function pull(){
    const s=S();
    const since=s.cursor?'&updated_at=gt.'+enc(new Date(ms(s.cursor)-5000).toISOString()):'';
    const list=await rest('GET','ems_records?select=id,kind,data,updated_at&order=updated_at.asc&limit=1000'+since)||[];
    let changed=false;
    if(list.length){changed=rows(list);s.cursor=list[list.length-1].updated_at;}
    /* answers to what this phone sent */
    const ids=s.out.filter(function(x){return x.sent&&!x.fin;}).map(function(x){return x.cid;});
    if(ids.length){
      const res=await rest('GET','ems_commands?select=id,status,result&id=in.'+enc('('+ids.map(function(i){return '"'+i+'"';}).join(',')+')'))||[];
      res.forEach(function(c){
        if(c.status!=='done'&&c.status!=='failed')return;
        const it=s.out.find(function(x){return x.cid===c.id;});if(!it||it.fin)return;
        it.fin=Date.now();it.result=c.result||{};const p=s.pend[c.id]||{};delete s.pend[c.id];changed=true;
        answered(it,c.status==='done'&&it.result.ok!==false,p);
      });
      s.out=s.out.filter(function(x){return !x.fin||Date.now()-x.fin<86400000;});
    }
    return changed;
  }
  function answered(it,okd,p){
    const res=it.result||{},db=MStore.db;
    if(it.type==='claim.submit'||it.type==='advance.submit'){
      const r=db.expenses.concat(db.advances).find(function(x){return x.sendState&&x.cid===it.cid;});
      if(okd){if(r){r.sendState='sent';goTo[r.ref]=res.ref;}say(res.ref+' submitted');}
      else{if(r){r.sendState='failed';r.sendError=res.error||'Not accepted by the web app.';}say('Not submitted: '+(res.error||'not accepted by the web app'));}
      return;
    }
    if(!okd)say((p.ref?p.ref+': ':'')+(res.error||'Not recorded by the web app.'));
  }
  function say(t){if(typeof toast==='function'&&document.visibilityState==='visible')toast(t);}

  /* ── The loop ── */
  function safe(){return !/^#\/(expenses\/new|t\/[^\/]+\/dispute|kyc)/.test(location.hash||'')&&!document.getElementById('sheet')&&!document.querySelector('.viewer');}
  async function cycle(){
    if(!ON||running||!MStore.db)return;
    if(navigator.onLine===false||document.visibilityState==='hidden')return;
    if(wait&&Date.now()<wait)return;
    running=true;
    let changed=false;
    try{
      await flush();
      changed=await pull();
      wait=0;
    }catch(e){wait=Date.now()+15000;if(window.console)console.warn('[sync] will try again shortly:',e&&e.message||e);}
    finally{running=false;}
    if(changed){
      MStore.save(true);
      const h=(location.hash||'').replace(/^#\/r\//,'');
      if(/^#\/r\//.test(location.hash||'')&&goTo[decodeURIComponent(h)]&&MStore.db.expenses.concat(MStore.db.advances).some(function(r){return r.ref===goTo[decodeURIComponent(h)];})){
        const to=goTo[decodeURIComponent(h)];if(safe()&&typeof replaceTo==='function'){replaceTo('#/r/'+to);return;}
      }
      if(safe()&&typeof render==='function'&&typeof me==='function'&&me())render();
    }
  }
  let t=null;
  function kick(){if(!ON)return;clearTimeout(t);t=setTimeout(cycle,50);}
  function start(){
    if(!ON)return;
    setInterval(cycle,5000);
    window.addEventListener('online',kick);
    document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')kick();});
    kick();
  }
  document.addEventListener('DOMContentLoaded',function(){setTimeout(start,0);});
  return {
    on:ON,
    send:send,
    kick:kick,
    /* the command still on its way for this web record, if any */
    pendingFor:function(wid){if(!ON||!wid||!MStore.db.sync)return null;const p=MStore.db.sync.pend||{};const k=Object.keys(p).find(function(c){return p[c].wid===wid;});return k?p[k]:null;},
    live:function(){return ON&&!!(MStore.db.sync&&MStore.db.sync.live);}
  };
})();
