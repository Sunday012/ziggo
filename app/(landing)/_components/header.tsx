import React from "react";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
export const Header = () => {
  return (
    <div className="w-full flex items-center justify-center bg-[#5d66ad] text-white">
      <div className="flex justify-between items-center w-full xl:max-w-5xl py-4">
        <span className="bg-clip-text text-3xl font-extrabold text-transparent bg-gradient-to-r from-[#e2b9f7] to-[#fdfafc]">
          Ziggo-ChatAI
        </span>
        <SignedOut>
          <Button className="bg-[#2a2455] text-white">
            <SignInButton />
          </Button>
        </SignedOut>
        <SignedIn>
          <div className="flex items-center gap-4">
          <UserButton />
          <Button className="bg-[#2a2455] text-white ml-4">
            <Link href="/select-org">Get Started</Link>
          </Button>
          </div>
        </SignedIn>
      </div>
    </div>
  );
};
