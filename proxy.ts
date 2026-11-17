import { NextResponse, type NextFetchEvent, type NextMiddleware, type NextRequest } from "next/server";
import { auth, type NextAuthRequest } from "@/auth";

const passThrough = (() => NextResponse.next()) as (request: NextAuthRequest, event: NextFetchEvent) => NextResponse;
const authProxy: NextMiddleware = auth(passThrough);

export function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.AUTH_SECRET) {
    return NextResponse.next();
  }
  return authProxy(request, event);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)"] };
