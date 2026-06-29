function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

const TEMPLATE = `<!doctype html><html lang=en><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>keyhole · {title}</title>
<style>
 :root{--bg:#0b0d12;--card:#151a23;--line:#262d3a;--ink:#e8eaee;--mut:#8b93a3;
   --accent:#5b8cff;--ok:#4ade80;--err:#f87171}
 *{box-sizing:border-box}
 body{background:radial-gradient(120% 120% at 50% 0%,#11151d 0%,var(--bg) 60%);
   color:var(--ink);font:15px/1.5 -apple-system,BlinkMacSystemFont,system-ui,sans-serif;
   display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;padding:24px}
 .card{background:var(--card);border:1px solid var(--line);padding:26px 28px 22px;
   border-radius:16px;width:460px;box-shadow:0 12px 50px rgba(0,0,0,.55)}
 .head{display:flex;align-items:center;gap:11px;margin-bottom:6px}
 .key{width:34px;height:34px;flex:none;border-radius:9px;display:grid;place-items:center;
   background:linear-gradient(160deg,#2a3550,#1b2233);border:1px solid var(--line);font-size:17px}
 h1{font-size:15px;font-weight:600;margin:0;letter-spacing:.2px}
 .pill{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--accent);
   background:rgba(91,140,255,.1);border:1px solid rgba(91,140,255,.25);
   padding:1px 7px;border-radius:6px;display:inline-block}
 .ctx{color:var(--mut);font-size:13px;margin:14px 0 18px;display:-webkit-box;
   -webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .field-row{margin-bottom:14px}
 .field-row label{display:block;margin:0 0 7px}
 .field{position:relative}
 input{width:100%;background:var(--bg);border:1px solid var(--line);color:var(--ink);
   padding:12px 44px 12px 13px;border-radius:10px;font:14px ui-monospace,Menlo,monospace;outline:none}
 input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(91,140,255,.18)}
 .eye{position:absolute;right:6px;top:6px;bottom:6px;width:34px;border:0;background:transparent;
   color:var(--mut);cursor:pointer;font-size:15px;border-radius:7px}
 .eye:hover{color:var(--ink);background:rgba(255,255,255,.05)}
 button.go{margin-top:4px;width:100%;background:var(--accent);border:0;color:#fff;
   padding:12px;border-radius:10px;font-weight:600;font-size:14px;cursor:pointer;transition:.15s}
 button.go:hover{filter:brightness(1.08)} button.go:disabled{opacity:.55;cursor:default}
 .foot{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-top:14px;
   font-size:12px;color:var(--mut)}
 .lock{display:inline-flex;align-items:center;gap:5px;flex:none;white-space:nowrap}
 .dest{min-width:0;overflow:hidden}
 .dest code{font:11px ui-monospace,Menlo,monospace;color:var(--mut);display:block;
   white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .msg{font-size:13px;min-height:18px;margin-top:12px}
 .msg.ok{color:var(--ok)} .msg.err{color:var(--err)}
 .done .head{display:none} .done .form{display:none} .done .check{display:flex}
 .check{display:none;flex-direction:column;align-items:center;gap:12px;padding:30px 0 24px;text-align:center}
 .check .ring{width:54px;height:54px;border-radius:50%;background:rgba(74,222,128,.12);
   border:1px solid rgba(74,222,128,.45);display:grid;place-items:center;color:var(--ok);font-size:26px}
 .check .ctitle{font-size:15px;font-weight:600}
 .check .csub{font-size:13px;color:var(--mut)}
</style></head><body>
<div class=card id=card>
 <div class=head>
  <div class=key>🔑</div>
  <div><h1>{title}</h1></div>
 </div>
 <div class=form id=form>
  <p class=ctx title="{context}">{context}</p>
  {fields}
  <button class=go id=go>{button}</button>
  <div class=msg id=m></div>
  <div class=foot>
   <span class=lock>🔒 Stays on this machine</span>
   <span class=dest><code title="{dest}">{dest}</code></span>
  </div>
 </div>
 <div class=check>
  <div class=ring>✓</div>
  <div class=ctitle id=ctitle>Secret stored</div>
  <div class=csub id=csub>Closing this tab…</div>
 </div>
</div>
<script>
 const go=document.getElementById('go'),m=document.getElementById('m'),
       card=document.getElementById('card'),
       fields=[...document.querySelectorAll('input[data-name]')];
 document.querySelectorAll('.eye').forEach(b=>b.onclick=()=>{
   const f=document.getElementById(b.dataset.for),p=f.type==='password';
   f.type=p?'text':'password';b.textContent=p?'🙈':'👁';f.focus();});
 function msg(cls,text){m.className='msg'+(cls?' '+cls:'');m.textContent=text;}
 function finish(){
   card.classList.add('done');
   document.getElementById('ctitle').textContent=fields.length>1?fields.length+' secrets stored':'Secret stored';
   const sub=document.getElementById('csub');let left=3;
   (function tick(){
     if(left<=0){window.close();setTimeout(()=>{sub.textContent='You can close this tab.';},300);return;}
     sub.textContent='Closing in '+left+'…';left--;setTimeout(tick,1000);
   })();
 }
 async function send(){
   if(fields.some(f=>!f.value)){msg('err','Fill every field first.');fields.find(f=>!f.value).focus();return;}
   go.disabled=true;msg('','Storing…');
   const secrets={};fields.forEach(f=>secrets[f.dataset.name]=f.value);
   try{
     const r=await fetch('{token}/submit',{method:'POST',
       headers:{'content-type':'application/json'},body:JSON.stringify({secrets})});
     if(r.ok){fields.forEach(f=>f.value='');finish();}
     else{msg('err','Store failed: '+await r.text());go.disabled=false;}
   }catch(e){msg('err','Error: '+e);go.disabled=false;}
 }
 go.onclick=send;
 fields.forEach(f=>f.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send();}}));
</script></body></html>`

export function buildPage(names: string[], context: string, dest: string, token: string): string {
  const multi = names.length > 1
  const title = multi ? `Provide ${names.length} secrets` : "Provide a secret"
  const ctx =
    context ||
    (multi ? "Fill each field, then store them all." : "Paste or type the secret, then store.")
  const fields = names
    .map(
      (name, i) =>
        `<div class=field-row>
    <label for="s${i}"><span class=pill>${esc(name)}</span></label>
    <div class=field>
     <input id="s${i}" data-name="${esc(name)}" type=password autocomplete=off autocapitalize=off
       autocorrect=off spellcheck=false placeholder="Paste or type…"${i === 0 ? " autofocus" : ""}>
     <button class=eye type=button data-for="s${i}" title="Show / hide" aria-label="Toggle visibility">👁</button>
    </div>
   </div>`,
    )
    .join("\n  ")
  return TEMPLATE.replaceAll("{title}", esc(title))
    .replaceAll("{context}", esc(ctx))
    .replaceAll("{fields}", fields)
    .replaceAll("{button}", multi ? "Store secrets" : "Store secret")
    .replaceAll("{dest}", esc(dest))
    .replaceAll("{token}", token)
}
