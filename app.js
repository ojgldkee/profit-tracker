const SUPABASE_URL="https://mujnjfllyklnuydoiotj.supabase.co";
const SUPABASE_KEY="sb_publishable_Ow4gfh354q6hFXNtkEVIqg_VGUEbvqL";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const API=SUPABASE_URL+"/functions/v1/profit-api";

const state={session:null,store:null,daily:[],ads:[],orders:[],products:[],expenses:[],integrations:[],runs:[],range:7,provider:"all",authMode:"signin"};

const $=id=>document.getElementById(id);
const money=(v,c="USD")=>new Intl.NumberFormat("en-US",{style:"currency",currency:c,maximumFractionDigits:2}).format(Number(v||0));
const pct=v=>new Intl.NumberFormat("en-US",{style:"percent",maximumFractionDigits:1}).format(Number(v||0));
const n=v=>Number(v||0);
const sum=(arr,key)=>arr.reduce((s,x)=>s+n(x[key]),0);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const isoStart=days=>new Date(Date.now()-(days-1)*86400000).toISOString().slice(0,10);
const toast=(msg,type="good")=>{const d=document.createElement("div");d.className="toast "+type;d.textContent=msg;$("toast").appendChild(d);setTimeout(()=>d.remove(),4200)};

async function invoke(action,payload={}){
  const token=state.session?.access_token;
  if(!token) throw new Error("Sign in first");
  const r=await fetch(API,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+token,"apikey":SUPABASE_KEY},body:JSON.stringify({action,...payload})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||"Request failed");
  return j;
}

async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  state.session=session;
  showAuth(!session);
  if(session) await loadAll();
}
function showAuth(show){
  $("auth-screen").classList.toggle("hidden",!show);
  $("app").classList.toggle("hidden",show);
}

document.querySelectorAll(".auth-tab").forEach(b=>b.onclick=()=>{
  state.authMode=b.dataset.auth;
  document.querySelectorAll(".auth-tab").forEach(x=>x.classList.toggle("active",x===b));
  document.querySelectorAll(".signup-only").forEach(x=>x.classList.toggle("hidden",state.authMode!=="signup"));
  $("auth-form").querySelector("button").textContent=state.authMode==="signup"?"Create account":"Sign in";
  $("auth-msg").textContent="";
});

$("auth-form").onsubmit=async e=>{
  e.preventDefault();
  const email=$("auth-email").value.trim(),password=$("auth-password").value,store_name=$("auth-store").value.trim();
  $("auth-msg").textContent="Working…";
  try{
    if(state.authMode==="signup"){
      const {data,error}=await sb.auth.signUp({email,password,options:{data:{store_name}}});if(error)throw error;
      if(!data.session){$("auth-msg").textContent="Account created. Check your email to verify, then sign in.";return}
      state.session=data.session;
    }else{
      const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;state.session=data.session;
    }
    showAuth(false);await loadAll();
  }catch(err){$("auth-msg").textContent=err.message||String(err)}
};

$("signout-btn").onclick=async()=>{await sb.auth.signOut();state.session=null;showAuth(true)};

document.querySelectorAll("#nav button").forEach(b=>b.onclick=()=>openPage(b.dataset.page));
document.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>openPage(b.dataset.jump));
function openPage(page){
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-"+page));
  $("page-title").textContent=page[0].toUpperCase()+page.slice(1);
  $("page-kicker").textContent=({overview:"FINANCIAL TRUTH",profit:"CONTRIBUTION ECONOMICS",ads:"MEDIA PERFORMANCE",orders:"ORDER ECONOMICS",products:"PRODUCT ECONOMICS",expenses:"COST CONTROL",settings:"DATA CONNECTIONS"})[page]||"PROFIT TRACKER";
}

$("range-select").onchange=async e=>{state.range=Number(e.target.value);await loadData();render()};
$("refresh-btn").onclick=async()=>{await loadAll();toast("Dashboard refreshed")};

async function loadAll(){
  try{
    const status=await invoke("getStatus");
    state.store=status.store;state.integrations=status.integrations||[];state.runs=status.runs||[];
    $("brand-store").textContent=state.store?.name||"My Store";
    await loadData();render();
  }catch(err){toast(err.message,"bad")}
}

