import type { Metadata } from "next";
import Link from "next/link";
import { OrganizationList, UserButton } from "@clerk/nextjs";
import { ArrowLeft, Sparkles } from "lucide-react";
import { isClerkConfigured } from "@/lib/auth-config";

export const metadata: Metadata = { title: "Choose a workspace" };

export default function SelectOrganizationPage() {
  if (!isClerkConfigured()) {
    return (
      <main className="noise grid min-h-screen place-items-center bg-[#edf7f0] px-5">
        <div className="max-w-lg rounded-[2rem] border border-black/8 bg-white p-8 text-center shadow-[0_28px_80px_rgba(16,37,29,0.12)] sm:p-12">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#10251d] text-lg font-black text-[#dbf97e]">Z</span>
          <h1 className="mt-6 text-3xl font-semibold tracking-[-0.04em]">Authentication needs configuring</h1>
          <p className="mt-4 text-sm leading-6 text-[#66756f]">Add the Clerk publishable and secret keys from <code className="rounded bg-black/5 px-1.5 py-0.5">.env.example</code>, then restart Ziggo to create or choose a workspace.</p>
          <Link href="/" className="mt-7 inline-flex h-11 items-center rounded-xl bg-[#10251d] px-5 text-sm font-semibold text-white">Return home</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="noise relative min-h-screen overflow-hidden bg-[#edf7f0] px-5 py-8 sm:px-8">
      <div className="absolute -left-40 top-20 size-[500px] rounded-full bg-[#b9f4d4]/70 blur-3xl" />
      <div className="absolute -right-48 bottom-0 size-[540px] rounded-full bg-[#dbf97e]/35 blur-3xl" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Back to Ziggo home">
          <span className="grid size-9 place-items-center rounded-xl bg-[#10251d] text-sm font-black text-[#dbf97e]">Z</span>
          <span className="text-xl font-bold tracking-[-0.04em]">ziggo</span>
        </Link>
        <UserButton />
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-100px)] max-w-6xl items-center gap-12 py-14 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <Link href="/" className="mb-9 inline-flex items-center gap-2 text-sm font-semibold text-[#527064] transition hover:text-[#196b4d]"><ArrowLeft className="size-4" /> Back home</Link>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#d8efe1] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#196b4d]"><Sparkles className="size-3.5" /> Your support workspace</div>
          <h1 className="balance max-w-xl text-5xl font-semibold leading-[0.95] tracking-[-0.06em] sm:text-6xl">Where are we helping customers today?</h1>
          <p className="pretty mt-6 max-w-lg text-base leading-7 text-[#66756f]">Choose an existing organization or create a new one. Ziggo will tailor the support conversation to the workspace you select.</p>
        </div>

        <div className="flex justify-center lg:justify-end">
          <div className="rounded-[2rem] border border-black/8 bg-white/65 p-3 shadow-[0_28px_80px_rgba(16,37,29,0.12)] backdrop-blur-xl sm:p-5">
            <OrganizationList
              hidePersonal
              afterSelectOrganizationUrl="/assistant"
              afterCreateOrganizationUrl="/assistant"
              appearance={{
                elements: {
                  rootBox: "w-full",
                  cardBox: "shadow-none",
                  card: "shadow-none bg-transparent border-0",
                  organizationListPreviewButton: "rounded-xl border border-black/8 hover:bg-[#edf7f0]",
                  organizationPreviewTextContainer: "text-left",
                  formButtonPrimary: "bg-[#10251d] hover:bg-[#196b4d]",
                  footer: "hidden",
                },
              }}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
