const SUPABASE_URL="https://mujnjfllyklnuydoiotj.supabase.co";
const SUPABASE_KEY="sb_publishable_Ow4gfh354q6hFXNtkEVIqg_VGUEbvqL";
const sb=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const API=SUPABASE_URL+"/functions/v1/profit-api";

const state={session:null,store:null,stores:[],addingStore:false,editingShopify:false,daily:[],dailyAll:[],previousDaily:[],ads:[],orders:[],products:[],expenses:[],creatives:[],customerDaily:[],customerSummary:null,subscriptions:[],subscriptionSummary:null,subscriptionStatuses:[],cohortMonthly:[],cohortWeekly:[],anomalyAlerts:[],attributionSummary:[],integrations:[],runs:[],range:7,provider:"all",authMode:"signin"};

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
  const r=await fetch(API,{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+token,"apikey":SUPABASE_KEY},body:JSON.stringify({action,store_id:state.store?.id||null,...payload})});
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
  $("page-kicker").textContent=({overview:"FINANCIAL TRUTH",profit:"CONTRIBUTION ECONOMICS",ads:"MEDIA PERFORMANCE",creatives:"CREATIVE ECONOMICS",customers:"CUSTOMER ECONOMICS",subscriptions:"SUBSCRIPTION ECONOMICS",orders:"ORDER ECONOMICS",products:"PRODUCT ECONOMICS",expenses:"COST CONTROL",settings:"DATA CONNECTIONS"})[page]||"PROFIT TRACKER";
}

$("range-select").onchange=async e=>{state.range=Number(e.target.value);await loadData();render()};
$("refresh-btn").onclick=async()=>{await loadAll();toast("Dashboard refreshed")};
if($("store-select"))$("store-select").onchange=async e=>{
  const id=e.target.value;if(!id||id==="No store")return;
  localStorage.setItem("pt_store_id",id);
  state.addingStore=false;state.editingShopify=false;
  await loadAll(id);
};

async function loadAll(preferredStoreId=null){
  try{
    const saved=preferredStoreId||localStorage.getItem("pt_store_id")||state.store?.id||null;
    const status=await invoke("getStatus",{store_id:saved});
    state.store=status.store;state.stores=status.stores||[];state.integrations=status.integrations||[];state.runs=status.runs||[];
    if(state.store?.id)localStorage.setItem("pt_store_id",state.store.id);
    $("brand-store").textContent=state.store?.name||"My Store";
    renderStoreSwitcher();
    await loadData();render();
  }catch(err){toast(err.message,"bad")}
}
function renderStoreSwitcher(){
  const sel=$("store-select");if(!sel)return;
  sel.innerHTML=(state.stores||[]).map(s=>'<option value="'+esc(s.id)+'" '+(s.id===state.store?.id?"selected":"")+'>'+esc(s.name||s.shop_domain||"Store")+'</option>').join("");
  if(!(state.stores||[]).length)sel.innerHTML='<option>No store</option>';
}


async function loadData(){
  const extendedDays=Math.max(state.range*2,30);
  const extendedStart=isoStart(extendedDays);
  const currentStart=isoStart(state.range);
  const storeId=state.store?.id;if(!storeId)return;
  const [dailyAll,ads,orders,products,expenses,creatives,customerDaily,customerSummary,subscriptions,subscriptionSummary,subscriptionStatuses,cohortMonthly,cohortWeekly,anomalyAlerts,attributionSummary]=await Promise.all([
    sb.from("daily_profit").select("*").eq("store_id",storeId).gte("day",extendedStart).order("day"),
    sb.from("ad_daily").select("*").eq("store_id",storeId).gte("day",currentStart).order("spend",{ascending:false}),
    sb.from("order_profitability").select("*").eq("store_id",storeId).gte("created_at",currentStart+"T00:00:00Z").order("created_at",{ascending:false}).limit(500),
    sb.from("product_profitability").select("*").eq("store_id",storeId).order("gross_contribution",{ascending:false}).limit(100),
    sb.from("expenses").select("*").eq("store_id",storeId).gte("day",currentStart).order("day",{ascending:false}),
    sb.from("creative_profitability").select("*").eq("store_id",storeId).order("profit",{ascending:false}).limit(300),
    sb.from("customer_economics_daily").select("*").eq("store_id",storeId).gte("day",extendedStart).order("day"),
    sb.from("customer_summary").select("*").eq("store_id",storeId).maybeSingle(),
    sb.from("subscription_contract_economics").select("*").eq("store_id",storeId).order("ltv_contribution_profit",{ascending:false}).limit(300),
    sb.from("subscription_summary").select("*").eq("store_id",storeId).maybeSingle(),
    sb.from("subscription_contract_status").select("*").eq("store_id",storeId),
    sb.from("subscription_cohorts_monthly").select("*").eq("store_id",storeId).order("cohort_month").order("period_index"),
    sb.from("subscription_cohorts_weekly").select("*").eq("store_id",storeId).order("cohort_week").order("period_index"),
    sb.from("profit_anomaly_alerts").select("*").eq("store_id",storeId).gte("day",extendedStart).order("day",{ascending:false}).limit(20),
    sb.from("attribution_summary").select("*").eq("store_id",storeId)
  ]);
  for(const x of [dailyAll,ads,orders,products,expenses,creatives,customerDaily,customerSummary,subscriptions,subscriptionSummary,subscriptionStatuses,cohortMonthly,cohortWeekly,anomalyAlerts,attributionSummary])if(x.error)console.warn(x.error);
  state.dailyAll=dailyAll.data||[];
  state.daily=state.dailyAll.filter(x=>x.day>=currentStart);
  const prevEnd=new Date(new Date(currentStart+"T00:00:00Z").getTime()-86400000).toISOString().slice(0,10);
  const prevStart=new Date(new Date(currentStart+"T00:00:00Z").getTime()-state.range*86400000).toISOString().slice(0,10);
  state.previousDaily=state.dailyAll.filter(x=>x.day>=prevStart&&x.day<=prevEnd);
  state.ads=ads.data||[];state.orders=orders.data||[];state.products=products.data||[];state.expenses=expenses.data||[];
  state.creatives=creatives.data||[];
  state.customerDaily=(customerDaily.data||[]).filter(x=>x.day>=currentStart);
  state.customerSummary=customerSummary.data||null;
  state.subscriptions=subscriptions.data||[];
  state.subscriptionSummary=subscriptionSummary.data||null;
  state.subscriptionStatuses=subscriptionStatuses.data||[];
  state.cohortMonthly=cohortMonthly.data||[];
  state.cohortWeekly=cohortWeekly.data||[];
  state.anomalyAlerts=anomalyAlerts.data||[];
  state.attributionSummary=attributionSummary.data||[];
}
function summary(rows=state.daily){
  const d=rows;
  const gross=sum(d,"gross_sales"),net=sum(d,"net_revenue"),orders=sum(d,"orders"),adSpend=sum(d,"ad_spend"),cogs=sum(d,"cogs"),fulfillment=sum(d,"fulfillment_cost"),fees=sum(d,"payment_fees"),variable=sum(d,"variable_costs"),refunds=sum(d,"refunds"),expenses=sum(d,"expenses"),preAd=sum(d,"pre_ad_contribution"),profit=sum(d,"contribution_profit"),reported=sum(d,"platform_purchase_value");
  return {gross,net,orders,adSpend,cogs,fulfillment,fees,variable,refunds,expenses,preAd,profit,reported,margin:net?profit/net:0,mer:adSpend?net/adSpend:0,platformRoas:adSpend?reported/adSpend:0,aov:orders?net/orders:0,cpa:orders?adSpend/orders:0,profitOrder:orders?profit/orders:0,breakEvenRoas:preAd>0?net/preAd:0};
}

