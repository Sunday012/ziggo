"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut, PanelsTopLeft } from "lucide-react";

export function AccountMenu({ theme = "light" }: { theme?: "light" | "dark" }) {
  const { signOut } = useClerk();
  const { user, isLoaded } = useUser();
  const initials = user?.fullName
    ? user.fullName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()
    : user?.primaryEmailAddress?.emailAddress.slice(0, 1).toUpperCase() ?? "U";
  const dark = theme === "dark";

  if (!isLoaded) return <span className={`block size-9 animate-pulse rounded-full ${dark ? "bg-white/10" : "bg-black/8"}`} />;

  return (
    <details className="group relative">
      <summary className={`grid size-9 cursor-pointer list-none place-items-center rounded-full text-xs font-bold outline-none ring-offset-2 transition focus-visible:ring-2 ${dark ? "bg-[#dbf97e] text-[#10251d] ring-offset-[#07130f] focus-visible:ring-[#dbf97e]" : "bg-[#10251d] text-white ring-offset-[#edf7f0] focus-visible:ring-[#196b4d]"}`} aria-label="Open account menu">
        {initials}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-black/8 bg-white p-2 text-[#10251d] shadow-[0_24px_70px_rgba(16,37,29,0.2)]">
        <div className="border-b border-black/7 px-3 py-3">
          <p className="truncate text-sm font-bold">{user?.fullName || "Ziggo account"}</p>
          <p className="mt-1 truncate text-xs text-[#75837d]">{user?.primaryEmailAddress?.emailAddress}</p>
        </div>
        <Link href="/select-org" className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition hover:bg-[#edf7f0]"><PanelsTopLeft className="size-4 text-[#196b4d]" /> Workspaces</Link>
        <button type="button" onClick={() => void signOut({ redirectUrl: "/" })} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-semibold text-red-700 transition hover:bg-red-50"><LogOut className="size-4" /> Sign out</button>
      </div>
    </details>
  );
}

