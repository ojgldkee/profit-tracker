import {NextResponse} from "next/server";
import crypto from "node:crypto";

export async function GET(){
  const appId=process.env.META_APP_ID, appUrl=process.env.NEXT_PUBLIC_APP_URL;
  if(!appId||!appUrl) return NextResponse.json({error:"Meta app credentials are not configured."},{status:503});
  const state=crypto.randomBytes(20).toString("hex");
  const redirect=appUrl.replace(/\/$/,"")+"/api/integrations/meta/callback";
  const url=new URL("https://www.facebook.com/v23.0/dialog/oauth");
  url.searchParams.set("client_id",appId);
  url.searchParams.set("redirect_uri",redirect);
  url.searchParams.set("scope",process.env.META_SCOPES||"ads_read,business_management");
  url.searchParams.set("state",state);
  const res=NextResponse.redirect(url);
  res.cookies.set("pt_meta_state",state,{httpOnly:true,secure:true,sameSite:"lax",maxAge:600,path:"/"});
  return res;
}
