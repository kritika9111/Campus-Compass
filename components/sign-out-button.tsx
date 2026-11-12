"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
export function SignOutButton(){return <button className="button button-outline signout" onClick={()=>signOut({callbackUrl:"/"})}><LogOut size={15}/>Sign out</button>}
