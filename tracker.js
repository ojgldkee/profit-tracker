(()=>{"use strict";
const script=document.currentScript;
const qs=new URL(script?.src||location.href).searchParams;
const KEY=qs.get("key")||"";
const ENDPOINT="https://mujnjfllyklnuydoiotj.supabase.co/functions/v1/track";
if(!KEY)return;

const storageKey="pt_session_id";
let sessionId=localStorage.getItem(storageKey);
if(!sessionId){
  sessionId=(crypto.randomUUID?crypto.randomUUID():("pt_"+Date.now()+"_"+Math.random().toString(36).slice(2)));
  localStorage.setItem(storageKey,sessionId);
}
document.cookie="pt_session_id="+encodeURIComponent(sessionId)+"; Path=/; Max-Age=31536000; SameSite=Lax";

const firstKey="pt_first_touch";
let first={};
try{first=JSON.parse(localStorage.getItem(firstKey)||"{}")}catch{}
const params=new URLSearchParams(location.search);
const current={
  utm_source:params.get("utm_source")||null,
  utm_medium:params.get("utm_medium")||null,
  utm_campaign:params.get("utm_campaign")||null,
  utm_content:params.get("utm_content")||null,
  utm_term:params.get("utm_term")||null,
  fbclid:params.get("fbclid")||null,
  gclid:params.get("gclid")||null,
  ttclid:params.get("ttclid")||null,
  msclkid:params.get("msclkid")||null,
  url:location.href,
  referrer:document.referrer||null
};
if(!first.url){
  first={...current,ts:Date.now()};
  try{localStorage.setItem(firstKey,JSON.stringify(first))}catch{}
}

async function cartToken(){
  try{
    const r=await fetch("/cart.js",{credentials:"same-origin"});
    if(!r.ok)return null;
    const j=await r.json();
    return j.token||null;
  }catch{return null}
}
async function persistCartAttributes(token){
  try{
    const attrs={
      pt_session_id:sessionId,
      pt_first_url:(first.url||"").slice(0,240),
      pt_first_referrer:(first.referrer||"").slice(0,240),
      pt_utm_source:first.utm_source||current.utm_source||"",
      pt_utm_campaign:first.utm_campaign||current.utm_campaign||"",
      pt_utm_content:first.utm_content||current.utm_content||"",
      pt_fbclid:first.fbclid||current.fbclid||"",
      pt_gclid:first.gclid||current.gclid||"",
      pt_ttclid:first.ttclid||current.ttclid||""
    };
    await fetch("/cart/update.js",{method:"POST",headers:{"content-type":"application/json"},credentials:"same-origin",body:JSON.stringify({attributes:attrs})});
  }catch{}
}
async function send(eventType="page_view"){
  const token=await cartToken();
  const payload={tracking_key:KEY,session_id:sessionId,event_type:eventType,pathname:location.pathname,url:location.href,referrer:document.referrer||null,cart_token:token,...current};
  try{
    const body=JSON.stringify(payload);
    if(navigator.sendBeacon){
      navigator.sendBeacon(ENDPOINT,new Blob([body],{type:"application/json"}));
    }else{
      fetch(ENDPOINT,{method:"POST",headers:{"content-type":"application/json"},body,keepalive:true,mode:"cors"}).catch(()=>{});
    }
  }catch{}
  if(token)persistCartAttributes(token);
}

send("page_view");
document.addEventListener("submit",e=>{
  const form=e.target;
  if(!(form instanceof HTMLFormElement))return;
  const action=(form.getAttribute("action")||"").toLowerCase();
  if(action.includes("/cart/add"))send("add_to_cart");
  if(action.includes("/checkout"))send("checkout_start");
},true);
document.addEventListener("click",e=>{
  const el=e.target instanceof Element?e.target.closest("a,button"):null;
  if(!el)return;
  const text=(el.textContent||"").toLowerCase();
  const href=(el.getAttribute?.("href")||"").toLowerCase();
  if(text.includes("checkout")||href.includes("/checkout"))send("checkout_start");
},true);
window.addEventListener("pageshow",()=>{if(document.visibilityState==="visible")send("page_view")});
})();