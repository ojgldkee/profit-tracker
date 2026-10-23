import {NextRequest,NextResponse} from "next/server";
import crypto from "node:crypto";

export async function GET(req:NextRequest){
  const raw=(req.nextUrl.searchParams.get("shop")||"").toLowerCase().trim();
  const shop=raw.replace(/^https?:\/\//,"").replace(/\/$/,"");
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop)) return NextResponse.json({error:"Enter a valid *.myshopify.com domain."},{status:400});
  const client=process.env.SHOPIFY_CLIENT_ID;
  const appUrl=process.env.NEXT_PUBLIC_APP_URL;
  if(!client||!appUrl) return NextResponse.json({error:"Shopify app credentials are not configured."},{status:503});
  const state=crypto.randomBytes(20).toString("hex");
  const scopes=process.env.SHOPIFY_SCOPES||"read_orders,read_products,read_inventory";
  const redirect=appUrl.replace(/\/$/,"")+"/api/integrations/shopify/callback";
  const url=new URL(`https://${shop}/admin/oauth/authorize`);
  url.searchParams.set("client_id",client);
  url.searchParams.set("scope",scopes);
  url.searchParams.set("redirect_uri",redirect);
  url.searchParams.set("state",state);
  const res=NextResponse.redirect(url);
  res.cookies.set("pt_shopify_state",state,{httpOnly:true,secure:true,sameSite:"lax",maxAge:600,path:"/"});
  return res;
}
