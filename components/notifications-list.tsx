"use client";
import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
type Note={id:string;title:string;body:string;href:string|null;read_at:string|null;created_at:string};
export function NotificationsList({items}:{items:Note[]}){const [rows,setRows]=useState(items);async function mark(id:string){const r=await fetch("/api/member",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"notification_read",id})});if(r.ok)setRows(prev=>prev.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n))}return rows.length?<div>{rows.slice(0,5).map(n=><div className="notification-row" key={n.id}><span className={n.read_at?"notification-dot read":"notification-dot"}/><span className="notification-copy">{n.href?<Link href={n.href}><b>{n.title}</b><small>{n.body}</small></Link>:<><b>{n.title}</b><small>{n.body}</small></>}</span>{!n.read_at&&<button className="mark-read" onClick={()=>mark(n.id)} aria-label={`Mark ${n.title} as read`}><Check size={13}/></button>}</div>)}</div>:<div className="inline-empty"><p>You’re all caught up.</p></div>}
