"use client";
import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
export default function ErrorPage({error,reset}:{error:Error&{digest?:string};reset:()=>void}){useEffect(()=>{console.error(error)},[error]);return <main className="gate-page"><div className="gate-card"><span className="eyebrow">A small interruption</span><h1>We couldn’t load this page.</h1><p>Your report data hasn’t been changed. Try again, or return to the campus board.</p><button className="button button-teal" onClick={()=>reset()}><RefreshCw size={15}/>Try again</button><div style={{marginTop:12}}><Link className="text-link" href="/">Go to home</Link></div></div></main>}
