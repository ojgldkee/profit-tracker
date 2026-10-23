import {NextResponse} from "next/server";
import {adminDb} from "@/lib/server-db";

function actionValue(items:any[],type:string){const row=(items||[]).find((x:any)=>x.action_type===type);return Number(row?.value||0)}

export async function POST(){
  const db=adminDb(); if(!db)return NextResponse.json({error:"Database is not configured."},{status:503});
  const store=(await db.from("stores").select("*").order("created_at").limit(1).maybeSingle()).data;
  if(!store)return NextResponse.json({error:"Create/connect a store first."},{status:400});
  const cred=(await db.from("integration_credentials").select("*").eq("store_id",store.id).eq("provider","meta").maybeSingle()).data;
  if(!cred?.access_token)return NextResponse.json({error:"Meta is not connected."},{status:400});
  let accountId=cred.external_account_id;
  if(!accountId){
    const a=await fetch("https://graph.facebook.com/v23.0/me/adaccounts?fields=id,name,account_id&limit=50&access_token="+encodeURIComponent(cred.access_token));
    const j=await a.json(); accountId=j.data?.[0]?.id;
    if(!accountId)return NextResponse.json({error:"No accessible Meta ad account found.",detail:j},{status:400});
    await db.from("integration_credentials").update({external_account_id:accountId,updated_at:new Date().toISOString()}).eq("id",cred.id);
  }
  const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10), until=new Date().toISOString().slice(0,10);
  const url=new URL(`https://graph.facebook.com/v23.0/${accountId}/insights`);
  url.searchParams.set("access_token",cred.access_token);
  url.searchParams.set("level","ad"); url.searchParams.set("time_increment","1"); url.searchParams.set("limit","500");
  url.searchParams.set("time_range",JSON.stringify({since,until}));
  url.searchParams.set("fields","date_start,date_stop,campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,clicks,actions,action_values,purchase_roas");
  const r=await fetch(url); const body=await r.json();
  if(!r.ok||body.error)return NextResponse.json({error:"Meta sync failed.",detail:body.error||body},{status:502});
  const rows=(body.data||[]).map((x:any)=>{
    const purchases=actionValue(x.actions,"purchase");
    const purchaseValue=actionValue(x.action_values,"purchase");
    const spend=Number(x.spend||0);
    return {store_id:store.id,day:x.date_start,campaign_id:x.campaign_id||"",campaign_name:x.campaign_name||"",adset_id:x.adset_id||"",adset_name:x.adset_name||"",ad_id:x.ad_id||"",ad_name:x.ad_name||"",spend,purchases,purchase_value:purchaseValue,meta_roas:Number(x.purchase_roas?.[0]?.value|| (spend?purchaseValue/spend:0)),impressions:Number(x.impressions||0),clicks:Number(x.clicks||0),raw:x,updated_at:new Date().toISOString()};
  });
  if(rows.length){const u=await db.from("meta_daily").upsert(rows,{onConflict:"store_id,day,ad_id"});if(u.error)return NextResponse.json({error:u.error.message},{status:500})}
  await db.from("stores").update({last_meta_sync_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",store.id);
  return NextResponse.json({ok:true,message:`Synced ${rows.length} Meta ad-day rows.`,rows:rows.length,accountId});
}
