import { NextResponse } from "next/server";
import type { UploadApiResponse } from "cloudinary";
import type { Document, UpdateFilter } from "mongodb";
import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import { cloudinary } from "@/lib/cloudinary";
import { isSameOrigin } from "@/lib/http";
type Ctx={params:Promise<{id:string}>};
const allowed=new Set(["image/jpeg","image/png","image/webp"]);
export async function POST(request:Request,{params}:Ctx){if(!isSameOrigin(request))return NextResponse.json({error:"Cross-origin request denied."},{status:403});const session=await auth();if(!session?.user?.id)return NextResponse.json({error:"Sign in required."},{status:401});const {id}=await params;const db=await getDb();const report=await db.collection("reports").findOne({_id:id,reporter_id:session.user.id});if(!report)return NextResponse.json({error:"Report not found or not owned by you."},{status:404});const form=await request.formData();const file=form.get("file");if(!(file instanceof File)||!allowed.has(file.type)||file.size>5*1024*1024)return NextResponse.json({error:"Upload a JPG, PNG, or WebP image up to 5 MB."},{status:400});if((report.photos?.length||0)>=4)return NextResponse.json({error:"Maximum 4 photos per report."},{status:400});const bytes=Buffer.from(await file.arrayBuffer());const uploaded=await new Promise<UploadApiResponse>((resolve,reject)=>cloudinary.uploader.upload_stream({folder:`campus-compass/${id}`,resource_type:"image",type:"authenticated",access_mode:"authenticated",allowed_formats:["jpg","jpeg","png","webp"],max_file_size:5*1024*1024},(err,result)=>err||!result?reject(err||new Error("Cloudinary upload returned no result.")):resolve(result)).end(bytes));const photo={public_id:uploaded.public_id,secure_url:uploaded.secure_url,format:uploaded.format,bytes:uploaded.bytes,created_at:new Date()};await db.collection("reports").updateOne({_id:id,reporter_id:session.user.id},{$push:{photos:photo} as UpdateFilter<Document & {_id:string}>});return NextResponse.json({photo:{...photo,url:cloudinary.url(photo.public_id,{type:"authenticated",sign_url:true,secure:true})}},{status:201});}

