import {NextResponse} from "next/server";
import {demoDashboard} from "@/lib/demo";
import {adminDb} from "@/lib/server-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = adminDb();
  if (!db) return NextResponse.json(demoDashboard);

  const storeResult = await db.from("stores").select("id,name,currency").order("created_at",{ascending:true}).limit(1).maybeSingle();
  if (storeResult.error || !storeResult.data) return NextResponse.json(demoDashboard);

  const store = storeResult.data;
  const from = new Date(Date.now()-6*86400000).toISOString().slice(0,10);
  const [daily, ads, products, orders] = await Promise.all([
    db.from("daily_profit").select("*").eq("store_id",store.id).gte("day",from).order("day"),
    db.from("ad_profitability").select("*").eq("store_id",store.id).gte("day",from).order("contribution_profit",{ascending:false}).limit(12),
    db.from("product_profitability").select("*").eq("store_id",store.id).gte("day",from).order("contribution_profit",{ascending:false}).limit(12),
    db.from("orders").select("id,order_name,created_at,net_revenue,cogs,fulfillment_cost,payment_fees,allocated_ad_spend,contribution_profit").eq("store_id",store.id).order("created_at",{ascending:false}).limit(12)
  ]);
  const rows = daily.data || [];
  if (!rows.length) return NextResponse.json({...demoDashboard,mode:"connected-empty",store});

  const sum=(key:string)=>rows.reduce((s:any,r:any)=>s+Number(r[key]||0),0);
  const netRevenue=sum("net_revenue"), adSpend=sum("ad_spend"), profit=sum("contribution_profit"), orderCount=sum("orders");
  return NextResponse.json({
    mode:"live",store,period:"Last 7 days",
    summary:{
      grossSales:sum("gross_sales"),netRevenue,orders:orderCount,adSpend,cogs:sum("cogs"),
      fulfillment:sum("fulfillment_cost"),paymentFees:sum("payment_fees"),refunds:sum("refunds"),
      variableExpenses:sum("variable_expenses"),contributionProfit:profit,
      contributionMargin:netRevenue?profit/netRevenue:0,
      blendedRoas:adSpend?netRevenue/adSpend:0,metaRoas:sum("meta_purchase_value")/Math.max(adSpend,1),
      breakEvenRoas:sum("pre_ad_contribution")?netRevenue/sum("pre_ad_contribution"):0,
      aov:orderCount?netRevenue/orderCount:0,cpa:orderCount?adSpend/orderCount:0,profitPerOrder:orderCount?profit/orderCount:0
    },
    daily:rows.map((r:any)=>({date:new Date(r.day+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}),revenue:Number(r.net_revenue),profit:Number(r.contribution_profit),spend:Number(r.ad_spend)})),
    ads:(ads.data||[]).map((r:any)=>({name:r.ad_name||"Unknown ad",spend:Number(r.spend||0),revenue:Number(r.attributed_revenue||0),orders:Number(r.purchases||0),metaRoas:Number(r.meta_roas||0),profit:Number(r.contribution_profit||0),margin:Number(r.margin||0),status:r.recommendation||"hold"})),
    products:(products.data||[]).map((r:any)=>({name:r.product_title,revenue:Number(r.net_revenue||0),orders:Number(r.orders||0),cogs:Number(r.cogs||0),profit:Number(r.contribution_profit||0),margin:Number(r.margin||0),breakEvenCpa:Number(r.break_even_cpa||0),breakEvenRoas:Number(r.break_even_roas||0)})),
    orders:(orders.data||[]).map((r:any)=>({name:r.order_name,date:new Date(r.created_at).toLocaleString(),revenue:Number(r.net_revenue||0),cogs:Number(r.cogs||0),shipping:Number(r.fulfillment_cost||0),fees:Number(r.payment_fees||0),adCost:Number(r.allocated_ad_spend||0),profit:Number(r.contribution_profit||0)})),
    alerts:[]
  });
}
