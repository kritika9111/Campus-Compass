import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import { reportInput } from "@/lib/validation";
import { getPagedReports } from "@/lib/queries";
import { categories } from "@/lib/types";
import { isSameOrigin, readJsonBody, RequestBodyError } from "@/lib/http";
import { notifyOwnersOfPotentialMatches } from "@/lib/matching";
import type { ItemReport } from "@/lib/types";

export async function GET(request: Request) {
  const session=await auth(); if(!session?.user?.email) return NextResponse.json({error:"Sign in to browse reports."},{status:401});
  try { const p=new URL(request.url).searchParams; const page=Math.max(1,Number(p.get("page")||1)); const {items,total}=await getPagedReports(page,24,{query:p.get("q")?.slice(0,120)||undefined,kind:["lost","found"].includes(p.get("kind")||"")?p.get("kind") as "lost"|"found":"all",category:categories.includes(p.get("category") as (typeof categories)[number])?p.get("category")!:"all",location:p.get("location")||undefined,days:["today","week"].includes(p.get("days")||"")?p.get("days") as "today"|"week":"any",sort:p.get("sort")==="relevance"?"relevance":"newest"}); return NextResponse.json({items,total,page,pageCount:Math.max(1,Math.ceil(total/24))}); }
  catch { return NextResponse.json({error:"Reports are temporarily unavailable."},{status:503}); }
}
export async function POST(request:Request) {
 try { if(!isSameOrigin(request)) return NextResponse.json({error:"Cross-origin request denied."},{status:403}); const session=await auth(); const email=session?.user?.email?.toLowerCase(); if(!session?.user?.id||!email) return NextResponse.json({error:"Sign in with Google to report an item."},{status:401});
 const body=await readJsonBody(request); const parsed=reportInput.safeParse(body); if(!parsed.success) return NextResponse.json({error:parsed.error.issues[0]?.message||"Check the report details."},{status:400});
 const db=await getDb(); const now=new Date(); const since=new Date(now.getTime()-3600000); const count=await db.collection("reports").countDocuments({reporter_id:session.user.id,created_at:{$gte:since}}); if(count>=5) return NextResponse.json({error:"You’ve reached the report limit. Try again later."},{status:429});
 const doc={...parsed.data,_id:crypto.randomUUID(),reporter_id:session.user.id,reporter_email:email,state:"open",created_at:now,updated_at:now,photos:[] as Array<{public_id:string;secure_url:string}>}; await db.collection("reports").insertOne(doc); await db.collection("status_history").insertOne({_id:crypto.randomUUID(),report_id:doc._id,actor_id:session.user.id,new_state:"open",created_at:now});
 try {
   const source={...parsed.data,id:doc._id,reporter_id:session.user.id,state:"open",created_at:now.toISOString()} as ItemReport;
   await notifyOwnersOfPotentialMatches(source);
 } catch(matchError) { console.error("Match notification dispatch failed",matchError); }
 return NextResponse.json({id:doc._id},{status:201});
 } catch(cause) { if(cause instanceof RequestBodyError)return NextResponse.json({error:cause.message},{status:cause.status}); console.error("Mongo report create failed",cause); return NextResponse.json({error:"Could not save the report."},{status:503}); }
}


