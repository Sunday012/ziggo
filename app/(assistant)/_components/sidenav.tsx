"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList, UserButton } from "@clerk/nextjs";
import { ChevronRight, MessageCircleMore, Plus, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function SideNav() {
  const router = useRouter();
  const { organization } = useOrganization();
  const { userMemberships, isLoaded, setActive } = useOrganizationList({
    userMemberships: { infinite: true },
  });

  async function selectOrganization(organizationId: string) {
    await setActive?.({ organization: organizationId });
    router.push("/assistant");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-full flex-col bg-[#0b1f18] p-4 text-white lg:w-[310px] lg:shrink-0 lg:p-5">
      <div className="flex items-center justify-between px-1 py-1">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-[#dbf97e] text-sm font-black text-[#10251d]">Z</span>
          <span className="text-xl font-bold tracking-[-0.04em]">ziggo</span>
        </Link>
        <UserButton />
      </div>

      <div className="mt-10 flex items-center justify-between px-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/35">Your workspaces</span>
        <Link href="/select-org" className="grid size-7 place-items-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white" aria-label="Add workspace"><Plus className="size-4" /></Link>
      </div>

      <div className="mt-3 space-y-1.5 overflow-y-auto">
        {!isLoaded && [0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-white/5" />)}
        {userMemberships?.data?.map(({ organization: item }) => {
          const isActive = organization?.id === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void selectOrganization(item.id)}
              className={`group flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition ${isActive ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              <Avatar className="size-10 rounded-xl">
                <AvatarImage src={item.imageUrl} alt="" />
                <AvatarFallback className="rounded-xl bg-[#b9f4d4] text-xs font-black text-[#10251d]">{item.name.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{item.name}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/40"><span className={`size-1.5 rounded-full ${isActive ? "bg-[#b9f4d4]" : "bg-white/25"}`} /> {isActive ? "Active agent" : "Open agent"}</span>
              </span>
              <ChevronRight className="size-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/55" />
            </button>
          );
        })}
      </div>

      <div className="mt-auto rounded-2xl border border-white/8 bg-white/[0.045] p-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#dbf97e]"><Sparkles className="size-3.5" /> Ziggo AI</div>
        <p className="mt-2 text-xs leading-5 text-white/40">Clear, contextual answers for every customer conversation.</p>
        <div className="mt-4 flex items-center gap-2 border-t border-white/8 pt-3 text-[10px] font-medium text-white/35"><MessageCircleMore className="size-3.5" /> Ready to help</div>
      </div>
    </aside>
  );
}
