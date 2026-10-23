import {NextRequest,NextResponse} from "next/server";
import {adminDb} from "@/lib/server-db";

export async function GET(){
  const db=adminDb(); if(!db)return NextResponse.json({rules:[],mode:"demo"});
  const store=(await db.from("stores").select("id").order("created_at").limit(1).maybeSingle()).data;
  if(!store)return NextResponse.json({rules:[]});
  const r=await db.from("cost_rules").select("*").eq("store_id",store.id).order("priority",{ascending:false});
  return NextResponse.json({rules:r.data||[]});
}
export async function POST(req:NextRequest){
  const db=adminDb(); if(!db)return NextResponse.json({error:"Database is not configured."},{status:503});
  const store=(await db.from("stores").select("id").order("created_at").limit(1).maybeSingle()).data;
  if(!store)return NextResponse.json({error:"No store exists."},{status:400});
  const body=await req.json();
  if(!["fulfillment_per_order","shipping_per_order","payment_percent","variable_per_order"].includes(body.kind))return NextResponse.json({error:"Unsupported cost rule."},{status:400});
  const r=await db.from("cost_rules").insert({store_id:store.id,kind:body.kind,value:Number(body.value||0),priority:Number(body.priority||10),active:true,label:String(body.label||body.kind)}).select("*").single();
  if(r.error)return NextResponse.json({error:r.error.message},{status:400});
  return NextResponse.json({rule:r.data});
}