function metric(label,value,sub="",tone=""){return '<button type="button" class="metric metric-click '+tone+'" data-metric="'+esc(label)+'"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(sub)+'</small></button>'}

function render(){
  const s=summary(),currency=state.store?.currency||"USD";
  $("hero-profit").textContent=money(s.profit,currency);
  $("hero-margin").textContent=pct(s.margin)+" margin";
  $("hero-profit-order").textContent=money(s.profitOrder,currency)+" / order";
  const health=s.margin>=.25?"Strong":s.margin>=.1?"Watch":s.profit>=0?"Thin":"Losing";
  $("profit-health").textContent=health;$("profit-health").className=s.profit<0?"negative":"";
  $("setup-banner").classList.toggle("hidden",state.orders.length>0||state.integrations.length>0);

  renderComparisons(currency);
  $("overview-metrics").innerHTML=[
    metric("Net revenue",money(s.net,currency),s.orders+" real order"+(s.orders===1?"":"s")+" · test orders excluded"),
    metric("Ad spend",money(s.adSpend,currency),money(s.cpa,currency)+" blended CPA"),
    metric("Blended MER",s.mer.toFixed(2)+"×","Shopify revenue ÷ all ad spend"),
    metric("Reported ROAS",s.platformRoas.toFixed(2)+"×","Platform-reported attribution"),
    metric("Break-even ROAS",s.breakEvenRoas.toFixed(2)+"×",s.mer>=s.breakEvenRoas?"Above break-even":"Below break-even",s.mer>=s.breakEvenRoas?"good":"bad"),
    metric("AOV",money(s.aov,currency),pct(s.margin)+" contribution margin")
  ].join("");

  renderTrend();
  renderTrendMetrics(currency);
  renderAlerts(s);
  renderPlatforms();
  renderTopAds();
  renderProfit(s,currency);
  renderAds();
  renderCreatives(currency);
  renderCustomers(currency);
  renderSubscriptions(currency);
  renderCohorts(currency);
  renderOrders(currency);
  renderProducts(currency);
  renderExpenses(currency);
  renderSettings();
  renderHealth();
  attachMetricExplainers();
}
function delta(current,previous){
  if(!previous)return current?100:0;
  return ((current-previous)/Math.abs(previous))*100;
}
function deltaText(current,previous){
  const d=delta(current,previous);
  if(!isFinite(d))return "—";
  return (d>=0?"+":"")+d.toFixed(1)+"%";
}
function renderComparisons(currency){
  const rows=[...state.dailyAll].sort((a,b)=>a.day.localeCompare(b.day));
  const byDay=Object.fromEntries(rows.map(x=>[x.day,x]));
  const today=new Date().toISOString().slice(0,10);
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);
  const lastWeek=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const t=summary(byDay[today]?[byDay[today]]:[]);
  const y=summary(byDay[yesterday]?[byDay[yesterday]]:[]);
  const lw=summary(byDay[lastWeek]?[byDay[lastWeek]]:[]);
  const curr7=summary(rows.filter(x=>x.day>=isoStart(7)));
  const prev7Start=new Date(Date.now()-13*86400000).toISOString().slice(0,10);
  const prev7End=new Date(Date.now()-7*86400000).toISOString().slice(0,10);
  const prev7=summary(rows.filter(x=>x.day>=prev7Start&&x.day<=prev7End));
  $("comparison-strip").innerHTML=[
    '<div class="comparison"><span>Today vs yesterday</span><b class="'+(t.profit>=y.profit?"positive":"negative")+'">'+deltaText(t.profit,y.profit)+' profit</b><small>'+money(t.profit,currency)+' today</small></div>',
    '<div class="comparison"><span>Today vs same weekday last week</span><b class="'+(t.net>=lw.net?"positive":"negative")+'">'+deltaText(t.net,lw.net)+' revenue</b><small>'+money(t.net,currency)+' today</small></div>',
    '<div class="comparison"><span>Last 7 vs previous 7</span><b class="'+(curr7.profit>=prev7.profit?"positive":"negative")+'">'+deltaText(curr7.profit,prev7.profit)+' profit</b><small>'+deltaText(curr7.net,prev7.net)+' revenue</small></div>'
  ].join("");
}

