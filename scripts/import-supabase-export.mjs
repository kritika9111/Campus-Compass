// Reads JSON arrays exported from Supabase. See README for the expected user-map.
import fs from "node:fs/promises";
import path from "node:path";
import { MongoClient } from "mongodb";
import { v2 as cloudinary } from "cloudinary";
const input=path.resolve(process.argv[2]||"supabase-export");
if(!process.env.MONGODB_URI)throw new Error("Set MONGODB_URI first.");
const client=new MongoClient(process.env.MONGODB_URI);await client.connect();
const db=client.db(process.env.MONGODB_DB||"campus_compass");
const map=JSON.parse(await fs.readFile(path.join(input,"user-map.json"),"utf8"));
const uid=id=>{const email=map[id];if(!email)throw new Error(`Missing email mapping for legacy user ${id}`);return String(email).trim().toLowerCase();};
const read=async name=>{try{return JSON.parse(await fs.readFile(path.join(input,`${name}.json`),"utf8"));}catch(e){if(e.code==="ENOENT")return [];throw e;}};
const date=x=>x?new Date(x):new Date();
const put=async(source,target,convert)=>{const rows=(await read(source)).map(convert);if(rows.length)await db.collection(target).insertMany(rows,{ordered:false});console.log(`${source}: ${rows.length}`);};
try{
 await put("profiles","users",r=>({_id:uid(r.id),email:uid(r.id),name:r.display_name||"",role:r.campus_role||"member",created_at:date(r.created_at),updated_at:date(r.updated_at)}));
 await put("item_reports","reports",r=>({_id:String(r.id),reporter_id:uid(r.reporter_id),reporter_email:uid(r.reporter_id),kind:r.kind,title:r.title,category:r.category,description:r.description,location:r.location,happened_at:r.happened_at,created_at:date(r.created_at),updated_at:date(r.updated_at),state:r.state,photos:[]}));
 await put("claims","claims",r=>({_id:String(r.id),report_id:String(r.report_id),claimant_id:uid(r.claimant_id),ownership_details:r.ownership_details,state:r.state,created_at:date(r.created_at),updated_at:date(r.updated_at)}));
 await put("claim_messages","messages",r=>({_id:String(r.id),claim_id:String(r.claim_id),sender_id:uid(r.sender_id),body:r.body,created_at:date(r.created_at)}));
 await put("claim_status_history","claim_status_history",r=>({_id:String(r.id),claim_id:String(r.claim_id),actor_id:r.actor_id?uid(r.actor_id):null,old_state:r.old_state,new_state:r.new_state,note:r.note,created_at:date(r.created_at)}));
 await put("saved_items","saved_items",r=>({_id:`${uid(r.user_id)}:${r.report_id}`,user_id:uid(r.user_id),report_id:String(r.report_id),created_at:date(r.created_at)}));
 await put("notifications","notifications",r=>({_id:String(r.id),user_id:uid(r.user_id),kind:r.kind,title:r.title,body:r.body,href:r.href,read_at:r.read_at?date(r.read_at):null,created_at:date(r.created_at)}));
 await put("member_preferences","member_preferences",r=>({_id:uid(r.user_id),user_id:uid(r.user_id),flow_intro_seen:Boolean(r.flow_intro_seen),notification_preferences:r.notification_preferences||{claims:true,updates:true},updated_at:date(r.updated_at)}));
 await put("status_history","status_history",r=>({_id:String(r.id),report_id:String(r.report_id),actor_id:r.actor_id?uid(r.actor_id):null,old_state:r.old_state,new_state:r.new_state,note:r.note,created_at:date(r.created_at)}));
 await put("moderation_actions","moderation_actions",r=>({_id:String(r.id),report_id:r.report_id?String(r.report_id):null,actor_id:uid(r.actor_id),action:r.action,reason:r.reason,created_at:date(r.created_at)}));
 const photos=await read("report_photos");
 if(photos.length){cloudinary.config({cloud_name:process.env.CLOUDINARY_CLOUD_NAME,api_key:process.env.CLOUDINARY_API_KEY,api_secret:process.env.CLOUDINARY_API_SECRET,secure:true});for(const p of photos){if(!p.local_file)continue;const reportId=String(p.report_id);const uploaded=await cloudinary.uploader.upload(path.resolve(input,p.local_file),{folder:`campus-compass/${reportId}`,type:"authenticated",access_mode:"authenticated",resource_type:"image"});await db.collection("reports").updateOne({_id:reportId},{$push:{photos:{public_id:uploaded.public_id,secure_url:uploaded.secure_url,format:uploaded.format,bytes:uploaded.bytes,created_at:date(p.created_at)}}});}console.log(`photos exported: ${photos.length}`);}
}finally{await client.close();}
