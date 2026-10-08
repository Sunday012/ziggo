import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isClerkConfigured } from "@/lib/auth-config";

const protectedPrefixes = ["/assistant", "/select-org", "/api/"];

const authenticatedProxy = clerkMiddleware(async (auth, request) => {
  if (protectedPrefixes.some((prefix) => request.nextUrl.pathname.startsWith(prefix))) {
    await auth.protect();
  }
}, { signInUrl: "/sign-in", signUpUrl: "/sign-up" });

export default isClerkConfigured()
  ? authenticatedProxy
  : function unconfiguredProxy(request: Request) {
      const url = new URL(request.url);
      if (protectedPrefixes.some((prefix) => url.pathname.startsWith(prefix))) {
        return NextResponse.redirect(new URL("/?setup=authentication", request.url));
      }
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
