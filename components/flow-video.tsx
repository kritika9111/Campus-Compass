"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
export function FlowVideo(){
 const [open,setOpen]=useState(false);const [motionAllowed,setMotionAllowed]=useState(true);
 useEffect(()=>{setMotionAllowed(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);let live=true;fetch("/api/member?type=preferences").then(r=>r.ok?r.json():null).then(async d=>{if(!live)return;if(d&&!d.preferences?.flow_intro_seen){setOpen(true);await fetch("/api/member",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({type:"flow_seen"})})}else if(!d){try{if(!localStorage.getItem("cc-flow-seen")){setOpen(true);localStorage.setItem("cc-flow-seen","1")}}catch{}}}).catch(()=>{});return()=>{live=false}},[]);
 if(!open)return null;const close=()=>setOpen(false);
 return <div className="video-backdrop flow-backdrop" role="dialog" aria-modal="true" aria-label="How to reunite a campus belonging"><div className="video-panel flow-panel"><div className="video-top"><div><span className="eyebrow">Find · report · reunite</span><h2>A little care can bring it all the way home.</h2></div><button className="round-button" onClick={close} aria-label="Skip introduction"><X/></button></div>{motionAllowed?<video className="intro-video" src="/media/microscope-flow.mp4" autoPlay muted playsInline onEnded={close} aria-label="A microscope zooms toward Earth"/>:<div className="reduced-motion-card"><span className="eyebrow">You’re on the campus board</span><p>Choose what to find, or report what you found.</p></div>}<div className="video-bottom"><span>Private, campus-only connections</span><button className="button button-teal" onClick={close}>Continue <span>↗</span></button></div></div></div>
}
