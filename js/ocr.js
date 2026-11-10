/* ══ Receipt scanning: PaddleOCR (PP-OCRv4, ONNX) in the phone's browser ═════
   No server: the photo is read on the phone and never leaves it. The reader
   (ONNX Runtime + PaddleOCR models, about 40 MB) is downloaded the first time
   and kept by the browser after that.
   MOcr.read(file) -> {rows:[text lines top to bottom], fields:{merchant, date,
   amount, invoice, gstin, tax, currency, subCat, expType, title, lineTitle}}.
   The parser is rule-based (keywords and patterns of Indian receipts); anything
   it cannot find is left for the person to fill. */
const MOcr=(function(){
  let ready=null;
  const V='?v=20261110';
  function script(src){return new Promise(function(res,rej){const s=document.createElement('script');s.src=src;s.onload=res;s.onerror=function(){rej(new Error('Could not load the receipt reader. Check your connection and try again.'));};document.head.appendChild(s);});}
  /* Load once; later calls reuse it. */
  function load(){
    if(ready)return ready;
    ready=script('ocr/ort.wasm.min.js'+V).then(function(){
        const base=new URL('ocr/',location.href).href;
        window.ort.env.wasm.wasmPaths=base;
        window.ort.env.wasm.numThreads=1;          // GitHub Pages has no cross-origin isolation: one thread
        return script('ocr/paddle-ocr.js'+V);})
      .then(function(){return window.GutenOcr.create({models:{detectionPath:'ocr/ch_PP-OCRv4_det_infer.onnx',recognitionPath:'ocr/ch_PP-OCRv4_rec_infer.onnx',dictionaryPath:'ocr/ppocr_keys_v1.txt'}});})
      .catch(function(e){ready=null;throw e;});
    return ready;
  }
  /* Phone photos are large: read a copy at most 1600 px on the long side. */
  function shrink(file,max){return new Promise(function(res,rej){const url=URL.createObjectURL(file);const img=new Image();
    img.onload=function(){const k=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.round(img.naturalWidth*k);c.height=Math.round(img.naturalHeight*k);
      const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);res(c.toDataURL('image/jpeg',0.92));};
    img.onerror=function(){URL.revokeObjectURL(url);rej(new Error('This file is not a photo. Take a photo of the receipt.'));};img.src=url;});}
  /* Text boxes -> rows: boxes whose middles are at the same height form one row, left to right. */
  function toRows(texts){
    const items=(texts||[]).filter(function(t){return t&&t.text&&String(t.text).trim();}).map(function(t,i){
      const b=t.box||[];const ys=b.map(function(p){return p[1];}),xs=b.map(function(p){return p[0];});
      const y0=ys.length?Math.min.apply(null,ys):i*20,y1=ys.length?Math.max.apply(null,ys):i*20+16;
      return {text:String(t.text).trim(),x:xs.length?Math.min.apply(null,xs):0,y:(y0+y1)/2,h:Math.max(4,y1-y0)};}).sort(function(a,b){return a.y-b.y;});
    const rows=[];
    items.forEach(function(it){const r=rows.find(function(r){return Math.abs(r.y-it.y)<Math.min(r.h,it.h)*0.6;});
      if(r){r.items.push(it);r.y=(r.y*(r.items.length-1)+it.y)/r.items.length;}else rows.push({y:it.y,h:it.h,items:[it]});});
    return rows.map(function(r){return r.items.sort(function(a,b){return a.x-b.x;}).map(function(i){return i.text;}).join('  ');});
  }
  const MON={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,sept:9,oct:10,nov:11,dec:12};
  function iso(y,m,d){return y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0');}
  function okDate(y,m,d,today){if(y<100)y+=2000;if(!(m>=1&&m<=12&&d>=1&&d<=31&&y>=2000&&y<=2100))return null;const s=iso(y,m,d);return !today||s<=today?s:null;}
  function findDate(rows,today){const txt=rows.join('\n');let m;const out=[];
    const r1=/(\d{1,2})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{2,4})/g;while((m=r1.exec(txt))){let d=+m[1],mo=+m[2],y=+m[3];if(mo>12&&d<=12){const t=d;d=mo;mo=t;}out.push([m.index,okDate(y,mo,d,today)]);}
    const r2=/(\d{4})\s*[\/\-.]\s*(\d{1,2})\s*[\/\-.]\s*(\d{1,2})/g;while((m=r2.exec(txt)))out.push([m.index,okDate(+m[1],+m[2],+m[3],today)]);
    const r3=/(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]*([A-Za-z]{3,9})[\s\-\/.,']*(\d{2,4})/g;while((m=r3.exec(txt))){const mo=MON[m[2].toLowerCase().slice(0,4)]||MON[m[2].toLowerCase().slice(0,3)];if(mo)out.push([m.index,okDate(+m[3],mo,+m[1],today)]);}
    const r4=/([A-Za-z]{3,9})[\s.\-]*(\d{1,2})(?:st|nd|rd|th)?,?[\s\-]*(\d{4})/g;while((m=r4.exec(txt))){const mo=MON[m[1].toLowerCase().slice(0,4)]||MON[m[1].toLowerCase().slice(0,3)];if(mo)out.push([m.index,okDate(+m[3],mo,+m[2],today)]);}
    const ok=out.filter(function(x){return x[1];}).sort(function(a,b){return a[0]-b[0];});return ok.length?ok[0][1]:'';}
  function nums(line){return (line.replace(/\d{1,2}(\.\d+)?\s*%/g,' ').match(/\d[\d,]*\.\d{1,2}|\d[\d,]*/g)||[]).map(function(x){return parseFloat(x.replace(/,/g,''));}).filter(function(n){return !isNaN(n);});}
  function fixDigits(s){return s.replace(/([0-9])[Oo]/g,'$10').replace(/[Oo]([0-9])/g,'0$1').replace(/([0-9])[lI|]/g,'$11').replace(/₹\s*/g,' ');}
  function findTotal(rows){
    const R=rows.map(fixDigits),notTot=/sub\s*-?\s*total|total\s*(qty|quantity|items?|savings?|discount|tax|gst)|items?\s*total|round/i;
    const pri=[/grand\s*total/i,/net\s*(amount|payable|total|amt)/i,/(amount|amt)\s*(payable|due|to\s*pay|paid)/i,/total\s*(amount|amt|payable|fare|bill|inr|rs)?/i,/\b(total|fare|bill\s*amount|paid|you\s*pay|to\s*pay)\b/i];
    for(let p=0;p<pri.length;p++){for(let i=R.length-1;i>=0;i--){const r=R[i];if(!pri[p].test(r)||notTot.test(r))continue;
      let a=nums(r).filter(function(n){return n>0&&n<1e7;});if(!a.length&&R[i+1])a=nums(R[i+1]).filter(function(n){return n>0&&n<1e7;});
      if(a.length)return a[a.length-1];}}
    const dec=[].concat.apply([],R.map(function(r){return (r.match(/\d[\d,]*\.\d{2}\b/g)||[]).map(function(x){return parseFloat(x.replace(/,/g,''));});}));
    return dec.length?Math.max.apply(null,dec):null;}
  function findTax(rows,total){let t=0;rows.map(fixDigits).forEach(function(r){if(/\b(c|s|i|u)?gst\b|\bvat\b|service\s*tax/i.test(r)&&!/gstin|gst\s*no|gst\s*reg/i.test(r)){const a=nums(r).filter(function(n){return n>0&&(!total||n<total);});if(a.length)t+=a[a.length-1];}});return t?Math.round(t*100)/100:null;}
  /* OCR often runs words together on shop names ("CITYRIDECABSPVTLTD", "CourtRestaurant").
     Split at lower->upper case changes, then peel common business words off the ends. */
  const BIZ_END=['PRIVATELIMITED','PVTLTD','LIMITED','LTD','LLP','PVT','PRIVATE','INC','CABS','CAB','TAXI','TRAVELS','TOURS','RESTAURANT','RESTAURANTS','CAFE','HOTELS','HOTEL','RESORTS','RESORT','INN','KITCHEN','BAKERY','BAKERS','STORES','STORE','MART','SUPERMARKET','ENTERPRISES','TRADERS','SERVICES','SOLUTIONS','FUELS','PETROLEUM','MOTORS','PHARMACY','MEDICALS','FOODS','FOOD','GRILL','DHABA','SWEETS','STATIONERS','STATIONERY','XEROX','COURIERS','COURIER','LOGISTICS','RESIDENCY','SUITES','LODGE','PALACE','BHAVAN','PARK','PLAZA','CENTRE','CENTER','INDIA','AIRLINES','AIRWAYS','RAILWAYS','PARKING'];
  const BIZ_START=['THE','HOTEL','CAFE','NEW','SHREE','SHRI','SRI','HOTELS'];
  function splitWord(w){if(w.length<9||!/^[A-Za-z]+$/.test(w))return [w];const U=w.toUpperCase(),tail=[];let s=U,cut=true;
    while(cut){cut=false;for(let i=0;i<BIZ_END.length;i++){const b=BIZ_END[i];if(s.length-b.length>=3&&s.endsWith(b)){tail.unshift(b==='PVTLTD'?'PVT LTD':b==='PRIVATELIMITED'?'PRIVATE LIMITED':b);s=s.slice(0,-b.length);cut=true;break;}}}
    const head=[];for(let i=0;i<BIZ_START.length;i++){const b=BIZ_START[i];if(s.startsWith(b)&&s.length-b.length>=3){head.push(b);s=s.slice(b.length);break;}}
    if(!tail.length&&!head.length)return [w];
    const parts=head.concat([s],tail).join(' ');return [w===U?parts:parts.toLowerCase().replace(/\b[a-z]/g,function(c){return c.toUpperCase();})];}
  function tidy(t){t=t.replace(/[^A-Za-z0-9&'.\- ]/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/\s+/g,' ').trim();
    t=t.split(' ').map(function(w){return splitWord(w).join(' ');}).join(' ');
    return t.replace(/\b([A-Z])([A-Z]{2,})\b/g,function(m,a,b){return a+b.toLowerCase();});}
  function findMerchant(rows){const skip=/tax\s*invoice|invoice|receipt|bill\s*(of|no|#)|cash\s*memo|gstin|gst\s*no|welcome|thank|phone|\bph\b|\btel\b|mob(ile)?|www|http|@|\bdate\b|\btime\b|order|table|cashier|original|duplicate|copy|customer|address|\bfssai\b|\bcin\b/i;
    for(let i=0;i<Math.min(rows.length,7);i++){const t=rows[i].replace(/\s{2,}/g,' ').trim();const letters=(t.match(/[A-Za-z]/g)||[]).length;
      if(letters<3||skip.test(t)||letters/t.replace(/\s/g,'').length<0.6)continue;return tidy(t).slice(0,60);}return '';}
  /* Row by row, so a heading like "TAX INVOICE" never swallows the next line; the value must contain a digit and not be a date. */
  function findInvoice(rows){const re=/\b(?:invoice|inv|bill|receipt|rcpt|txn|trip|order|booking|token)[ \t]*(?:number|num|no|id|#)?[ \t]*[.:#\-]*[ \t]*([A-Z0-9][A-Z0-9\/\-]{2,24})/ig;
    for(let i=0;i<rows.length;i++){let m;re.lastIndex=0;while((m=re.exec(rows[i]))){const v=m[1];if(/\d/.test(v)&&!/^\d{1,4}[\/\-.]\d{1,2}([\/\-.]\d{1,4})?$/.test(v))return v.toUpperCase();}}
    return '';}
  /* GSTIN: 15 characters; OCR often glues it to the label ("GSTIN27AAFCS5678K1Z2"), so no word boundary in front. */
  function findGstin(rows){const m=rows.join(' ').toUpperCase().match(/\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z](?![0-9A-Z])/);return m?m[0]:'';}
  function findCurrency(rows){const t=rows.join(' ');if(/₹|\brs\.?\b|\binr\b|rupees/i.test(t))return 'INR';if(/\busd\b|\$/i.test(t))return 'USD';if(/€|\beur\b/i.test(t))return 'EUR';if(/£|\bgbp\b/i.test(t))return 'GBP';if(/\baed\b|dirham/i.test(t))return 'AED';return 'INR';}
  /* Sub Category and Expense Type from words on the receipt (the person can change them). */
  const GUESS=[
    [/hotel|\binn\b|resort|lodge|residency|suites|stay|room\s*(no|charges|rent)|check-?in/i,'Accommodation','Hotel Stay','Hotel stay'],
    [/indigo|air\s*india|vistara|akasa|spicejet|airlines?|boarding|flight|pnr/i,'Travel Reimbursement','One Way','Flight'],
    [/irctc|railway|train|metro|bus\s*ticket|redbus/i,'Travel Reimbursement','One Way','Train / bus ticket'],
    [/uber|\bola\b|rapido|blusmart|cab|taxi|auto\s*rickshaw|\bride\b|trip\s*fare|meru|cityride/i,'Travel Reimbursement','Local Conveyance','Cab'],
    [/parking|toll|fastag/i,'Travel Reimbursement','Local Conveyance','Parking / toll'],
    [/petrol|diesel|fuel|indianoil|indian\s*oil|bharat\s*petroleum|\bbpcl\b|\bhpcl\b|hp\s*petrol|shell|nayara/i,'Travel Reimbursement','Local Conveyance','Fuel'],
    [/restaurant|cafe|café|coffee|\btea\b|chai|kitchen|dhaba|food|swiggy|zomato|biryani|pizza|burger|bakery|lunch|dinner|breakfast|meal|bar\s*&|veg|thali/i,'Meal Allowance','Working Meal','Meal'],
    [/airtel|\bjio\b|vodafone|\bvi\b|bsnl|broadband|internet|postpaid|recharge|act\s*fibernet/i,'Telecom','Mobile Bill','Phone / internet bill'],
    [/stationery|xerox|print|copier|office\s*supplies|courier|amazon|flipkart|stationers/i,'Office Supplies','Stationery','Office supplies']];
  function guess(rows){const t=rows.join(' ');for(let i=0;i<GUESS.length;i++){if(GUESS[i][0].test(t))return {subCat:GUESS[i][1],expType:GUESS[i][2],what:GUESS[i][3]};}return {subCat:'',expType:'',what:''};}
  function parse(rows,today){
    const amount=findTotal(rows),g=guess(rows),merchant=findMerchant(rows);
    const f={merchant:merchant,date:findDate(rows,today),amount:amount,invoice:findInvoice(rows),gstin:findGstin(rows),tax:findTax(rows,amount),currency:findCurrency(rows),subCat:g.subCat,expType:g.expType};
    f.lineTitle=g.what&&merchant?g.what+' — '+merchant:(merchant||g.what||'');
    f.title=f.lineTitle;
    return f;}
  async function read(file,today,onStep){
    onStep&&onStep('Preparing the receipt reader…');
    const ocr=await load();
    onStep&&onStep('Reading your receipt…');
    const src=await shrink(file,1600);
    const out=await ocr.detect(src);
    const rows=toRows(out&&out.texts);
    return {rows:rows,fields:parse(rows,today)};}
  return {load:load,read:read,parse:parse,toRows:toRows};
})();
