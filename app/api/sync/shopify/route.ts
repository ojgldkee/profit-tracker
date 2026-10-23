import {NextResponse} from "next/server";
import {adminDb} from "@/lib/server-db";

const QUERY=`query ProfitTrackerOrders($first: Int!, $query: String) {
  orders(first: $first, reverse: true, sortKey: CREATED_AT, query: $query) {
    nodes {
      id name createdAt currencyCode displayFinancialStatus
      currentSubtotalPriceSet { shopMoney { amount currencyCode } }
      currentTotalDiscountsSet { shopMoney { amount currencyCode } }
      totalRefundedSet { shopMoney { amount currencyCode } }
      currentShippingPriceSet { shopMoney { amount currencyCode } }
      currentTotalTaxSet { shopMoney { amount currencyCode } }
      currentTotalPriceSet { shopMoney { amount currencyCode } }
      paymentGatewayNames
      transactions { status kind fees { amount { amount currencyCode } } }
      lineItems(first: 100) {
        nodes {
          id name quantity currentQuantity sku
          originalUnitPriceSet { shopMoney { amount currencyCode } }
          totalDiscountSet { shopMoney { amount currencyCode } }
          variant { id title product { id title } inventoryItem { id unitCost { amount currencyCode } } }
        }
      }
    }
  }
}`;

const n=(v:any)=>Number(v||0);
const amt=(bag:any)=>n(bag?.shopMoney?.amount);

export async function POST(){
  const db=adminDb(); if(!db)return NextResponse.json({error:"Database is not configured."},{status:503});
  const store=(await db.from("stores").select("*").order("created_at").limit(1).maybeSingle()).data;
  if(!store)return NextResponse.json({error:"Connect Shopify first."},{status:400});
  const cred=(await db.from("integration_credentials").select("access_token").eq("store_id",store.id).eq("provider","shopify").maybeSingle()).data;
  if(!cred?.access_token)return NextResponse.json({error:"Shopify is not connected."},{status:400});
  const version=process.env.SHOPIFY_API_VERSION||"2026-10";
  const r=await fetch(`https://${store.shop_domain}/admin/api/${version}/graphql.json`,{method:"POST",headers:{"content-type":"application/json","x-shopify-access-token":cred.access_token},body:JSON.stringify({query:QUERY,variables:{first:100,query:"created_at:>=-60d"}})});
  const body=await r.json();
  if(!r.ok||body.errors)return NextResponse.json({error:"Shopify sync failed.",detail:body.errors||body},{status:502});
  const orders=body.data?.orders?.nodes||[];
  let synced=0;
  for(const o of orders){
    let cogs=0;
    const items=o.lineItems?.nodes||[];
    for(const li of items){
      const unitCost=n(li.variant?.inventoryItem?.unitCost?.amount);
      cogs+=unitCost*n(li.currentQuantity||li.quantity);
      if(li.variant?.product?.id){
        const p=await db.from("products").upsert({store_id:store.id,shopify_product_id:li.variant.product.id,title:li.variant.product.title,updated_at:new Date().toISOString()},{onConflict:"store_id,shopify_product_id"}).select("id").single();
        if(p.data&&li.variant?.id)await db.from("variants").upsert({store_id:store.id,product_id:p.data.id,shopify_variant_id:li.variant.id,title:li.variant.title||"",sku:li.sku||null,unit_cost:unitCost,updated_at:new Date().toISOString()},{onConflict:"store_id,shopify_variant_id"});
      }
    }
    const paymentFees=(o.transactions||[]).flatMap((t:any)=>t.fees||[]).reduce((s:number,f:any)=>s+n(f.amount?.amount),0);
    const gross=amt(o.currentSubtotalPriceSet)+amt(o.currentTotalDiscountsSet);
    const discounts=amt(o.currentTotalDiscountsSet), refunds=amt(o.totalRefundedSet), shipping=amt(o.currentShippingPriceSet), taxes=amt(o.currentTotalTaxSet);
    const net=Math.max(0,gross-discounts-refunds+shipping);
    const rule=(await db.from("cost_rules").select("*").eq("store_id",store.id).eq("kind","fulfillment_per_order").eq("active",true).order("priority",{ascending:false}).limit(1).maybeSingle()).data;
    const fulfillment=n(rule?.value);
    const preAd=net-cogs-fulfillment-paymentFees;
    const up=await db.from("orders").upsert({store_id:store.id,shopify_order_id:o.id,order_name:o.name,created_at:o.createdAt,currency:o.currencyCode,gross_sales:gross,discounts,refunds,shipping_revenue:shipping,taxes,net_revenue:net,cogs,fulfillment_cost:fulfillment,payment_fees:paymentFees,pre_ad_contribution:preAd,financial_status:o.displayFinancialStatus,payment_gateways:o.paymentGatewayNames||[],raw:o,updated_at:new Date().toISOString()},{onConflict:"store_id,shopify_order_id"}).select("id").single();
    if(up.data){
      await db.from("order_items").delete().eq("order_id",up.data.id);
      const rows=items.map((li:any)=>({order_id:up.data.id,shopify_line_item_id:li.id,shopify_variant_id:li.variant?.id||null,product_title:li.variant?.product?.title||li.name,variant_title:li.variant?.title||null,sku:li.sku||null,quantity:n(li.currentQuantity||li.quantity),gross_sales:n(li.originalUnitPriceSet?.shopMoney?.amount)*n(li.currentQuantity||li.quantity),discounts:n(li.totalDiscountSet?.shopMoney?.amount),cogs:n(li.variant?.inventoryItem?.unitCost?.amount)*n(li.currentQuantity||li.quantity)}));
      if(rows.length)await db.from("order_items").insert(rows);
    }
    synced++;
  }
  await db.from("stores").update({last_shopify_sync_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",store.id);
  return NextResponse.json({ok:true,message:`Synced ${synced} Shopify orders.`,orders:synced});
}