const metricInfo={
  "Net revenue":{formula:"Gross sales − discounts − refunds + shipping revenue.",sources:["Shopify orders","Shopify refunds","Shipping collected"]},
  "Ad spend":{formula:"Sum of spend across every connected/imported ad platform.",sources:["Meta Ads","Google/TikTok/etc imports or APIs"]},
  "Blended MER":{formula:"Shopify net revenue ÷ total ad spend. This does not depend on platform attribution.",sources:["Shopify financial ledger","All advertising platforms"]},
  "Reported ROAS":{formula:"Platform-reported purchase value ÷ platform spend. Useful directionally, but not treated as financial truth.",sources:["Meta/Google/TikTok reported attribution"]},
  "Break-even ROAS":{formula:"Net revenue ÷ pre-ad contribution. It estimates the ROAS required for contribution profit to reach zero.",sources:["Shopify revenue","COGS","Fulfillment","Payment fees","Variable costs"]},
  "AOV":{formula:"Net revenue ÷ orders.",sources:["Shopify orders"]},
  "True profit":{formula:"Net revenue − COGS − fulfillment − payment fees − variable costs − ad spend − operating expenses.",sources:["Shopify","Ad platforms","Profit Tracker cost rules"]},
  "Margin":{formula:"True contribution profit ÷ net revenue.",sources:["Profit Tracker contribution ledger"]},
  "Spend":{formula:"Total advertising spend in the selected period.",sources:["Ad platform ledger"]},
  "Reported revenue":{formula:"Purchase/conversion value reported by the ad platform.",sources:["Ad platform attribution"]},
  "Reported CPA":{formula:"Ad spend ÷ platform-reported purchases.",sources:["Ad platform ledger"]},
  "CPC":{formula:"Ad spend ÷ clicks.",sources:["Ad platform ledger"]},
  "Orders":{formula:"Count of Shopify orders in the selected period.",sources:["Shopify"]},
  "Revenue":{formula:"Net Shopify revenue in the selected period.",sources:["Shopify"]},
  "Blended profit":{formula:"Order pre-ad contribution minus blended share of that day's ad spend.",sources:["Shopify","All ad platforms"]},
  "COGS":{formula:"Quantity × Shopify variant unit cost or configured override.",sources:["Shopify inventory cost","Profit Tracker override"]},
  "Payment fees":{formula:"Actual Shopify transaction fees when available. If Shopify does not return a fee, Profit Tracker estimates it from the detected Shopify plan and labels it Estimated.",sources:["Shopify transactions","Detected Shopify plan"]},
  "Profit / order":{formula:"Total blended contribution profit ÷ order count.",sources:["Profit Tracker order ledger"]}
};
function attachMetricExplainers(){
  document.querySelectorAll(".metric-click").forEach(el=>el.onclick=()=>{
    const label=el.dataset.metric||"Metric",info=metricInfo[label]||{formula:"Calculated from the live Profit Tracker ledger.",sources:["Profit Tracker"]};
    $("metric-drawer-title").textContent=label;
    $("metric-drawer-value").textContent=el.querySelector("b")?.textContent||"";
    $("metric-drawer-formula").textContent=info.formula;
    $("metric-drawer-sources").innerHTML='<b>Data sources</b>'+info.sources.map(x=>'<span>'+esc(x)+'</span>').join("");
    $("metric-drawer").classList.remove("hidden");
  });
}
$("metric-drawer-close").onclick=()=>$("metric-drawer").classList.add("hidden");

