import puppeteer from "puppeteer-core";
import fs from "node:fs";
const FILE = "file:///workspace/index.html";
const TEL = "tel:+16103719767";
const MAP = "https://www.google.com/maps/search/?api=1&query=Santa%20Rita%20Grocery%201053%20Cotton%20St%2C%20Reading%2C%20PA%2019602";
const widths = [[320,568],[375,667],[390,844],[768,1024],[1024,768],[1440,900]];
const failures = []; const notes = [];
const fail = (m) => failures.push(m);
const browser = await puppeteer.launch({ executablePath: "/usr/local/bin/google-chrome", headless: "new", args: ["--no-sandbox","--disable-dev-shm-usage","--allow-file-access-from-files"] });
const page = await browser.newPage();
const bad = [];
page.on("pageerror", (e) => bad.push(String(e)));
page.on("console", (m) => { if (m.type()==="error") bad.push(m.text()); });
page.on("requestfailed", (r) => bad.push(r.url()));
await page.goto(FILE, { waitUntil: "load" });
const base = await page.evaluate(() => ({
  h1: document.querySelector("h1").textContent.replace(/\s+/g," ").trim(),
  title: document.title,
  text: document.body.innerText.toLowerCase(),
  calls: [...document.querySelectorAll("a.call")].map(a=>a.getAttribute("href")),
  dirs: [...document.querySelectorAll("a.directions")].map(a=>a.getAttribute("href")),
  robots: document.querySelector('meta[name="robots"]').content,
  details: (document.body.innerText || "").toLowerCase()
}));
if (!base.h1.includes("Santa Rita Grocery") || !base.h1.includes("Cotton Street") || !base.h1.includes("Reading PA")) fail("h1 "+base.h1);
if (!base.calls.length || base.calls.some(h=>h!==TEL)) fail("tel");
if (!base.dirs.length || base.dirs.some(h=>h!==MAP)) fail("maps");
if (!/noindex/.test(base.robots)) fail("noindex");
for (const w of ["order now","chef","catering","testimonial","$"]) if (base.text.includes(w)) fail("banned "+w);
if (!base.text.includes("find us on cotton street")) fail("invite");
if (base.text.includes("doordash") || base.text.includes("uber eats")) fail("source label");
await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
await new Promise(r=>setTimeout(r,400));
const imgs = await page.evaluate(() => [...document.images].filter(i=>i.src && !i.closest("dialog")).map(i => ({
  n:(i.currentSrc||i.src).split("/").pop(), w:i.naturalWidth, h:i.naturalHeight, c:i.complete, r:Math.round(i.getBoundingClientRect().width)
})));
notes.push(JSON.stringify(imgs.map(i=>i.n+":"+i.w+"x"+i.r)));
const caps = { "pastry-plate.png":1088, "sandwich-board.png":707, "fries-tray.png":659, "storefront-madame-google-maps.jpg":1060, "card-pastry.png":300, "card-sandwich.png":313, "card-fries.png":291 };
for (const im of imgs) {
  if (!im.c || im.w<2) fail("dead "+im.n);
  if (caps[im.n] && im.w!==caps[im.n]) fail("natural "+im.n+" "+im.w);
  if (caps[im.n] && im.r>im.w+1) fail("enlarged "+im.n+" "+im.r);
}
function contrast(a,b){const lin=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4; const lum=rgb=>0.2126*lin(rgb[0]/255)+0.7152*lin(rgb[1]/255)+0.0722*lin(rgb[2]/255); const x=lum(a),y=lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);}
await page.setViewport({width:390,height:844});
const rows = await page.evaluate(() => {
  const parse=bg=>{const m=String(bg).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); return m?[+m[1],+m[2],+m[3]]:null;};
  const bgOf=el=>{let n=el; while(n){const c=getComputedStyle(n).backgroundColor; const p=parse(c); if(p && !c.endsWith(", 0)")) return p; n=n.parentElement;} return [74,16,22];};
  return [".y",".w",".lede",".hero .rect.call",".hero .ghost",".intro h2",".intro .rect",".card strong",".loc-copy h2",".dock .call"].map(sel=>{
    const el=document.querySelector(sel); if(!el) return {sel,missing:1};
    const cs=getComputedStyle(el);
    return {sel, fg:parse(cs.color), bg:bgOf(el), size:parseFloat(cs.fontSize), weight:parseInt(cs.fontWeight,10)||400};
  });
});
for (const row of rows) {
  if (row.missing) { fail("missing "+row.sel); continue; }
  const ratio=contrast(row.fg,row.bg);
  const need=(row.size>=24||(row.weight>=700&&row.size>=18.66))?3:4.5;
  notes.push(`c ${row.sel} ${ratio.toFixed(2)}/${need}`);
  if (ratio<need-0.08) fail(`contrast ${row.sel} ${ratio.toFixed(2)}`);
}
for (const [w,h] of widths) {
  await page.setViewport({width:w,height:h});
  await page.evaluate(()=>scrollTo(0,0));
  await new Promise(r=>setTimeout(r,40));
  const r=await page.evaluate(()=>{
    const vw=document.documentElement.clientWidth; const bad=[];
    document.querySelectorAll("body *").forEach(el=>{
      if(el.closest("dialog")) return;
      const b=el.getBoundingClientRect();
      if(b.width<2&&b.height<2) return;
      if(b.right>vw+1.5||b.left<-1.5) bad.push(String(el.className||el.tagName).slice(0,28));
    });
    const dock=document.querySelector(".dock");
    const shown=getComputedStyle(dock).display!=="none";
    const limit=shown?dock.getBoundingClientRect().top:innerHeight;
    const actions=[...document.querySelectorAll(".hero .hero-actions a")].map(a=>{
      const b=a.getBoundingClientRect();
      const hit=document.elementFromPoint(b.left+b.width/2, b.top+10);
      return {t:a.textContent.trim(), h:Math.round(b.height), bottom:Math.round(b.bottom), inView:b.top>=0&&b.bottom<=limit-1, hit:!!(hit&&(hit===a||a.contains(hit)))};
    });
    const photo=document.querySelector(".hero-pastry img").getBoundingClientRect();
    const vis=Math.round(Math.min(photo.bottom,limit)-Math.max(photo.top,0));
    return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bad:[...new Set(bad)].slice(0,6),shown,actions,vis};
  });
  if(r.sw>r.cw+1) fail(w+" overflow "+r.sw);
  if(r.bad.length) fail(w+" bleed "+r.bad.join("|"));
  if(r.shown!==w<900) fail(w+" dock");
  for(const a of r.actions){ if(a.h<44||!a.inView||!a.hit) fail(w+" cta "+a.t+" "+a.bottom+" hit "+a.hit); }
  if(r.vis<30) fail(w+" pastry "+r.vis);
  notes.push(w+` vis ${r.vis}`);
}
await page.setViewport({width:390,height:844});
await page.keyboard.press("Tab");
if(!String(await page.evaluate(()=>document.activeElement.className)).includes("skip")) fail("skip");
await page.keyboard.press("Enter");
await new Promise(r=>setTimeout(r,50));
if((await page.evaluate(()=>document.activeElement.id))!=="main") fail("main");
await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);
await page.reload({waitUntil:"load"});
await page.setViewport({width:1100,height:800});
const tf=await page.evaluate(()=>getComputedStyle(document.querySelector(".f-pastry")).transform);
if(tf!=="none") fail("motion "+tf);
await page.click(".card");
await new Promise(r=>setTimeout(r,200));
const lb=await page.evaluate(()=>({o:document.getElementById("viewer").open,w:document.getElementById("viewer-img").naturalWidth}));
if(!lb.o||lb.w!==1088) fail("lb "+JSON.stringify(lb));
await page.keyboard.press("Escape");
if(bad.length) fail(bad.join(" | "));
fs.mkdirSync("/opt/cursor/artifacts",{recursive:true});
await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"no-preference"}]);
await page.setViewport({width:1440,height:900,deviceScaleFactor:2});
await page.goto(FILE,{waitUntil:"load"});
await new Promise(r=>setTimeout(r,350));
await page.screenshot({path:"/opt/cursor/artifacts/desktop-reference-match.png", fullPage:true});
await page.setViewport({width:390,height:844,deviceScaleFactor:2});
await page.evaluate(()=>scrollTo(0,0));
await new Promise(r=>setTimeout(r,150));
await page.screenshot({path:"/tmp/match-fold.png"});
await page.addStyleTag({content:"body{position:relative}.dock{position:absolute!important;bottom:.4rem;top:auto;}"});
await page.screenshot({path:"/opt/cursor/artifacts/mobile-reference-match.png", fullPage:true});
await browser.close();
const md=["# Reference-match test","",failures.length?failures.map(f=>"- "+f).join("\n"):"No failures.","",...notes.map(n=>"- "+n)].join("\n");
fs.writeFileSync("/workspace/sources/TEST-RESULTS.md", md+"\n");
console.log(md);
if(failures.length) process.exit(1);
