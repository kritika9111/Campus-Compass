"use client";
import { useEffect, useState } from "react";
import { X, Volume2, VolumeX } from "lucide-react";
export function WelcomeVideo(){
 const [open,setOpen]=useState(false);const [muted,setMuted]=useState(true);const [motionAllowed,setMotionAllowed]=useState(true);
 useEffect(()=>{setMotionAllowed(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);try{if(!localStorage.getItem("cc-welcome-seen"))setOpen(true)}catch{setOpen(true)}},[]);
 function finish(){try{localStorage.setItem("cc-welcome-seen","1")}catch{}setOpen(false)}
 if(!open)return null;
 return <div className="video-backdrop" role="dialog" aria-modal="true" aria-label="Welcome to Campus Compass"><div className="video-panel"><div className="video-top"><div><span className="eyebrow">A welcome to campus</span><h2>Every lost belonging deserves a way home.</h2></div><button className="round-button" onClick={finish} aria-label="Skip introduction"><X/></button></div>{motionAllowed?<video className="intro-video" src="/media/key-welcome.mp4" autoPlay muted={muted} playsInline onEnded={finish} aria-label="Campus Compass welcome film"/>:<div className="reduced-motion-card"><span className="eyebrow">Welcome to Campus Compass</span><p>Every lost belonging deserves a way home.</p></div>}<div className="video-bottom"><span>Campus Compass · LPU</span><div>{motionAllowed&&<button className="text-button" onClick={()=>setMuted(!muted)}>{muted?<VolumeX size={16}/>:<Volume2 size={16}/>} {muted?"Sound off":"Sound on"}</button>}<button className="button button-teal" onClick={finish}>Continue to Campus Compass <span>↗</span></button></div></div></div></div>
}