function renderCreatives(currency){
  const arr=state.creatives||[];
  const spend=sum(arr,"spend"),orders=sum(arr,"orders"),revenue=sum(arr,"revenue"),profit=sum(arr,"profit");
  $("creative-metrics").innerHTML=[
    metric("Spend",money(spend,currency),arr.length+" creatives"),
    metric("Orders",Math.round(orders).toString(),"Shopify-attributed"),
    metric("Revenue",money(revenue,currency),"Attributed Shopify revenue"),
    metric("True profit",money(profit,currency),"After creative spend",profit>=0?"good":"bad"),
    metric("Margin",pct(revenue?profit/revenue:0),"Creative contribution margin"),
    metric("CPA",money(orders?spend/orders:0,currency),"Spend ÷ attributed orders")
  ].join("");
  $("creative-grid").innerHTML=arr.length?arr.map(x=>{
    const thumb=x.thumbnail_url||x.media_url||"";
    const media=thumb?'<img src="'+esc(thumb)+'" loading="lazy" referrerpolicy="no-referrer" alt="">':'<div class="creative-placeholder">'+esc((x.media_type||x.format||"AD").toUpperCase())+'</div>';
    const strength=x.data_strength||"early";
    return '<article class="creative-card">'+
      '<div class="creative-media">'+media+'<span class="provider">'+providerIcon(x.provider||"unknown")+' '+esc(x.provider||"unknown")+'</span></div>'+
      '<div class="creative-body"><div class="creative-head"><div><b>'+esc(x.ad_name||"Unnamed creative")+'</b><small>'+esc(x.campaign_name||"")+'</small></div><span class="signal '+esc(x.recommendation||"watch")+'">'+esc(x.recommendation||"watch")+'</span></div>'+
      '<div class="decision-note"><b>'+esc(strength)+' data</b><span>'+esc(x.decision_reason||"Waiting for enough spend and orders.")+'</span></div>'+
      '<div class="creative-kpis"><div><span>Spend</span><b>'+money(x.spend,currency)+'</b></div><div><span>Orders</span><b>'+x.orders+'</b></div><div><span>Revenue</span><b>'+money(x.revenue,currency)+'</b></div><div><span>CPA</span><b>'+money(x.cpa,currency)+'</b></div><div><span>Break-even CPA</span><b>'+money(x.break_even_cpa||x.store_break_even_cpa,currency)+'</b></div><div><span>True ROAS</span><b>'+n(x.true_roas).toFixed(2)+'×</b></div><div><span>Profit</span><b class="'+(n(x.profit)>=0?"positive":"negative")+'">'+money(x.profit,currency)+'</b></div><div><span>Confidence</span><b>'+pct(x.attribution_confidence)+'</b></div></div>'+
      '<div class="creative-tags"><span>Hook: '+esc(x.hook||"Not tagged")+'</span><span>Angle: '+esc(x.angle||"Not tagged")+'</span><span>Format: '+esc(x.format||x.media_type||"Unknown")+'</span><span>'+esc(String(x.days_running||1))+' days running</span><span>'+n(x.view_through_orders)+' view-through</span></div>'+
      '</div></article>';
  }).join(""):'<div class="empty">Sync ad data and Shopify attribution to populate creative profit.</div>';

  const coverage=Object.fromEntries((state.attributionSummary||[]).map(x=>[x.model,x]));
  const det=coverage.deterministic||{},blend=coverage.blended||{},modeled=coverage.modeled||{};
  $("attribution-coverage").innerHTML=[
    '<div class="coverage"><span>Deterministic orders</span><b>'+n(det.attributed_orders)+'</b><small>'+pct(det.avg_confidence||0)+' avg confidence</small></div>',
    '<div class="coverage"><span>First-party session matches</span><b>'+n(det.first_party_session_matches)+'</b><small>Session/cart evidence</small></div>',
    '<div class="coverage"><span>Modeled orders</span><b>'+n(modeled.attributed_orders)+'</b><small>'+pct(modeled.avg_confidence||0)+' avg confidence</small></div>',
    '<div class="coverage"><span>View-through matches</span><b>'+n(blend.view_through_orders||det.view_through_orders)+'</b><small>Only counted when a provider supplies deterministic post-view evidence</small></div>',
    '<div class="coverage"><span>Blended coverage</span><b>'+n(blend.attributed_orders)+'</b><small>'+money(blend.attributed_revenue||0,currency)+' revenue mapped</small></div>'
  ].join("");
}
function renderCustomers(currency){
  const rows=state.customerDaily||[],cs=state.customerSummary||{};
  const newOrders=sum(rows,"new_orders"),retOrders=sum(rows,"returning_orders"),newRev=sum(rows,"new_revenue"),retRev=sum(rows,"returning_revenue"),adSpend=sum(rows,"ad_spend"),newProfit=sum(rows,"new_customer_profit");
  const newCpa=newOrders?adSpend/newOrders:0,newRoas=adSpend?newRev/adSpend:0,newMargin=newRev?newProfit/newRev:0;
  $("customer-metrics").innerHTML=[
    metric("New customer CPA",money(newCpa,currency),"All spend ÷ new orders"),
    metric("Returning revenue",money(retRev,currency),retOrders+" returning orders"),
    metric("New customer profit",money(newProfit,currency),"After acquisition spend",newProfit>=0?"good":"bad"),
    metric("Repeat purchase rate",pct(cs.repeat_purchase_rate||0),n(cs.repeat_customers)+" repeat customers"),
    metric("New customer ROAS",newRoas.toFixed(2)+"×","New-customer revenue ÷ ad spend"),
    metric("New customer margin",pct(newMargin),"After acquisition spend")
  ].join("");
  $("new-customer-panel").innerHTML='<div class="customer-big">'+money(newProfit,currency)+'</div><p class="muted">New-customer contribution profit after all advertising spend.</p><div class="mini-grid"><div class="mini-stat"><span>New orders</span><b>'+newOrders+'</b></div><div class="mini-stat"><span>CPA</span><b>'+money(newCpa,currency)+'</b></div><div class="mini-stat"><span>Revenue</span><b>'+money(newRev,currency)+'</b></div><div class="mini-stat"><span>ROAS</span><b>'+newRoas.toFixed(2)+'×</b></div></div>';
  $("returning-customer-panel").innerHTML='<div class="customer-big">'+money(retRev,currency)+'</div><p class="muted">Revenue generated by customers after their first order.</p><div class="mini-grid"><div class="mini-stat"><span>Returning orders</span><b>'+retOrders+'</b></div><div class="mini-stat"><span>Repeat rate</span><b>'+pct(cs.repeat_purchase_rate||0)+'</b></div><div class="mini-stat"><span>Avg LTV</span><b>'+money(cs.avg_customer_ltv||0,currency)+'</b></div><div class="mini-stat"><span>Orders/customer</span><b>'+n(cs.avg_orders_per_customer).toFixed(2)+'</b></div></div>';
  $("customer-table").innerHTML='<table><thead><tr><th>Date</th><th>New orders</th><th>Returning orders</th><th>New revenue</th><th>Returning revenue</th><th>New CPA</th><th>New profit</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.day)+'</td><td>'+x.new_orders+'</td><td>'+x.returning_orders+'</td><td>'+money(x.new_revenue,currency)+'</td><td>'+money(x.returning_revenue,currency)+'</td><td>'+money(x.blended_new_customer_cpa,currency)+'</td><td class="'+(n(x.new_customer_profit)>=0?"positive":"negative")+'">'+money(x.new_customer_profit,currency)+'</td></tr>').join("")+'</tbody></table>';
}

