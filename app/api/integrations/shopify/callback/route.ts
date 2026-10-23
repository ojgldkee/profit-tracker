import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";
import {adminDb} from "@/lib/server-db";

export async function GET(req:NextRequest){
  const p=req.nextUrl.searchParams;
  const shop=p.get("shop")||"", code=p.get("code")||"", hmac=p.get("hmac")||"", state=p.get("state")||"";
  if(!shop||!code||!hmac||!state||state!==req.cookies.get("pt_shopify_state")?.value) return NextResponse.json({error:"Invalid Shopify OAuth callback."},{status:400});
  const secret=process.env.SHOPIFY_CLIENT_SECRET||"";
  const pairs=[...p.entries()].filter(([k])=>k!=="hmac"&&k!=="signature").sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join("&");
  const expected=crypto.createHmac("sha256",secret).update(pairs).digest("hex");
  if(!secret||!crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(hmac))) return NextResponse.json({error:"Shopify HMAC verification failed."},{status:401});
  const tokenRes=await fetch(`https://${shop}/admin/oauth/access_token`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({client_id:process.env.SHOPIFY_CLIENT_ID,client_secret:secret,code})});
  const token=await tokenRes.json();
  if(!tokenRes.ok||!token.access_token) return NextResponse.json({error:"Shopify token exchange failed.",detail:token},{status:502});
  const db=adminDb();
  if(!db) return NextResponse.json({error:"Profit Tracker database is not configured yet."},{status:503});
  let store=(await db.from("stores").select("id").eq("shop_domain",shop).maybeSingle()).data;
  if(!store){
    const created=await db.from("stores").insert({name:shop.replace(".myshopify.com",""),shop_domain:shop,currency:"USD"}).select("id").single();
    if(created.error) return NextResponse.json({error:created.error.message},{status:500});
    store=created.data;
  }
  await db.from("integration_credentials").upsert({store_id:store.id,provider:"shopify",access_token:token.access_token,external_account_id:shop,updated_at:new Date().toISOString()},{onConflict:"store_id,provider"});
  return NextResponse.redirect((process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin)+"/?connected=shopify");
}
