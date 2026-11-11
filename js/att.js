/* ══ Attachments: receipts and documents, kept on the phone ═════════════════════
   The file itself goes into the phone's file store (IndexedDB 'adt-files'); the claim keeps only a
   small link: {id, name, type, size, w, h, from, pages}. Everyone who opens the claim on this phone
   (the employee, their manager, Finance through Switch User) sees the same file.
   - Photos are kept as JPEG, at most 1600 px on the long side (sharp enough to read, small to store).
   - A PDF is turned into one image when it is attached (pages stacked, up to 4) and kept as that image.
   - Each new file is queued in the outbox ('attachment.add'), so a later sync can upload it.
   - The sample claims that came with the app link to images in att/ (MAtt.seed).
   MAtt.save(file, from) -> Promise<link>   MAtt.url(link) -> Promise<url>
   MAtt.thumbs(root) fills <img data-att-id>   MAtt.view(link, title) opens the in-app viewer. */
const MAtt=(function(){
  const DBN='adt-files',ST='files',MAX=1600,PDF_PAGES=4,PDF_W=1240;
  let dbp=null,pdfp=null;const urls={};
  function db(){if(dbp)return dbp;
    dbp=new Promise(function(res,rej){const q=indexedDB.open(DBN,1);q.onupgradeneeded=function(){q.result.createObjectStore(ST);};q.onsuccess=function(){res(q.result);};q.onerror=function(){dbp=null;rej(q.error);};});return dbp;}
  function put(id,blob){return db().then(function(d){return new Promise(function(res,rej){const t=d.transaction(ST,'readwrite');t.objectStore(ST).put(blob,id);t.oncomplete=function(){res();};t.onerror=function(){rej(t.error||new Error('Could not save the file on this phone.'));};});});}
  function get(id){return db().then(function(d){return new Promise(function(res,rej){const q=d.transaction(ST).objectStore(ST).get(id);q.onsuccess=function(){res(q.result||null);};q.onerror=function(){rej(q.error);};});});}
  function toJpeg(c,q){return new Promise(function(res,rej){c.toBlob(function(b){b?res(b):rej(new Error('Could not prepare the file.'));},'image/jpeg',q);});}
  function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);return c;}
  /* Photo -> JPEG, shrunk to MAX px on the long side. */
  function fromPhoto(file){return new Promise(function(res,rej){const u=URL.createObjectURL(file),img=new Image();
    img.onload=function(){const k=Math.min(1,MAX/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*k),h=Math.round(img.naturalHeight*k),c=canvas(w,h);
      c.getContext('2d').drawImage(img,0,0,w,h);URL.revokeObjectURL(u);toJpeg(c,0.85).then(function(b){res({blob:b,w:w,h:h});},rej);};
    img.onerror=function(){URL.revokeObjectURL(u);rej(new Error('This file could not be opened. Attach a photo or a PDF.'));};img.src=u;});}
  /* PDF -> one image: each page drawn by PDF.js (lib/pdfjs, loaded the first time a PDF is attached). */
  function pdfLib(){if(pdfp)return pdfp;const base=new URL('lib/pdfjs/',location.href).href;
    pdfp=import(base+'pdf.min.mjs').then(function(m){m.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';return {lib:m,wasm:base+'wasm/'};})
      .catch(function(){pdfp=null;throw new Error('Could not open the PDF reader. Check your connection and try again.');});return pdfp;}
  async function fromPdf(file){const P=await pdfLib();let doc,task;
    try{task=P.lib.getDocument({data:new Uint8Array(await file.arrayBuffer()),wasmUrl:P.wasm,isEvalSupported:false,enableXfa:false});doc=await task.promise;}
    catch(e){throw new Error(/password/i.test(e&&e.name||'')?'This PDF is password-protected. Remove the password and attach it again.':'This PDF could not be opened.');}
    const n=Math.min(doc.numPages,PDF_PAGES),pages=[];
    for(let p=1;p<=n;p++){const pg=await doc.getPage(p),v1=pg.getViewport({scale:1}),vp=pg.getViewport({scale:Math.min(3,PDF_W/v1.width)}),c=canvas(Math.round(vp.width),Math.round(vp.height));
      await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise;pages.push(c);}
    const total=doc.numPages;try{task.destroy();}catch(e){}
    const gap=n>1?16:0,W=Math.max.apply(null,pages.map(function(c){return c.width;})),H=pages.reduce(function(s,c){return s+c.height;},0)+gap*(n-1),out=canvas(W,H),g=out.getContext('2d');
    if(gap){g.fillStyle='#D1D5DB';g.fillRect(0,0,W,H);}
    let y=0;pages.forEach(function(c){g.drawImage(c,Math.round((W-c.width)/2),y);y+=c.height+gap;});
    return {blob:await toJpeg(out,0.85),w:W,h:H,pages:total,shown:n};}
  async function save(file,from){
    if(!file)throw new Error('No file was picked.');
    if(file.size>10*1048576)throw new Error('The file is larger than 10 MB. Attach a smaller one.');
    const pdf=/pdf$/i.test(file.type||'')||/\.pdf$/i.test(file.name||'');
    const r=pdf?await fromPdf(file):await fromPhoto(file);
    const id='ATT-'+MStore.cid()+'-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    await put(id,r.blob);
    const link={id:id,name:file.name&&!/^image\.\w+$/i.test(file.name)?file.name:'receipt-'+String(Date.now()).slice(-6)+'.jpg',type:'image/jpeg',size:r.blob.size,w:r.w,h:r.h,from:pdf?'pdf':(from||'photo'),at:new Date().toISOString()};
    if(pdf){link.pages=r.pages;link.shown=r.shown;}
    MStore.act('attachment.add',id,{name:link.name,size:link.size,from:link.from,pages:link.pages||1});
    try{if(navigator.storage&&navigator.storage.persist)navigator.storage.persist().catch(function(){});}catch(e){}
    return link;}
  /* A link -> something an <img> can show. */
  function url(link){if(!link)return Promise.resolve(null);if(link.src)return Promise.resolve(link.src);if(urls[link.id])return Promise.resolve(urls[link.id]);
    return get(link.id).then(function(b){if(!b)return null;urls[link.id]=URL.createObjectURL(b);return urls[link.id];});}
  /* Fill every <img data-att-id> under root (thumbnails are drawn before the file is read). */
  function thumbs(root){(root||document).querySelectorAll('img[data-att-id]').forEach(function(img){const id=img.getAttribute('data-att-id');
    url({id:id}).then(function(u){if(u)img.src=u;else{const t=img.closest('.att');if(t)t.classList.add('gone');}}).catch(function(){});});}
  /* Sample claims that came with the app: their receipts are images in att/. */
  const SEED={'EXP-310#1':'EXP-310-1','EXP-309#1':'EXP-309-1','EXP-308#1':'EXP-308-1','EXP-308#2':'EXP-308-2','EXP-308#3':'EXP-308-3','EXP-307#1':'EXP-307-1','EXP-307#2':'EXP-307-2','EXP-306#1':'EXP-306-1','EXP-305#1':'EXP-305-1','ADV-1005#doc':'ADV-1005-doc'};
  function seed(ref,key,name){const f=SEED[ref+'#'+key];return f?{src:'att/'+f+'.jpg',name:name||f+'.jpg',type:'image/jpeg',from:'sample'}:null;}
  /* Full-screen viewer inside the app: pinch or double-tap to zoom, drag to move, X to close. */
  function view(link,title){if(!link)return;
    const w=document.createElement('div');w.className='viewer';
    w.innerHTML='<div class="viewer-bar"><div class="viewer-t"><div class="b">'+esc(title||'Attachment')+'</div><div class="cap">'+esc(link.name||'')+(link.from==='pdf'?' · '+(link.pages>1?link.pages+' pages':'1 page')+(link.pages>(link.shown||link.pages)?', first '+link.shown+' shown':''):'')+'</div></div><button class="ib" data-close aria-label="Close">'+(typeof ic==='function'?ic('x',22):'×')+'</button></div>'
      +'<div class="viewer-body"><div class="spin dark viewer-spin"></div><img alt="'+esc(link.name||'Attachment')+'"></div><div class="viewer-hint">Pinch or double-tap to zoom</div>';
    document.body.appendChild(w);document.body.style.overflow='hidden';
    const body=w.querySelector('.viewer-body'),img=w.querySelector('img');let z=1;
    function close(){w.remove();document.body.style.overflow='';window.removeEventListener('keydown',key);}
    function key(e){if(e.key==='Escape')close();}
    w.querySelector('[data-close]').onclick=close;window.addEventListener('keydown',key);
    function zoom(nz,cx,cy){nz=Math.max(1,Math.min(5,nz));if(nz===z)return;const r=body.getBoundingClientRect(),px=(cx==null?r.width/2:cx-r.left),py=(cy==null?r.height/2:cy-r.top);
      const fx=(body.scrollLeft+px)/(img.offsetWidth||1),fy=(body.scrollTop+py)/(img.offsetHeight||1);z=nz;img.style.width=(z*100)+'%';w.classList.toggle('zoomed',z>1);
      body.scrollLeft=fx*img.offsetWidth-px;body.scrollTop=fy*img.offsetHeight-py;}
    let lastTap=0;body.addEventListener('click',function(e){const t=Date.now();if(t-lastTap<320){zoom(z>1?1:2.5,e.clientX,e.clientY);lastTap=0;}else lastTap=t;});
    let pinch=null;
    body.addEventListener('touchstart',function(e){if(e.touches.length===2){const a=e.touches[0],b=e.touches[1];pinch={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),z:z,cx:(a.clientX+b.clientX)/2,cy:(a.clientY+b.clientY)/2};}},{passive:true});
    body.addEventListener('touchmove',function(e){if(pinch&&e.touches.length===2){e.preventDefault();const a=e.touches[0],b=e.touches[1];zoom(pinch.z*Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)/pinch.d,pinch.cx,pinch.cy);}},{passive:false});
    body.addEventListener('touchend',function(e){if(e.touches.length<2)pinch=null;});
    url(link).then(function(u){const s=w.querySelector('.viewer-spin');if(s)s.remove();if(!u){body.innerHTML='<div class="viewer-miss">This file is not stored on this phone.</div>';return;}img.src=u;})
      .catch(function(){body.innerHTML='<div class="viewer-miss">This file could not be opened.</div>';});
    return w;}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  return {save:save,url:url,thumbs:thumbs,seed:seed,view:view};
})();
