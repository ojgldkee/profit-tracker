import {NextRequest,NextResponse} from "next/server";

export const dynamic="force-dynamic";

export async function GET(req:NextRequest){
  const secret=process.env.CRON_SECRET||"";
  const auth=req.headers.get("authorization")||"";
  if(!secret||auth!==`Bearer ${secret}`) return NextResponse.json({error:"Unauthorized"},{status:401});
  const origin=(process.env.NEXT_PUBLIC_APP_URL||req.nextUrl.origin).replace(/\/$/,"");
  const headers={"x-profit-tracker-cron":secret};
  const [shopify,meta]=await Promise.all([
    fetch(origin+"/api/sync/shopify",{method:"POST",headers}).then(async r=>({ok:r.ok,body:await r.json().catch(()=>({}))})),
    fetch(origin+"/api/sync/meta",{method:"POST",headers}).then(async r=>({ok:r.ok,body:await r.json().catch(()=>({}))}))
  ]);
  return NextResponse.json({ok:shopify.ok||meta.ok,shopify,meta,ranAt:new Date().toISOString()});
}