async function loadData(){
  const start=isoStart(state.range);
  const storeId=state.store?.id;if(!storeId)return;
  const [daily,ads,orders,products,expenses]=await Promise.all([
    sb.from("daily_profit").select("*").eq("store_id",storeId).gte("day",start).order("day"),
    sb.from("ad_daily").select("*").eq("store_id",storeId).gte("day",start).order("spend",{ascending:false}),
    sb.from("order_profitability").select("*").eq("store_id",storeId).gte("created_at",start+"T00:00:00Z").order("created_at",{ascending:false}).limit(300),
    sb.from("product_profitability").select("*").eq("store_id",storeId).order("gross_contribution",{ascending:false}).limit(100),
    sb.from("expenses").select("*").eq("store_id",storeId).gte("day",start).order("day",{ascending:false})
  ]);
  for(const x of [daily,ads,orders,products,expenses])if(x.error)console.warn(x.error);
  state.daily=daily.data||[];state.ads=ads.data||[];state.orders=orders.data||[];state.products=products.data||[];state.expenses=expenses.data||[];
}

function summary(){
  const d=state.daily;
  const gross=sum(d,"gross_sales"),net=sum(d,"net_revenue"),orders=sum(d,"orders"),adSpend=sum(d,"ad_spend"),cogs=sum(d,"cogs"),fulfillment=sum(d,"fulfillment_cost"),fees=sum(d,"payment_fees"),variable=sum(d,"variable_costs"),refunds=sum(d,"refunds"),expenses=sum(d,"expenses"),preAd=sum(d,"pre_ad_contribution"),profit=sum(d,"contribution_profit"),reported=sum(d,"platform_purchase_value");
  return {gross,net,orders,adSpend,cogs,fulfillment,fees,variable,refunds,expenses,preAd,profit,reported,margin:net?profit/net:0,mer:adSpend?net/adSpend:0,platformRoas:adSpend?reported/adSpend:0,aov:orders?net/orders:0,cpa:orders?adSpend/orders:0,profitOrder:orders?profit/orders:0,breakEvenRoas:preAd>0?net/preAd:0};
}