function renderSubscriptions(currency){
  const ss=state.subscriptionSummary||{},arr=state.subscriptions||[];
  const statusMap=Object.fromEntries((state.subscriptionStatuses||[]).map(x=>[x.subscription_contract_id,x]));
  const confirmedStatuses=(state.subscriptionStatuses||[]).filter(x=>x.status_confirmed);
  const confirmedChurn=confirmedStatuses.filter(x=>["CANCELLED","EXPIRED","FAILED"].includes(String(x.status||"").toUpperCase())).length;
  const churnRate=confirmedStatuses.length?confirmedChurn/confirmedStatuses.length:n(ss.churn_rate||0);
  $("subscription-metrics").innerHTML=[
    metric("Subscriptions",String(n(ss.subscriptions)),"Detected Shopify selling-plan cohorts"),
    metric("Rebill revenue",money(ss.rebill_revenue||0,currency),"Revenue after first order"),
    metric("Churn",pct(churnRate),confirmedStatuses.length?"Confirmed provider status":"Inferred until provider status is available"),
    metric("LTV",money(ss.avg_ltv||0,currency),"Average subscription revenue"),
    metric("30-day profit",money(ss.avg_contribution_30d||0,currency),"Average cohort contribution"),
    metric("CAC payback",ss.avg_cac_payback_days==null?"—":Math.round(n(ss.avg_cac_payback_days))+" days","Average payback")
  ].join("");
  $("subscriptions-body").innerHTML=arr.length?arr.map(x=>{
    const st=statusMap[x.subscription_contract_id];
    const label=st?.status||x.current_status||"Inferred active";
    const confirmed=Boolean(st?.status_confirmed);
    return '<tr><td><b>'+esc(String(x.subscription_contract_id).split("|").slice(-1)[0])+'</b><small>'+new Date(x.first_order_at).toLocaleDateString()+'</small></td>'+
      '<td><span class="status-badge '+(confirmed?"good":"")+'">'+esc(label)+'</span><small>'+(confirmed?"Confirmed":"Inferred")+'</small></td>'+
      '<td>'+x.orders+'</td><td>'+x.rebill_orders+'</td><td>'+money(x.first_order_profit,currency)+'</td><td>'+money(x.rebill_revenue,currency)+'</td><td>'+money(x.ltv_revenue,currency)+'</td><td>'+money(x.contribution_30d,currency)+'</td><td>'+money(x.contribution_60d,currency)+'</td><td>'+money(x.contribution_90d,currency)+'</td><td>'+(x.cac_payback_days==null?"—":x.cac_payback_days+"d")+'</td></tr>';
  }).join(""):'<tr><td colspan="11" class="empty">Sync Shopify to detect subscription orders and rebills.</td></tr>';
}

function cohortHeatmap(rows,labelKey,prefix,currency){
  if(!rows.length)return '<div class="empty">More subscription history is needed for a cohort heatmap.</div>';
  const cohorts=[...new Set(rows.map(x=>x[labelKey]))];
  const maxPeriod=Math.min(8,Math.max(...rows.map(x=>n(x.period_index))));
  const maxAbs=Math.max(1,...rows.map(x=>Math.abs(n(x.contribution))));
  let html='<table class="cohort-table"><thead><tr><th>Cohort</th>';
  for(let p=0;p<=maxPeriod;p++)html+='<th>'+prefix+p+'</th>';
  html+='</tr></thead><tbody>';
  for(const cohort of cohorts){
    html+='<tr><td><b>'+esc(new Date(cohort+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:labelKey==="cohort_week"?"numeric":undefined,year:"2-digit"}))+'</b></td>';
    for(let p=0;p<=maxPeriod;p++){
      const x=rows.find(r=>r[labelKey]===cohort&&n(r.period_index)===p);
      if(!x){html+='<td class="cohort-empty">—</td>';continue}
      const v=n(x.contribution),intensity=Math.min(.85,Math.abs(v)/maxAbs*.75+.1);
      const bg=v>=0?'rgba(88,213,139,'+intensity+')':'rgba(255,111,119,'+intensity+')';
      html+='<td style="background:'+bg+'" title="'+money(v,currency)+' contribution"><b>'+money(v,currency)+'</b><small>'+x.active_subscriptions+' subs</small></td>';
    }
    html+='</tr>';
  }
  return html+'</tbody></table>';
}
function renderCohorts(currency){
  if($("cohort-monthly"))$("cohort-monthly").innerHTML=cohortHeatmap(state.cohortMonthly||[],"cohort_month","M",currency);
  if($("cohort-weekly"))$("cohort-weekly").innerHTML=cohortHeatmap(state.cohortWeekly||[],"cohort_week","W",currency);
}

