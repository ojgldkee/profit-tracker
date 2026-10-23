"use client";

import {useEffect,useMemo,useState} from "react";
import {money,pct} from "@/lib/profit";

type Dashboard=any;
const tabs=["Overview","Profit","Ads","Orders","Products","Expenses","Cash","Settings"];

function Metric({label,value,sub,tone=""}:{label:string,value:string,sub?:string,tone?:string}){
  return <article className={"metric "+tone}><span>{label}</span><strong>{value}</strong>{sub&&<small>{sub}</small>}</article>
}
function Pill({value}:{value:string}){return <span className={"pill "+value}>{value}</span>}

export default function Home(){
  const [data,setData]=useState<Dashboard|null>(null);
  const [tab,setTab]=useState("Overview");
  const [shop,setShop]=useState("");
  const [syncing,setSyncing]=useState("");
  const [message,setMessage]=useState("");

  async function load(){
    const r=await fetch("/api/dashboard",{cache:"no-store"});
    setData(await r.json());
  }
  useEffect(()=>{load().catch(()=>{});},[]);

  async function sync(provider:string){
    setSyncing(provider); setMessage("");
    const r=await fetch("/api/sync/"+provider,{method:"POST"});
    const json=await r.json().catch(()=>({}));
    setMessage(r.ok?(json.message||provider+" synced"):(json.error||"Sync failed"));
    setSyncing("");
    if(r.ok) load();
  }

  const maxChart=useMemo(()=>Math.max(1,...(data?.daily||[]).map((d:any)=>Math.max(d.revenue,d.profit,d.spend))),[data]);
  if(!data) return <main className="loading">Loading Profit Tracker…</main>;
  const s=data.summary;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="mark">P</div><div><strong>Profit Tracker</strong><span>Financial truth for ecommerce</span></div></div>
      <nav>{tabs.map(x=><button key={x} className={tab===x?"active":""} onClick={()=>setTab(x)}><i>{navIcon(x)}</i>{x}</button>)}</nav>
      <div className="sidefoot">
        <div className="connection"><span className={"dot "+(data.mode==="live"?"live":"")}></span><div><b>{data.store?.name||"No store"}</b><small>{data.mode==="live"?"Live data":"Demo mode"}</small></div></div>
        <button className="ghost" onClick={()=>setTab("Settings")}>Manage connections</button>
      </div>
    </aside>

    <main className="main">
      <header className="top">
        <div><p className="eyebrow">PROFIT INTELLIGENCE</p><h1>{tab}</h1></div>
        <div className="top-actions"><select defaultValue="7"><option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select><button onClick={()=>load()}>Refresh</button></div>
      </header>

      {data.mode!=="live"&&<div className="demo-banner"><b>{data.mode==="connected-empty"?"Connected — waiting for synced data":"Demo mode"}</b><span>Connect Shopify + Meta in Settings to replace demo numbers with your actual profit ledger.</span></div>}

      {tab==="Overview"&&<>
        <section className="hero-profit">
          <div><span>True contribution profit</span><strong>{money(s.contributionProfit)}</strong><small>{pct(s.contributionMargin)} margin · {money(s.profitPerOrder)} per order</small></div>
          <div className="hero-score"><span>Profit health</span><b>{s.contributionMargin>0.25?"Strong":s.contributionMargin>0.1?"Watch":"Weak"}</b><small>After ads, COGS, fulfillment & fees</small></div>
        </section>
        <section className="metrics">
          <Metric label="Net revenue" value={money(s.netRevenue)} sub={s.orders+" orders"}/>
          <Metric label="Ad spend" value={money(s.adSpend)} sub={money(s.cpa)+" CPA"}/>
          <Metric label="Blended ROAS" value={s.blendedRoas.toFixed(2)+"×"} sub={"Meta reports "+s.metaRoas.toFixed(2)+"×"}/>
          <Metric label="Break-even ROAS" value={s.breakEvenRoas.toFixed(2)+"×"} sub={s.blendedRoas>s.breakEvenRoas?"Above break-even":"Below break-even"} tone={s.blendedRoas>s.breakEvenRoas?"good":"bad"}/>
          <Metric label="COGS" value={money(s.cogs)} sub={(s.cogs/Math.max(s.netRevenue,1)*100).toFixed(1)+"% of revenue"}/>
          <Metric label="Fees + fulfillment" value={money(s.paymentFees+s.fulfillment)} sub="Variable operating cost"/>
        </section>

        <section className="grid two">
          <article className="panel chart-panel"><div className="section-head"><div><p className="eyebrow">7 DAY TREND</p><h2>Revenue vs profit</h2></div><div className="legend"><span className="rev"></span>Revenue <span className="prof"></span>Profit</div></div>
            <div className="chart">{data.daily.map((d:any)=><div className="day" key={d.date}><div className="bars"><i className="bar revenue" style={{height:(d.revenue/maxChart*100)+"%"}}></i><i className={"bar profit "+(d.profit<0?"negative":"")} style={{height:(Math.abs(d.profit)/maxChart*100)+"%"}}></i></div><small>{d.date}</small></div>)}</div>
          </article>
          <article className="panel"><div className="section-head"><div><p className="eyebrow">WHAT CHANGED</p><h2>Profit alerts</h2></div></div><div className="alerts">{(data.alerts?.length?data.alerts:buildAlerts(data)).map((a:any,i:number)=><div className={"alert "+a.type} key={i}><i></i><div><b>{a.title}</b><p>{a.body}</p></div></div>)}</div></article>
        </section>

        <section className="panel"><div className="section-head"><div><p className="eyebrow">CREATIVE PROFIT</p><h2>Ads ranked by money made</h2></div><button className="text-btn" onClick={()=>setTab("Ads")}>View all ads →</button></div>
          <div className="table-wrap"><table><thead><tr><th>Creative</th><th>Spend</th><th>Revenue</th><th>Meta ROAS</th><th>True profit</th><th>Margin</th><th>Action</th></tr></thead><tbody>{data.ads.slice(0,5).map((a:any)=><tr key={a.name}><td><b>{a.name}</b></td><td>{money(a.spend)}</td><td>{money(a.revenue)}</td><td>{a.metaRoas.toFixed(2)}×</td><td className={a.profit<0?"loss":"gain"}>{money(a.profit)}</td><td>{pct(a.margin)}</td><td><Pill value={a.status}/></td></tr>)}</tbody></table></div>
        </section>
      </>}

      {tab==="Profit"&&<>
        <section className="metrics">
          <Metric label="Gross sales" value={money(s.grossSales)}/>
          <Metric label="Net revenue" value={money(s.netRevenue)}/>
          <Metric label="Contribution profit" value={money(s.contributionProfit)} tone="good"/>
          <Metric label="Contribution margin" value={pct(s.contributionMargin)}/>
        </section>
        <section className="panel waterfall"><div className="section-head"><div><p className="eyebrow">PROFIT WATERFALL</p><h2>Where every dollar went</h2></div></div>
          {[
            ["Gross sales",s.grossSales,"plus"],["Refunds",-s.refunds,"minus"],["COGS",-s.cogs,"minus"],["Fulfillment",-s.fulfillment,"minus"],["Payment fees",-s.paymentFees,"minus"],["Ad spend",-s.adSpend,"minus"],["Variable expenses",-s.variableExpenses,"minus"],["True contribution profit",s.contributionProfit,"total"]
          ].map(([n,v,t]:any)=><div className={"water-row "+t} key={n}><span>{n}</span><div><i style={{width:Math.min(100,Math.abs(v)/Math.max(s.grossSales,1)*100)+"%"}}></i></div><b>{v<0?"−":""}{money(Math.abs(v))}</b></div>)}
        </section>
        <section className="panel formula"><h3>Profit Tracker formula</h3><p><b>Net revenue</b> − COGS − fulfillment − payment fees − ad spend − variable expenses = <b>true contribution profit</b>.</p><small>Taxes are tracked separately and are not treated as merchant profit.</small></section>
      </>}

      {tab==="Ads"&&<section className="panel"><div className="section-head"><div><p className="eyebrow">META + SHOPIFY RECONCILIATION</p><h2>Ad profitability</h2></div><span className="subtle">Sort by true profit, not vanity ROAS.</span></div>
        <div className="table-wrap"><table><thead><tr><th>Ad</th><th>Spend</th><th>Orders</th><th>Revenue</th><th>Meta ROAS</th><th>True profit</th><th>Margin</th><th>Decision</th></tr></thead><tbody>{data.ads.map((a:any)=><tr key={a.name}><td><b>{a.name}</b></td><td>{money(a.spend)}</td><td>{a.orders}</td><td>{money(a.revenue)}</td><td>{a.metaRoas.toFixed(2)}×</td><td className={a.profit<0?"loss":"gain"}>{money(a.profit)}</td><td>{pct(a.margin)}</td><td><Pill value={a.status}/></td></tr>)}</tbody></table></div>
      </section>}

      {tab==="Orders"&&<section className="panel"><div className="section-head"><div><p className="eyebrow">ORDER LEDGER</p><h2>Profit by order</h2></div><span className="subtle">Every cost is auditable.</span></div>
        <div className="table-wrap"><table><thead><tr><th>Order</th><th>Time</th><th>Revenue</th><th>COGS</th><th>Fulfillment</th><th>Fees</th><th>Allocated ads</th><th>Profit</th></tr></thead><tbody>{data.orders.map((o:any)=><tr key={o.name}><td><b>{o.name}</b></td><td>{o.date}</td><td>{money(o.revenue)}</td><td>{money(o.cogs)}</td><td>{money(o.shipping)}</td><td>{money(o.fees)}</td><td>{money(o.adCost)}</td><td className={o.profit<0?"loss":"gain"}><b>{money(o.profit)}</b></td></tr>)}</tbody></table></div>
      </section>}

      {tab==="Products"&&<section className="product-grid">{data.products.map((p:any)=><article className="panel product" key={p.name}><span className="eyebrow">PRODUCT PROFITABILITY</span><h2>{p.name}</h2><strong>{money(p.profit)}</strong><small>contribution profit</small><div className="product-stats"><div><span>Revenue</span><b>{money(p.revenue)}</b></div><div><span>Margin</span><b>{pct(p.margin)}</b></div><div><span>Break-even CPA</span><b>{money(p.breakEvenCpa)}</b></div><div><span>Break-even ROAS</span><b>{p.breakEvenRoas.toFixed(2)}×</b></div></div></article>)}</section>}

      {tab==="Expenses"&&<><section className="panel"><div className="section-head"><div><p className="eyebrow">COST ENGINE</p><h2>Costs Profit Tracker should subtract</h2></div></div>
        <div className="cost-grid">{["Product COGS","Fulfillment / 3PL","Shipping labels","Payment processing","Subscription apps","Chargebacks","Creator costs","Other variable expense"].map((x,i)=><div className="cost-card" key={x}><span>{x}</span><b>{i<4?"Automated when available":"Add rule"}</b><small>{i===0?"Shopify variant cost or override":i===3?"Actual Shopify transaction fees preferred":"Fixed, % of revenue, per order or daily"}</small></div>)}</div>
      </section><section className="panel formula"><h3>Cost precedence</h3><p>Actual transaction/order cost → product-specific override → store-wide rule → fallback estimate. Profit Tracker always shows which source was used.</p></section></>}

      {tab==="Cash"&&<><section className="metrics"><Metric label="Booked profit" value={money(s.contributionProfit)} sub="Accounting profit"/><Metric label="Net revenue" value={money(s.netRevenue)}/><Metric label="Ad cash out" value={money(s.adSpend)} sub="Meta spend accrued"/><Metric label="Refund exposure" value={money(s.refunds)}/></section><section className="panel empty-state"><h2>Cash reconciliation</h2><p>Once Shopify Payments payout access is connected, this page reconciles pending payouts, paid payouts, refunds and ad cash outflow separately from booked profit.</p></section></>}

      {tab==="Settings"&&<>
        <section className="connect-grid">
          <article className="panel connect"><div className="service-icon">S</div><div><p className="eyebrow">COMMERCE</p><h2>Shopify</h2><p>Orders, products, refunds, variant costs, transaction fees and payment gateways.</p></div><label>Store domain<input value={shop} onChange={e=>setShop(e.target.value)} placeholder="your-store.myshopify.com"/></label><button className="primary" onClick={()=>{if(shop) location.href="/api/integrations/shopify/connect?shop="+encodeURIComponent(shop)}}>Connect Shopify</button><button className="secondary" disabled={syncing==="shopify"} onClick={()=>sync("shopify")}>{syncing==="shopify"?"Syncing…":"Sync now"}</button></article>
          <article className="panel connect"><div className="service-icon meta">M</div><div><p className="eyebrow">ADVERTISING</p><h2>Meta Ads</h2><p>Spend, purchases, purchase value, campaign/ad set/ad performance and reported ROAS.</p></div><button className="primary" onClick={()=>location.href="/api/integrations/meta/connect"}>Connect Meta</button><button className="secondary" disabled={syncing==="meta"} onClick={()=>sync("meta")}>{syncing==="meta"?"Syncing…":"Sync now"}</button></article>
        </section>
        {message&&<div className="status-message">{message}</div>}
        <section className="panel"><div className="section-head"><div><p className="eyebrow">SYSTEM DESIGN</p><h2>Why Profit Tracker is different</h2></div></div><div className="principles"><div><b>Financial truth first</b><p>Shopify order revenue is the ledger. Ad platforms supply spend and attribution, not your definition of profit.</p></div><div><b>Every number explains itself</b><p>Drill from business → product → ad → order → individual cost components.</p></div><div><b>Break-even built in</b><p>CPA and ROAS are compared against the actual margin of the product being sold.</p></div><div><b>Attribution uncertainty is visible</b><p>Reported ROAS and reconciled profit are shown separately instead of pretending they are the same thing.</p></div></div></section>
      </>}
    </main>
  </div>
}

function buildAlerts(d:any){
  const ads=d.ads||[]; const best=[...ads].sort((a,b)=>b.profit-a.profit)[0]; const worst=[...ads].sort((a,b)=>a.profit-b.profit)[0];
  const out=[]; if(best)out.push({type:"positive",title:best.name+" leads true profit",body:money(best.profit)+" contribution profit. Meta ROAS: "+best.metaRoas.toFixed(2)+"×."});
  if(worst&&worst.profit<0)out.push({type:"negative",title:worst.name+" is losing money",body:"Revenue looks positive, but after real costs this creative is at "+money(worst.profit)+"."});
  out.push({type:"warning",title:"ROAS is not the decision metric",body:"Profit Tracker compares reported ROAS to break-even ROAS and contribution margin before suggesting scale/hold/kill."}); return out;
}
function navIcon(x:string){return ({Overview:"◫",Profit:"↗",Ads:"◎",Orders:"≡",Products:"◇",Expenses:"−",Cash:"$",Settings:"⚙"} as any)[x]||"•"}