function metric(label,value,sub="",tone=""){return '<div class="metric '+tone+'"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(sub)+'</small></div>'}

function render(){
  const s=summary(),currency=state.store?.currency||"USD";
  $("hero-profit").textContent=money(s.profit,currency);
  $("hero-margin").textContent=pct(s.margin)+" margin";
  $("hero-profit-order").textContent=money(s.profitOrder,currency)+" / order";
  const health=s.margin>=.25?"Strong":s.margin>=.1?"Watch":s.profit>=0?"Thin":"Losing";
  $("profit-health").textContent=health;$("profit-health").className=s.profit<0?"negative":"";
  $("setup-banner").classList.toggle("hidden",state.orders.length>0||state.integrations.length>0);

  $("overview-metrics").innerHTML=[
    metric("Net revenue",money(s.net,currency),s.orders+" orders"),
    metric("Ad spend",money(s.adSpend,currency),money(s.cpa,currency)+" blended CPA"),
    metric("Blended MER",s.mer.toFixed(2)+"×","Shopify revenue ÷ ad spend"),
    metric("Reported ROAS",s.platformRoas.toFixed(2)+"×","Across ad platforms"),
    metric("Break-even ROAS",s.breakEvenRoas.toFixed(2)+"×",s.mer>=s.breakEvenRoas?"Above break-even":"Below break-even",s.mer>=s.breakEvenRoas?"good":"bad"),
    metric("COGS",money(s.cogs,currency),s.net?(s.cogs/s.net*100).toFixed(1)+"% of revenue":"0%")
  ].join("");

  renderTrend();
  renderAlerts(s);
  renderPlatforms();
  renderTopAds();
  renderProfit(s,currency);
  renderAds();
  renderOrders(currency);
  renderProducts(currency);
  renderExpenses(currency);
  renderSettings();
  renderHealth();
}

function renderTrend(){
  const rows=[...state.daily].sort((a,b)=>a.day.localeCompare(b.day)),max=Math.max(1,...rows.map(x=>Math.max(n(x.net_revenue),Math.abs(n(x.contribution_profit)),n(x.ad_spend))));
  $("trend-chart").innerHTML=rows.length?rows.map(x=>{
    const label=new Date(x.day+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
    return '<div class="chart-day"><div class="chart-bars"><i class="rev" title="Revenue '+money(x.net_revenue)+'" style="height:'+Math.max(2,n(x.net_revenue)/max*100)+'%"></i><i class="prof '+(n(x.contribution_profit)<0?"neg":"")+'" title="Profit '+money(x.contribution_profit)+'" style="height:'+Math.max(2,Math.abs(n(x.contribution_profit))/max*100)+'%"></i><i class="spend" title="Ad spend '+money(x.ad_spend)+'" style="height:'+Math.max(2,n(x.ad_spend)/max*100)+'%"></i></div><small>'+label+'</small></div>'
  }).join(""):'<div class="empty">Sync Shopify and ads to see the profit trend.</div>';
}

function renderAlerts(s){
  const alerts=[];
  if(!state.orders.length)alerts.push(["warn","Shopify order data is missing","Connect and sync Shopify so Profit Tracker can calculate real revenue and COGS."]);
  if(!state.ads.length)alerts.push(["warn","No ad spend in this date range","Connect Meta or import another ad platform CSV to calculate profit after advertising."]);
  if(s.profit<0)alerts.push(["bad","You are below contribution break-even","Selected-period contribution profit is "+money(s.profit)+"."]);
  else if(s.margin>0.25)alerts.push(["good","Healthy contribution margin",pct(s.margin)+" remains after product, operating and ad costs."]);
  if(s.adSpend&&s.mer<s.breakEvenRoas)alerts.push(["bad","Blended MER is below break-even",s.mer.toFixed(2)+"× blended MER vs "+s.breakEvenRoas.toFixed(2)+"× break-even ROAS."]);
  else if(s.adSpend)alerts.push(["good","Blended advertising is above break-even",s.mer.toFixed(2)+"× MER vs "+s.breakEvenRoas.toFixed(2)+"× break-even ROAS."]);
  if(Math.abs(s.platformRoas-s.mer)>.5&&s.adSpend)alerts.push(["warn","Platform attribution disagrees with store revenue","Reported ROAS is "+s.platformRoas.toFixed(2)+"× while blended MER is "+s.mer.toFixed(2)+"×. Treat attributed revenue as directional."]);
  $("alerts").innerHTML=alerts.slice(0,4).map(a=>'<div class="alert '+a[0]+'"><i></i><div><b>'+esc(a[1])+'</b><p>'+esc(a[2])+'</p></div></div>').join("")||'<div class="empty">No alerts yet.</div>';
}

function platformAgg(){
  const map={};
  state.ads.forEach(a=>{const p=a.provider||"other";map[p]||={provider:p,spend:0,revenue:0,purchases:0,impressions:0,clicks:0};map[p].spend+=n(a.spend);map[p].revenue+=n(a.purchase_value);map[p].purchases+=n(a.purchases);map[p].impressions+=n(a.impressions);map[p].clicks+=n(a.clicks)});
  return Object.values(map).sort((a,b)=>b.spend-a.spend);
}
function renderPlatforms(){
  const arr=platformAgg();
  $("platform-cards").innerHTML=arr.length?arr.map(p=>'<div class="platform-card"><div class="platform-title"><b>'+esc(p.provider)+'</b><span>'+money(p.spend)+' spend</span></div><div class="platform-value">'+(p.spend?p.revenue/p.spend:0).toFixed(2)+'×</div><div class="platform-sub"><span>reported ROAS</span><span>'+Math.round(p.purchases)+' purchases</span></div></div>').join(""):'<div class="empty">No ad platforms connected yet.</div>';
}

function adAgg(){
  const map={};
  state.ads.forEach(a=>{const key=(a.provider||"other")+"|"+(a.ad_id||a.campaign_id||a.ad_name);map[key]||={provider:a.provider||"other",ad_name:a.ad_name||"Unnamed ad",campaign_name:a.campaign_name||"",spend:0,revenue:0,purchases:0,impressions:0,clicks:0};const x=map[key];x.spend+=n(a.spend);x.revenue+=n(a.purchase_value);x.purchases+=n(a.purchases);x.impressions+=n(a.impressions);x.clicks+=n(a.clicks)});
  return Object.values(map).sort((a,b)=>b.spend-a.spend);
}
function signal(roas){return roas>=3?"scale":roas>=2?"hold":roas>=1.5?"watch":"kill"}
function renderTopAds(){
  $("top-ads-body").innerHTML=adAgg().slice(0,8).map(a=>{const r=a.spend?a.revenue/a.spend:0;return '<tr><td><b>'+esc(a.ad_name)+'</b></td><td><span class="provider">'+esc(a.provider)+'</span></td><td>'+money(a.spend)+'</td><td>'+money(a.revenue)+'</td><td>'+r.toFixed(2)+'×</td><td>'+Math.round(a.purchases)+'</td><td><span class="signal '+signal(r)+'">'+signal(r)+'</span></td></tr>'}).join("")||'<tr><td colspan="7" class="empty">No ad data yet.</td></tr>';
}

function renderProfit(s,c){
  $("profit-metrics").innerHTML=[metric("Gross sales",money(s.gross,c)),metric("Net revenue",money(s.net,c)),metric("Pre-ad contribution",money(s.preAd,c)),metric("Ad spend",money(s.adSpend,c)),metric("True profit",money(s.profit,c),"",s.profit>=0?"good":"bad"),metric("Margin",pct(s.margin))].join("");
  const rows=[["Gross sales",s.gross,"plus"],["Discounts",-sum(state.daily,"discounts"),"minus"],["Refunds",-s.refunds,"minus"],["COGS",-s.cogs,"minus"],["Fulfillment",-s.fulfillment,"minus"],["Payment fees",-s.fees,"minus"],["Variable costs",-s.variable,"minus"],["Ad spend",-s.adSpend,"minus"],["Operating expenses",-s.expenses,"minus"],["True contribution profit",s.profit,"total"]];
  const max=Math.max(1,s.gross);
  $("waterfall").innerHTML=rows.map(r=>'<div class="water-row '+r[2]+'"><span>'+esc(r[0])+'</span><div class="water-track"><i style="width:'+Math.min(100,Math.abs(r[1])/max*100)+'%"></i></div><b>'+(r[1]<0?"−":"")+money(Math.abs(r[1]),c)+'</b></div>').join("");
}

function renderAds(){
  const providers=["all",...new Set(state.ads.map(a=>a.provider||"other"))];
  $("platform-filter").innerHTML=providers.map(p=>'<button data-provider="'+esc(p)+'" class="'+(state.provider===p?"active":"")+'">'+esc(p)+'</button>').join("");
  $("platform-filter").querySelectorAll("button").forEach(b=>b.onclick=()=>{state.provider=b.dataset.provider;renderAds()});
  const arr=adAgg().filter(a=>state.provider==="all"||a.provider===state.provider);
  const spend=arr.reduce((s,a)=>s+a.spend,0),rev=arr.reduce((s,a)=>s+a.revenue,0),p=arr.reduce((s,a)=>s+a.purchases,0),clicks=arr.reduce((s,a)=>s+a.clicks,0);
  $("ads-metrics").innerHTML=[metric("Spend",money(spend)),metric("Reported revenue",money(rev)),metric("Reported ROAS",(spend?rev/spend:0).toFixed(2)+"×"),metric("Purchases",Math.round(p).toString()),metric("Reported CPA",money(p?spend/p:0)),metric("CPC",money(clicks?spend/clicks:0))].join("");
  $("ads-body").innerHTML=arr.map(a=>{const r=a.spend?a.revenue/a.spend:0;return '<tr><td><b>'+esc(a.ad_name)+'</b></td><td><span class="provider">'+esc(a.provider)+'</span></td><td>'+esc(a.campaign_name)+'</td><td>'+money(a.spend)+'</td><td>'+Math.round(a.purchases)+'</td><td>'+money(a.revenue)+'</td><td>'+r.toFixed(2)+'×</td><td>'+money(a.purchases?a.spend/a.purchases:0)+'</td></tr>'}).join("")||'<tr><td colspan="8" class="empty">No matching ads.</td></tr>';
}

function renderOrders(c){
  const arr=state.orders;
  const rev=sum(arr,"net_revenue"),profit=sum(arr,"blended_contribution_profit"),fees=sum(arr,"payment_fees"),cogs=sum(arr,"cogs");
  $("orders-metrics").innerHTML=[metric("Orders",arr.length.toString()),metric("Revenue",money(rev,c)),metric("Blended profit",money(profit,c),"",profit>=0?"good":"bad"),metric("COGS",money(cogs,c)),metric("Payment fees",money(fees,c)),metric("Profit / order",money(arr.length?profit/arr.length:0,c))].join("");
  $("orders-body").innerHTML=arr.map(o=>'<tr><td><b>'+esc(o.order_name)+'</b></td><td>'+new Date(o.created_at).toLocaleString()+'</td><td>'+money(o.net_revenue,c)+'</td><td>'+money(o.cogs,c)+'</td><td>'+money(o.fulfillment_cost,c)+'</td><td>'+money(o.payment_fees,c)+'</td><td>'+money(o.blended_ad_cost,c)+'</td><td class="'+(n(o.blended_contribution_profit)>=0?"positive":"negative")+'"><b>'+money(o.blended_contribution_profit,c)+'</b></td></tr>').join("")||'<tr><td colspan="8" class="empty">No Shopify orders synced.</td></tr>';
}

function renderProducts(c){
  $("product-grid").innerHTML=state.products.length?state.products.map(p=>'<article class="product-card"><p class="kicker">PRODUCT ECONOMICS</p><h2>'+esc(p.product_title)+'</h2><div class="product-profit">'+money(p.gross_contribution,c)+'</div><small>gross contribution before fulfillment & ads</small><div class="mini-grid"><div class="mini-stat"><span>Revenue</span><b>'+money(p.net_revenue,c)+'</b></div><div class="mini-stat"><span>Orders</span><b>'+p.orders+'</b></div><div class="mini-stat"><span>Break-even CPA*</span><b>'+money(p.break_even_cpa_before_fulfillment,c)+'</b></div><div class="mini-stat"><span>Break-even ROAS*</span><b>'+n(p.break_even_roas_before_fulfillment).toFixed(2)+'×</b></div></div></article>').join(""):'<div class="empty">Sync Shopify to see product economics.</div>';
}

function renderExpenses(c){
  $("expense-list").innerHTML=state.expenses.length?state.expenses.map(x=>'<div class="list-row"><div><b>'+esc(x.label)+'</b><small>'+esc(x.day)+' · '+esc(x.category)+'</small></div><b>'+money(x.amount,c)+'</b></div>').join(""):'<div class="empty">No expenses in this date range.</div>';
}

function renderSettings(){
  const by={};state.integrations.forEach(x=>by[x.provider]=x);
  const sh=by.shopify,me=by.meta;
  $("shopify-status").textContent=sh?"Connected":"Not connected";$("shopify-status").classList.toggle("good",!!sh);
  $("meta-status").textContent=me?"Connected":"Not connected";$("meta-status").classList.toggle("good",!!me);
  $("integration-list").innerHTML=state.integrations.length?state.integrations.map(x=>'<div class="integration-row"><div><b>'+esc(x.provider)+'</b><small>'+(x.last_sync_at?"Last synced "+new Date(x.last_sync_at).toLocaleString():"Connected · never synced")+'</small></div><span class="status-badge '+(x.last_error?"":"good")+'">'+(x.last_error?"Error":"Connected")+'</span></div>').join(""):'<div class="empty">No API connections yet.</div>';
}

function renderHealth(){
  const synced=state.integrations.some(x=>x.last_sync_at);
  $("health-dot").classList.toggle("good",synced);
  $("health-title").textContent=synced?"Data syncing":"Setup incomplete";
  const last=state.integrations.map(x=>x.last_sync_at).filter(Boolean).sort().pop();
  $("health-sub").textContent=last?"Last sync "+new Date(last).toLocaleString():"Connect Shopify + ads";
}

$("shopify-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const j=await invoke("saveShopify",Object.fromEntries(f));toast(j.message);await loadAll()}catch(err){toast(err.message,"bad")}};
$("meta-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const j=await invoke("saveMeta",Object.fromEntries(f));toast(j.message);await loadAll()}catch(err){toast(err.message,"bad")}};
$("sync-shopify").onclick=()=>sync("syncShopify",$("sync-shopify"));
$("sync-meta").onclick=()=>sync("syncMeta",$("sync-meta"));
async function sync(action,btn){const old=btn.textContent;btn.disabled=true;btn.textContent="Syncing…";try{const j=await invoke(action);toast(j.message);await loadAll()}catch(err){toast(err.message,"bad")}finally{btn.disabled=false;btn.textContent=old}}

$("expense-form").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await invoke("addExpense",f);toast("Expense added");e.target.reset();await loadData();render()}catch(err){toast(err.message,"bad")}};
$("cost-form").onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));try{await invoke("saveCostRule",f);toast("Cost rule saved");e.target.reset()}catch(err){toast(err.message,"bad")}};

$("import-btn").onclick=async()=>{
  const file=$("import-file").files[0],provider=$("import-provider").value;if(!file)return toast("Choose a CSV file","bad");
  try{const rows=parseCSV(await file.text());const j=await invoke("importAds",{provider,rows});toast(j.message);await loadData();render()}catch(err){toast(err.message,"bad")}
};
function parseCSV(text){
  const lines=text.replace(/\r/g,"").split("\n").filter(Boolean);if(lines.length<2)return[];
  const split=line=>{const out=[];let v="",q=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch=='"'){if(q&&line[i+1]=='"'){v+='"';i++}else q=!q}else if(ch==","&&!q){out.push(v.trim());v=""}else v+=ch}out.push(v.trim());return out};
  const h=split(lines[0]).map(x=>x.toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,""));
  return lines.slice(1).map(line=>{const vals=split(line),o={};h.forEach((k,i)=>o[k]=vals[i]??"");return o});
}

sb.auth.onAuthStateChange(async(event,session)=>{state.session=session;if(event==="SIGNED_OUT")showAuth(true)});
boot();