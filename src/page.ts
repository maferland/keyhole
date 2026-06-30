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
<link rel=preconnect href="https://fonts.googleapis.com">
<link rel=preconnect href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap" rel=stylesheet>
<style>
 :root{
   --bg:#0a0e0c;--sf:#0e1411;--si:#070b09;--tb:#0a100d;--sp:#0f1512;
   --ac:#b48cff;--tx:#e8f0ea;--tb2:#aeb9b1;--mu:#a0aca5;--di:#96a49c;
   --cl:#cfd8d1;--so:#9aa79d;--la:#7a9085;--fa:#6e8078;--da:#d36b5e;--in:#7fb8d8;
   --mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
 }
 *{box-sizing:border-box}
 html,body{height:100%}
 body{background:var(--bg);color:var(--tx);font:13px/1.5 var(--mono);
   margin:0;display:flex;align-items:center;justify-content:center;padding:24px}
 .wrap{width:440px;max-width:calc(100vw - 32px);position:relative;
   animation:kh-up .8s cubic-bezier(.2,.7,.2,1)}
 .card{position:relative;background:var(--sf);border:1px solid rgba(255,255,255,.07);
   border-radius:14px;overflow:hidden;z-index:1}
 .card::before{content:"";position:absolute;inset:-40px;z-index:-1;
   background:radial-gradient(60% 50% at 50% 30%,var(--ac),transparent 70%);
   filter:blur(80px);opacity:.3;pointer-events:none}
 /* title bar */
 .bar{display:flex;align-items:center;gap:8px;background:var(--tb);
   border-bottom:1px solid rgba(255,255,255,.06);padding:12px 15px}
 .dots{display:flex;gap:6px;flex:none}
 .dots i{width:9px;height:9px;border-radius:50%;background:#2a2f2b;display:block}
 .url{flex:1;text-align:center;font-size:10.5px;color:var(--fa);
   white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:33px}
 /* logo */
 .logo{display:flex;align-items:center;gap:8px}
 .mark{position:relative;width:18px;height:18px;border:1.5px solid var(--ac);
   border-radius:50%;flex:none}
 .mark::after{content:"";position:absolute;left:50%;bottom:1px;transform:translateX(-50%);
   width:3px;height:7px;background:var(--ac);border-radius:1px}
 .word{font-size:14px;font-weight:800;color:var(--tx);letter-spacing:.2px}
 .word b{color:var(--ac);font-weight:800}
 /* body */
 .body{position:relative;padding:28px 26px 26px}
 .logo-row{margin-bottom:18px}
 .logo-row.center{justify-content:center;margin-bottom:20px}
 .title{font-size:14.5px;font-weight:700;color:var(--tx);margin:0 0 14px;line-height:1.4}
 .chip-ctx{display:inline-block;background:color-mix(in srgb,var(--ac) 8%,transparent);
   border:1px solid color-mix(in srgb,var(--ac) 24%,transparent);color:var(--so);
   font-size:11px;border-radius:6px;padding:3px 8px;margin:0 0 18px;max-width:100%;
   white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .fields{display:flex;flex-direction:column;gap:16px;margin-bottom:18px}
 .field label{display:block;font-size:11px;color:var(--la);letter-spacing:.1em;
   text-transform:uppercase;margin:0 0 7px}
 .in{position:relative;display:flex;align-items:center}
 input{flex:1;width:100%;background:var(--si);
   border:1px solid color-mix(in srgb,var(--ac) 38%,transparent);
   color:var(--cl);font:13.5px var(--mono);padding:12px 14px;border-radius:8px;outline:none}
 input::placeholder{color:transparent}
 .cur{position:absolute;right:14px;width:8px;height:1em;background:var(--ac);
   border-radius:1px;animation:kh-blink 1.5s ease-in-out infinite;pointer-events:none}
 /* dest chips */
 .dest{display:flex;gap:8px;margin-bottom:18px}
 .dchip{flex:1;text-align:center;font:12px var(--mono);padding:8px 0;border-radius:8px;
   border:1px solid rgba(255,255,255,.08);background:transparent;color:var(--di);
   cursor:pointer;user-select:none}
 .dchip.on{background:color-mix(in srgb,var(--ac) 14%,transparent);
   border-color:color-mix(in srgb,var(--ac) 42%,transparent);color:var(--ac);font-weight:600}
 .dchip.dis{opacity:.4;cursor:not-allowed;pointer-events:none}
 /* error banner */
 .err{display:none;align-items:flex-start;gap:9px;background:rgba(211,107,94,.08);
   border:1px solid rgba(211,107,94,.25);border-radius:8px;padding:11px 13px;margin-bottom:16px}
 .err .bang{flex:none;font-size:14px;color:var(--da);line-height:1.55}
 .err .txt{font-size:11.5px;line-height:1.55;color:var(--da)}
 /* button */
 button.go{width:100%;background:var(--ac);border:0;color:#06140a;
   font:700 13.5px var(--mono);padding:13px;border-radius:8px;cursor:pointer;
   transition:box-shadow .18s,filter .18s,background .18s}
 button.go:hover{box-shadow:0 12px 32px color-mix(in srgb,var(--ac) 42%,transparent);
   filter:brightness(1.07)}
 .cap{text-align:center;font-size:10.5px;color:var(--fa);margin-top:14px}
 /* submitting state */
 .card.busy .form{opacity:.7;pointer-events:none}
 .card.busy input{border-color:rgba(255,255,255,.06)}
 .card.busy .dest{opacity:.5}
 .card.busy button.go{background:color-mix(in srgb,var(--ac) 40%,transparent)}
 /* error state */
 .card.err-state .mark{border-color:var(--da)}
 .card.err-state .mark::after{background:var(--da)}
 .card.err-state input{border-color:rgba(211,107,94,.35)}
 .card.err-state .err{display:flex}
 /* dead/success states */
 .dead{text-align:center;padding:34px 26px 30px}
 .dead .logo{justify-content:center;margin-bottom:22px}
 .ring{width:56px;height:56px;border-radius:50%;display:grid;place-items:center;
   margin:0 auto 18px;font-size:24px}
 .ring.ok{background:color-mix(in srgb,var(--ac) 12%,transparent);
   border:1px solid color-mix(in srgb,var(--ac) 40%,transparent);color:var(--ac)}
 .ring.lock{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);color:var(--di)}
 .ring.time{background:rgba(230,163,63,.06);border:1px solid rgba(230,163,63,.3);color:#e6a33f}
 .dead h2{font-size:16px;font-weight:700;color:var(--tx);margin:0 0 10px}
 .dead p{font-size:12px;line-height:1.6;color:var(--mu);margin:0 0 18px;white-space:pre-line}
 .dead p .ac{color:var(--ac)}
 .note{background:var(--tb);border:1px solid rgba(255,255,255,.07);border-radius:8px;
   padding:10px 14px;font-size:10.5px;color:var(--fa);line-height:1.5}
 .note code{font-family:var(--mono);color:var(--so)}
 @keyframes kh-up{from{transform:translateY(16px)}to{transform:none}}
 @keyframes kh-glow{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.9;transform:scale(1.08)}}
 @keyframes kh-blink{0%,100%{opacity:1}50%{opacity:.18}}
 @media (prefers-reduced-motion:reduce){*{animation:none !important}}
</style></head><body>
<div class=wrap>
 <div class=card id=card>
  <div class=bar>
   <div class=dots><i></i><i></i><i></i></div>
   <div class=url>{url}</div>
  </div>
  <div class=body id=body>
   <div class="logo logo-row"><span class=mark></span><span class=word>keyhole<b>_</b></span></div>
   <div class=form id=form>
    <h1 class=title>{title}</h1>
    {ctxchip}
    <div class=fields>{fields}</div>
    <div class=dest id=dest>
     <div class="dchip{kc}" data-d=keychain>keychain</div>
     <div class="dchip{fl}{fdis}" data-d=file{ftitle}>file</div>
     <div class="dchip{en}" data-d=env>env</div>
    </div>
    <div class=err id=err><span class=bang>!</span><span class=txt id=errtxt></span></div>
    <button class=go id=go>{button}</button>
    <div class=cap>localhost only · single-use · value never leaves this machine</div>
   </div>
  </div>
 </div>
</div>
<script>
 const card=document.getElementById('card'),body=document.getElementById('body'),
       go=document.getElementById('go'),errtxt=document.getElementById('errtxt'),
       fields=[...document.querySelectorAll('input[data-name]')],
       dest={destJson},multi=fields.length>1;
 const logoRow='<div class="logo logo-row center"><span class=mark></span><span class=word>keyhole<b>_</b></span></div>';
 document.querySelectorAll('.dchip:not(.dis)').forEach(c=>c.onclick=()=>{
   document.querySelectorAll('.dchip').forEach(x=>x.classList.remove('on'));
   c.classList.add('on');});
 function dead(ringClass,glyph,heading,bodyHtml,noteHtml){
   body.className='body';card.className='card';
   body.innerHTML=logoRow+'<div class=dead>'+
     '<div class="ring '+ringClass+'">'+glyph+'</div>'+
     '<h2>'+heading+'</h2><p>'+bodyHtml+'</p>'+
     '<div class=note>'+noteHtml+'</div></div>';
 }
 function success(){
   const list=multi?fields.map(f=>'<span class=ac>'+f.dataset.name+'</span>').join('\\n'):'';
   const heading=multi?fields.length+' secrets stored.':'Secret stored.';
   dead('ok','✓',heading,
     'Stored to <span class=ac>'+dest+'</span>.\\nYour agent has what it needs.'+(list?'\\n'+list:''),
     'The value never touched the agent\\'s context. You can close this tab.');
 }
 function already(){
   dead('lock','🔒','Already submitted.',
     'You already submitted this form. The secret is stored and the agent is running.',
     'If you think this is wrong, restart the <code>keyhole</code> command in your terminal.');
 }
 function timedOut(){
   dead('time','⌛','Timed out.',
     'The agent stopped waiting. The local server is gone.',
     'Run the command again to get a fresh form. Default is 300 s; pass --timeout to change it.');
 }
 function showError(text){
   card.classList.remove('busy');card.classList.add('err-state');
   errtxt.textContent=text||'Failed to store. Check permissions, or try a different destination.';
   go.disabled=false;go.textContent=multi?'Store all →':'Try again →';
 }
 async function send(){
   if(fields.some(f=>!f.value.length)){showError('Fill every field first.');fields.find(f=>!f.value.length).focus();return;}
   card.classList.remove('err-state');card.classList.add('busy');
   go.disabled=true;go.textContent='storing…';
   const secrets={};fields.forEach(f=>secrets[f.dataset.name]=f.value);
   let r;
   try{
     r=await fetch('{token}/submit',{method:'POST',
       headers:{'content-type':'application/json'},body:JSON.stringify({secrets})});
   }catch(e){timedOut();return;}
   if(r.ok){fields.forEach(f=>f.value='');success();return;}
   if(r.status===409){already();return;}
   let text='';try{text=await r.text();}catch(e){}
   card.classList.remove('busy');showError(text);
 }
 go.onclick=send;
 fields.forEach(f=>f.addEventListener('keydown',e=>{
   if(e.key==='Enter'){e.preventDefault();send();}}));
</script></body></html>`

export function buildPage(names: string[], context: string, dest: string, token: string): string {
  const multi = names.length > 1
  const title = multi ? `Your agent needs ${names.length} secrets` : "Your agent needs a secret"

  const initialChip = dest.startsWith("file:")
    ? "file"
    : dest.startsWith("env:")
      ? "env"
      : "keychain"

  const ctxchip = context ? `<div class=chip-ctx title="${esc(context)}">${esc(context)}</div>` : ""

  const fields = names
    .map(
      (name, i) =>
        `<div class=field>
     <label for="s${i}">${esc(name)}</label>
     <div class=in>
      <input id="s${i}" data-name="${esc(name)}" type=password autocomplete=off autocapitalize=off
        autocorrect=off spellcheck=false${i === 0 ? " autofocus" : ""}>
      <span class=cur></span>
     </div>
    </div>`,
    )
    .join("\n     ")

  const url = `127.0.0.1/s/${esc(token)}`

  return TEMPLATE.replaceAll("{title}", esc(title))
    .replaceAll("{url}", url)
    .replaceAll("{ctxchip}", ctxchip)
    .replaceAll("{fields}", fields)
    .replaceAll("{button}", multi ? "Store all →" : "Store →")
    .replaceAll("{kc}", initialChip === "keychain" ? " on" : "")
    .replaceAll("{fl}", initialChip === "file" ? " on" : "")
    .replaceAll("{en}", initialChip === "env" ? " on" : "")
    .replaceAll("{fdis}", multi ? " dis" : "")
    .replaceAll("{ftitle}", multi ? ' title="file: supports one secret only"' : "")
    .replaceAll("{destJson}", JSON.stringify(esc(dest)))
    .replaceAll("{token}", token)
}