function renderTrend(){
  const rows=[...state.daily].sort((a,b)=>a.day.localeCompare(b.day)),max=Math.max(1,...rows.map(x=>Math.max(n(x.net_revenue),Math.abs(n(x.contribution_profit)),n(x.ad_spend))));
  $("trend-chart").innerHTML=rows.length?rows.map(x=>{
    const label=new Date(x.day+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"});
    return '<div class="chart-day"><div class="chart-bars"><i class="rev" title="Revenue '+money(x.net_revenue)+'" style="height:'+Math.max(2,n(x.net_revenue)/max*100)+'%"></i><i class="prof '+(n(x.contribution_profit)<0?"neg":"")+'" title="Profit '+money(x.contribution_profit)+'" style="height:'+Math.max(2,Math.abs(n(x.contribution_profit))/max*100)+'%"></i><i class="spend" title="Ad spend '+money(x.ad_spend)+'" style="height:'+Math.max(2,n(x.ad_spend)/max*100)+'%"></i></div><small>'+label+'</small></div>'
  }).join(""):'<div class="empty">Sync Shopify and ads to see the profit trend.</div>';
}

function sparkline(values){
  const vals=values.map(n).filter(Number.isFinite);
  if(vals.length<2)return '<div class="spark-empty">Not enough data</div>';
  const w=220,h=64,p=5,min=Math.min(...vals),max=Math.max(...vals),range=max-min||1;
  const pts=vals.map((v,i)=>((i/(vals.length-1))*(w-p*2)+p).toFixed(1)+','+(h-p-((v-min)/range)*(h-p*2)).toFixed(1)).join(' ');
  return '<svg viewBox="0 0 '+w+' '+h+'" role="img"><polyline points="'+pts+'" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}
function renderTrendMetrics(currency){
  const rows=[...state.daily].sort((a,b)=>a.day.localeCompare(b.day));
  const series={
    cpa:rows.map(x=>n(x.orders)>0?n(x.ad_spend)/n(x.orders):0),
    mer:rows.map(x=>n(x.ad_spend)>0?n(x.net_revenue)/n(x.ad_spend):0),
    margin:rows.map(x=>n(x.net_revenue)>0?n(x.contribution_profit)/n(x.net_revenue):0),
    aov:rows.map(x=>n(x.orders)>0?n(x.net_revenue)/n(x.orders):0),
    becpa:rows.map(x=>n(x.orders)>0?n(x.pre_ad_contribution)/n(x.orders):0)
  };
  const last=a=>a.length?a[a.length-1]:0;
  if($("trend-cpa")){$("trend-cpa").innerHTML=sparkline(series.cpa);$("trend-cpa-value").textContent=money(last(series.cpa),currency)}
  if($("trend-mer")){$("trend-mer").innerHTML=sparkline(series.mer);$("trend-mer-value").textContent=last(series.mer).toFixed(2)+"×"}
  if($("trend-margin")){$("trend-margin").innerHTML=sparkline(series.margin);$("trend-margin-value").textContent=pct(last(series.margin))}
  if($("trend-aov")){$("trend-aov").innerHTML=sparkline(series.aov);$("trend-aov-value").textContent=money(last(series.aov),currency)}
  if($("trend-becpa")){$("trend-becpa").innerHTML=sparkline(series.becpa);$("trend-becpa-value").textContent=money(last(series.becpa),currency)}
}

function renderAlerts(s){
  const alerts=[];
  const latestAuto=(state.anomalyAlerts||[]).slice(0,3);
  latestAuto.forEach(a=>{
    const type=String(a.alert_type||"");
    const map={
      profit_drop:["bad","Profit dropped abnormally","Contribution profit fell well below its recent 7-day baseline."],
      spend_spike_unprofitable:["bad","Spend spiked while profit was negative","Ad spend jumped above its recent baseline without profitable contribution."],
      cpa_spike:["warn","CPA spiked","CPA is materially above its recent 7-day average."],
      mer_drop:["warn","MER dropped","Blended MER fell materially below its recent baseline."]
    };
    if(map[type])alerts.push(map[type]);
  });
  if(!state.orders.length)alerts.push(["warn","Shopify order data is missing","Connect and sync Shopify so Profit Tracker can calculate real revenue and COGS."]);
  if(!state.ads.length)alerts.push(["warn","No ad spend in this date range","Connect Meta, Google or TikTok, or import a CSV."]);
  if(s.profit<0)alerts.push(["bad","You are below contribution break-even","Selected-period contribution profit is "+money(s.profit)+"."]);
  else if(s.margin>0.25)alerts.push(["good","Healthy contribution margin",pct(s.margin)+" remains after product, operating and ad costs."]);
  if(s.adSpend&&s.mer<s.breakEvenRoas)alerts.push(["bad","Blended MER is below break-even",s.mer.toFixed(2)+"× MER vs "+s.breakEvenRoas.toFixed(2)+"× break-even ROAS."]);
  else if(s.adSpend)alerts.push(["good","Blended advertising is above break-even",s.mer.toFixed(2)+"× MER vs "+s.breakEvenRoas.toFixed(2)+"× break-even ROAS."]);
  $("alerts").innerHTML=alerts.slice(0,5).map(a=>'<div class="alert '+a[0]+'"><i></i><div><b>'+esc(a[1])+'</b><p>'+esc(a[2])+'</p></div></div>').join("")||'<div class="empty">No alerts right now.</div>';
}
function providerIcon(provider){
  const p=String(provider||"other").toLowerCase();
  if(p==="meta"||p==="facebook")return '<i class="fa-brands fa-meta"></i>';
  if(p==="google")return '<i class="fa-brands fa-google"></i>';
  if(p==="tiktok")return '<i class="fa-brands fa-tiktok"></i>';
  if(p==="shopify")return '<i class="fa-brands fa-shopify"></i>';
  if(p==="microsoft")return '<i class="fa-brands fa-microsoft"></i>';
  if(p==="reddit")return '<i class="fa-brands fa-reddit-alien"></i>';
  if(p==="x"||p==="twitter")return '<i class="fa-brands fa-x-twitter"></i>';
  if(p==="pinterest")return '<i class="fa-brands fa-pinterest"></i>';
  if(p==="amazon")return '<i class="fa-brands fa-amazon"></i>';
  return '<i class="fa-solid fa-bullhorn"></i>';
}
function platformAgg(){
  const map={};
  state.ads.forEach(a=>{const p=a.provider||"other";map[p]||={provider:p,spend:0,revenue:0,purchases:0,impressions:0,clicks:0};map[p].spend+=n(a.spend);map[p].revenue+=n(a.purchase_value);map[p].purchases+=n(a.purchases);map[p].impressions+=n(a.impressions);map[p].clicks+=n(a.clicks)});
  return Object.values(map).sort((a,b)=>b.spend-a.spend);
}
function renderPlatforms(){
  const arr=platformAgg();
  $("platform-cards").innerHTML=arr.length?arr.map(p=>'<div class="platform-card"><div class="platform-title"><b class="provider-name">'+providerIcon(p.provider)+' '+esc(p.provider)+'</b><span>'+money(p.spend)+' spend</span></div><div class="platform-value">'+(p.spend?p.revenue/p.spend:0).toFixed(2)+'×</div><div class="platform-sub"><span>reported ROAS</span><span>'+Math.round(p.purchases)+' purchases</span></div></div>').join(""):'<div class="empty">No ad platforms connected yet.</div>';
}

function adAgg(){
  const map={};
  state.ads.forEach(a=>{const key=(a.provider||"other")+"|"+(a.ad_id||a.campaign_id||a.ad_name);map[key]||={provider:a.provider||"other",ad_name:a.ad_name||"Unnamed ad",campaign_name:a.campaign_name||"",spend:0,revenue:0,purchases:0,impressions:0,clicks:0};const x=map[key];x.spend+=n(a.spend);x.revenue+=n(a.purchase_value);x.purchases+=n(a.purchases);x.impressions+=n(a.impressions);x.clicks+=n(a.clicks)});
  return Object.values(map).sort((a,b)=>b.spend-a.spend);
}
function signal(roas){return roas>=3?"scale":roas>=2?"hold":roas>=1.5?"watch":"kill"}
function renderTopAds(){
  const arr=(state.creatives||[]).filter(x=>n(x.spend)>0).sort((a,b)=>n(b.spend)-n(a.spend)).slice(0,8);
  if(arr.length){
    $("top-ads-body").innerHTML=arr.map(a=>'<tr><td><b>'+esc(a.ad_name)+'</b><small>'+esc(a.data_strength||"early")+' data</small></td><td><span class="provider">'+providerIcon(a.provider)+' '+esc(a.provider)+'</span></td><td>'+money(a.spend)+'</td><td>'+money(a.revenue)+'</td><td>'+n(a.true_roas).toFixed(2)+'×</td><td>'+Math.round(n(a.orders))+'</td><td><span class="signal '+esc(a.recommendation||"watch")+'" title="'+esc(a.decision_reason||"")+'">'+esc(a.recommendation||"watch")+'</span></td></tr>').join("");
  }else{
    $("top-ads-body").innerHTML='<tr><td colspan="7" class="empty">No ad data yet.</td></tr>';
  }
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
  $("orders-body").innerHTML=arr.map(o=>'<tr><td><b>'+esc(o.order_name)+'</b></td><td>'+new Date(o.created_at).toLocaleString()+'</td><td>'+money(o.net_revenue,c)+'</td><td>'+money(o.cogs,c)+'</td><td>'+money(o.fulfillment_cost,c)+'</td><td>'+money(o.payment_fees,c)+'<small>'+(o.payment_fee_estimated?"Estimated from "+esc(state.store?.shopify_plan||"Shopify")+" plan":"Actual Shopify fee")+'</small></td><td>'+money(o.blended_ad_cost,c)+'</td><td class="'+(n(o.blended_contribution_profit)>=0?"positive":"negative")+'"><b>'+money(o.blended_contribution_profit,c)+'</b></td></tr>').join("")||'<tr><td colspan="8" class="empty">No Shopify orders synced.</td></tr>';
}

function renderProducts(c){
  $("product-grid").innerHTML=state.products.length?state.products.map(p=>'<article class="product-card"><p class="kicker">PRODUCT ECONOMICS</p><h2>'+esc(p.product_title)+'</h2><div class="product-profit">'+money(p.gross_contribution,c)+'</div><small>gross contribution before fulfillment & ads</small><div class="mini-grid"><div class="mini-stat"><span>Revenue</span><b>'+money(p.net_revenue,c)+'</b></div><div class="mini-stat"><span>Orders</span><b>'+p.orders+'</b></div><div class="mini-stat"><span>Break-even CPA*</span><b>'+money(p.break_even_cpa_before_fulfillment,c)+'</b></div><div class="mini-stat"><span>Break-even ROAS*</span><b>'+n(p.break_even_roas_before_fulfillment).toFixed(2)+'×</b></div></div></article>').join(""):'<div class="empty">Sync Shopify to see product economics.</div>';
}

function renderExpenses(c){
  $("expense-list").innerHTML=state.expenses.length?state.expenses.map(x=>'<div class="list-row"><div><b>'+esc(x.label)+'</b><small>'+esc(x.day)+' · '+esc(x.category)+'</small></div><b>'+money(x.amount,c)+'</b></div>').join(""):'<div class="empty">No expenses in this date range.</div>';
}

function renderSettings(){
  const by={};state.integrations.forEach(x=>by[x.provider]=x);
  const sh=by.shopify,me=by.meta,go=by.google,tt=by.tiktok;
  const connected=Boolean(sh);
  const trackerInstalled=Boolean(sh?.metadata?.tracker_installed);
  const permissionsOk=sh?.metadata?.permissions_ok;
  const missing=sh?.metadata?.missing_scopes||[];
  const missingOptional=sh?.metadata?.missing_optional_scopes||[];
  const grantedScopes=String(sh?.metadata?.scope||"").split(",").map(x=>x.trim()).filter(Boolean);
  const trackerPermission=grantedScopes.includes("write_themes")||grantedScopes.includes("write_script_tags");

  if($("setup-intro"))$("setup-intro").classList.toggle("hidden",connected);
  if($("shopify-connected-summary"))$("shopify-connected-summary").classList.toggle("hidden",!connected);
  if($("shopify-card"))$("shopify-card").classList.toggle("hidden",connected&&!state.editingShopify&&!state.addingStore);
  if($("cancel-shopify-edit"))$("cancel-shopify-edit").classList.toggle("hidden",!connected&&!state.addingStore);

  $("shopify-status").textContent=connected?(permissionsOk===false?"Connected · needs permissions":(permissionsOk===true?(trackerInstalled?"Connected + tracking":"Connected"):"Connected · verify permissions")):"Not connected";
  $("shopify-status").classList.toggle("good",connected&&permissionsOk===true);

  if(connected){
    $("connected-store-name").textContent=state.store?.name||"Shopify store";
    $("connected-store-domain").textContent=state.store?.shop_domain||sh.external_account_id||"";
    $("connected-store-plan").textContent=state.store?.shopify_plan||"Detected on next sync";
    const rate=n(state.store?.estimated_card_rate);
    const flat=n(state.store?.estimated_card_flat_fee);
    $("connected-store-fees").textContent=rate?(pct(rate)+" + "+money(flat)):"Actual Shopify fees";
    $("connected-store-sync").textContent=sh.last_sync_at?new Date(sh.last_sync_at).toLocaleString():"Not synced yet";
    $("connected-store-tracker").textContent=trackerInstalled?"Installed":"Not installed";

    const warning=$("shopify-permission-warning");
    if(permissionsOk!==true||sh.last_error){
      warning.classList.remove("hidden");
      const unverified=permissionsOk==null&&!sh.last_error;
      const detail=missing.length?("Missing required: "+missing.join(", ")):(sh.last_error||(unverified?"Permissions have not been verified yet.":"Shopify permissions need attention."));
      warning.innerHTML='<i class="fa-solid fa-triangle-exclamation"></i><div><b>'+(unverified?"Verify Shopify permissions":"Connection needs permissions")+'</b><span>'+esc(detail)+'</span><small><strong>Do this once:</strong> Shopify Dev Dashboard → Apps → Profit Tracker → Versions → Create version → add <code>read_orders</code>, <code>read_products</code>, <code>read_customers</code>, <code>read_all_orders</code>, <code>write_themes</code> → Release. Then click <b>Re-check permissions</b> here.</small></div>';
    }else warning.classList.add("hidden");
  }

  if($("install-tracker")){
    const btn=$("install-tracker");
    btn.innerHTML=trackerInstalled?'<i class="fa-solid fa-check"></i> Tracking installed':(trackerPermission?'<i class="fa-solid fa-crosshairs"></i> Install tracking':'<i class="fa-solid fa-lock"></i> Tracking needs write_themes');
    btn.disabled=trackerInstalled||(!trackerPermission&&permissionsOk===true);
    btn.title=!trackerPermission?"Add write_themes to the Shopify app version and release it.":"";
  }

  $("meta-status").textContent=me?"Connected":"Not connected";$("meta-status").classList.toggle("good",!!me);
  if($("google-status")){$("google-status").textContent=go?"Connected":"Not connected";$("google-status").classList.toggle("good",!!go)}
  if($("tiktok-status")){$("tiktok-status").textContent=tt?"Connected":"Not connected";$("tiktok-status").classList.toggle("good",!!tt)}

  $("integration-list").innerHTML=state.integrations.length?state.integrations.map(x=>'<div class="integration-row"><div class="integration-name">'+providerIcon(x.provider)+'<div><b>'+esc(x.provider)+'</b><small>'+(x.last_sync_at?"Last synced "+new Date(x.last_sync_at).toLocaleString():"Connected · sync not run yet")+(x.last_error?'<br>'+esc(x.last_error):'')+'</small></div></div><span class="status-badge '+(x.last_error?"":"good")+'">'+(x.last_error?"Needs attention":"Connected")+'</span></div>').join(""):'<div class="empty">No API connections yet.</div>';
}
function renderHealth(){
  const shopify=state.integrations.find(x=>x.provider==="shopify");
  const synced=state.integrations.some(x=>x.last_sync_at);
  const hasError=state.integrations.some(x=>x.last_error);
  $("health-dot").classList.toggle("good",synced&&!hasError);
  $("health-title").textContent=hasError?"Connection needs attention":synced?"Data syncing":shopify?"Shopify connected":"Setup incomplete";
  const last=state.integrations.map(x=>x.last_sync_at).filter(Boolean).sort().pop();
  $("health-sub").textContent=hasError?"Open Settings to repair":last?"Last sync "+new Date(last).toLocaleString():shopify?"Run your first sync":"Connect Shopify + ads";
}

$("shopify-form").onsubmit=async e=>{
  e.preventDefault();
  const payload=Object.fromEntries(new FormData(e.target));
  if(state.addingStore){payload.new_store=true;payload.store_id=null}
  try{
    const j=await invoke("saveShopify",payload);
    if(j.store_id){localStorage.setItem("pt_store_id",j.store_id)}
    state.addingStore=false;state.editingShopify=false;
    toast(j.message,j.permissions_ok===false?"bad":"good");
    await loadAll(j.store_id||state.store?.id);
  }catch(err){toast(err.message,"bad")}
};
if($("repair-shopify"))$("repair-shopify").onclick=async()=>{
  const btn=$("repair-shopify"),old=btn.innerHTML;btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Checking…';
  try{
    const r=await invoke("repairShopify");
    toast(r.message,r.permissions_ok?"good":"bad");
    await loadAll(state.store?.id);
  }catch(err){toast(err.message,"bad")}
  finally{btn.disabled=false;btn.innerHTML=old}
};
if($("edit-shopify"))$("edit-shopify").onclick=()=>{
  state.editingShopify=true;state.addingStore=false;
  $("shopify-card").classList.remove("hidden");
  const form=$("shopify-form");
  form.elements.namedItem("shop_domain").value=state.store?.shop_domain||"";
  form.elements.namedItem("client_id").value=(state.integrations.find(x=>x.provider==="shopify")?.metadata?.client_id)||"";
  form.elements.namedItem("client_secret").value="";
  form.elements.namedItem("access_token").value="";
  $("shopify-card").scrollIntoView({behavior:"smooth",block:"start"});
};
if($("add-store"))$("add-store").onclick=()=>{
  state.addingStore=true;state.editingShopify=true;
  $("shopify-card").classList.remove("hidden");
  $("shopify-form").reset();
  $("shopify-status").textContent="New store";
  $("shopify-card").scrollIntoView({behavior:"smooth",block:"start"});
};
if($("cancel-shopify-edit"))$("cancel-shopify-edit").onclick=()=>{
  state.addingStore=false;state.editingShopify=false;
  renderSettings();
};
$("meta-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const j=await invoke("saveMeta",Object.fromEntries(f));toast(j.message);await loadAll()}catch(err){toast(err.message,"bad")}};
if($("google-form"))$("google-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const j=await invoke("saveGoogle",Object.fromEntries(f));toast(j.message);await loadAll()}catch(err){toast(err.message,"bad")}};
if($("tiktok-form"))$("tiktok-form").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{const j=await invoke("saveTikTok",Object.fromEntries(f));toast(j.message);await loadAll()}catch(err){toast(err.message,"bad")}};
$("sync-shopify").onclick=()=>sync("syncShopify",$("sync-shopify"));
$("sync-meta").onclick=()=>sync("syncMeta",$("sync-meta"));
if($("sync-google"))$("sync-google").onclick=()=>sync("syncGoogle",$("sync-google"));
if($("sync-tiktok"))$("sync-tiktok").onclick=()=>sync("syncTikTok",$("sync-tiktok"));
$("install-tracker").onclick=async()=>{
  const shopify=state.integrations.find(x=>x.provider==="shopify");
  const scopes=String(shopify?.metadata?.scope||"").split(",");
  if(!scopes.includes("write_themes")&&!scopes.includes("write_script_tags")){
    return toast("Add write_themes to your Shopify app version, release it, then click Re-check permissions first.","bad");
  }
  const btn=$("install-tracker"),old=btn.innerHTML;btn.disabled=true;btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Installing…';
  try{const r=await invoke("installTracker");toast(r.message||"Tracker installed");await loadAll()}
  catch(err){toast(err.message,"bad")}
  finally{btn.disabled=false;btn.innerHTML=old}
};
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