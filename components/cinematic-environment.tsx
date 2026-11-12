"use client";
import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";

const specks = [
  [9,18],[18,32],[28,12],[37,23],[48,10],[56,28],[65,15],[76,27],[87,13],[94,35],
  [6,52],[15,68],[25,47],[34,76],[45,61],[55,49],[67,72],[78,54],[88,78],[96,61],
  [12,88],[31,91],[50,83],[70,93],[91,89]
];

export function CinematicEnvironment(){
  const reduceMotion=useReducedMotion();
  const px=useMotionValue(0),py=useMotionValue(0);
  const sx=useSpring(px,{stiffness:35,damping:18,mass:.7}),sy=useSpring(py,{stiffness:35,damping:18,mass:.7});
  useEffect(()=>{
    if(reduceMotion||window.matchMedia("(pointer:coarse)").matches)return;
    let frame=0;
    const move=(event:PointerEvent)=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const x=(event.clientX/window.innerWidth-.5)*-12;
        const y=(event.clientY/window.innerHeight-.5)*-8;
        px.set(x);py.set(y);
      });
    };
    window.addEventListener("pointermove",move,{passive:true});
    return()=>{window.removeEventListener("pointermove",move);cancelAnimationFrame(frame)};
  },[px,py,reduceMotion]);
  return <div className="ambient-environment" aria-hidden="true">
    <motion.div className="campus-skyline" style={{x:sx,y:sy}}/>
    <div className="environment-vignette"/>
    <div className="ambient-orb ambient-orb-pink"/>
    <div className="ambient-orb ambient-orb-violet"/>
    <div className="ambient-orb ambient-orb-blue"/>
    <div className="environment-scanline"/>
    <div className="environment-particles">{specks.map(([left,top],i)=><span key={i} style={{left:`${left}%`,top:`${top}%`,animationDelay:`${(i%9)*-.67}s`,animationDuration:`${7+(i%7)}s`}}/>)}</div>
  </div>
}
