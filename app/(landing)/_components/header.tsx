import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { isClerkConfigured } from "@/lib/auth-config";

export function Header() {
  const authConfigured = isClerkConfigured();

  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5" aria-label="Ziggo home">
          <Image src="/ziggo-mark.png" alt="" width={36} height={36} className="size-9 rounded-xl transition-transform group-hover:-rotate-6" priority />
          <span className="text-xl font-bold tracking-[-0.04em] text-white">ziggo</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-white/70 md:flex" aria-label="Main navigation">
          <Link href="#platform" className="transition hover:text-white">Platform</Link>
          <Link href="#how-it-works" className="transition hover:text-white">How it works</Link>
          <Link href="#why-ziggo" className="transition hover:text-white">Why Ziggo</Link>
        </nav>

        <div className="flex items-center gap-2">
          {!authConfigured ? (
            <Button asChild className="h-10 rounded-full bg-white px-4 text-[#10251d] hover:bg-[#dbf97e] sm:px-5">
              <a href="#platform">Explore Ziggo <ArrowUpRight className="ml-1.5 size-4" /></a>
            </Button>
          ) : (<>
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button className="hidden px-3 py-2 text-sm font-semibold text-white/80 transition hover:text-white sm:block">
                Sign in
              </button>
            </SignInButton>
            <SignInButton mode="modal" forceRedirectUrl="/select-org">
              <Button className="h-10 rounded-full bg-white px-4 text-[#10251d] hover:bg-[#dbf97e] sm:px-5">
                Get started <ArrowUpRight className="ml-1.5 size-4" />
              </Button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <UserButton />
            <Button asChild className="h-10 rounded-full bg-white px-4 text-[#10251d] hover:bg-[#dbf97e] sm:px-5">
              <Link href="/select-org">Open workspace <ArrowUpRight className="ml-1.5 size-4" /></Link>
            </Button>
          </Show>
          </>)}
        </div>
      </div>
    </header>
  );
}
