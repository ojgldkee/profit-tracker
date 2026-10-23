import {NextRequest,NextResponse} from "next/server";
import {adminDb} from "@/lib/server-db";

export async function GET(req:NextRequest){
  const code=req.nextUrl.searchParams.get("code")||"", state=req.nextUrl.searchParams.get("state")||"";
  if(!code||!state||state!==req.cookies.get("pt_meta_state")?.value) return NextResponse.json({error:"Invalid Meta OAuth callback."},{status:400});
  const redirect=(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin).replace(/\/$/,"")+"/api/integrations/meta/callback";
  const url=new URL("https://graph.facebook.com/v23.0/oauth/access_token");
  url.searchParams.set("client_id",process.env.META_APP_ID||"");
  url.searchParams.set("client_secret",process.env.META_APP_SECRET||"");
  url.searchParams.set("redirect_uri",redirect);
  url.searchParams.set("code",code);
  const r=await fetch(url);
  const token=await r.json();
  if(!r.ok||!token.access_token) return NextResponse.json({error:"Meta token exchange failed.",detail:token},{status:502});
  const db=adminDb(); if(!db) return NextResponse.json({error:"Profit Tracker database is not configured yet."},{status:503});
  const store=(await db.from("stores").select("id").order("created_at").limit(1).maybeSingle()).data;
  if(!store) return NextResponse.json({error:"Connect Shopify or create a store first."},{status:400});
  await db.from("integration_credentials").upsert({store_id:store.id,provider:"meta",access_token:token.access_token,updated_at:new Date().toISOString()},{onConflict:"store_id,provider"});
  return NextResponse.redirect((process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin)+"/?connected=meta");
}
