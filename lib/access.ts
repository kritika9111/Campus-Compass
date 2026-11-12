import { auth } from "@/auth";
import { getDb } from "@/lib/mongodb";
import type { CampusRole } from "@/lib/types";
export async function getMember() {
 const session=await auth(); const email=session?.user?.email?.toLowerCase();
 if(!session||!email) return {user:null,approved:false,role:"member" as CampusRole,profile:null};
 const db=await getDb(); const profile=await db.collection("users").findOne({email});
 const domain=email.split("@").at(-1);
 return {user:{id:session.user.id||email,email,name:session.user.name||""},approved:domain==="gmail.com"||domain==="googlemail.com",role:(profile?.role||"member") as CampusRole,profile};
}
