import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";

export function AuthFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="noise relative min-h-screen overflow-hidden bg-[#07130f] px-5 py-6 text-white sm:px-8">
      <div className="pointer-events-none absolute -left-48 top-16 size-[520px] rounded-full bg-[#196b4d]/35 blur-[120px]" />
      <div className="pointer-events-none absolute -right-52 bottom-0 size-[580px] rounded-full bg-[#dbf97e]/12 blur-[140px]" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Ziggo home">
          <Image src="/ziggo-mark.png" alt="" width={38} height={38} className="size-9 rounded-xl" priority />
          <span className="text-xl font-bold tracking-[-0.04em]">ziggo</span>
        </Link>
        <Link href="/" className="text-sm font-semibold text-white/55 transition hover:text-white">Back home</Link>
      </header>

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-84px)] max-w-6xl items-center gap-12 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-20">
        <div className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b9f4d4]">{eyebrow}</p>
          <h1 className="balance mt-5 max-w-lg text-6xl font-semibold leading-[0.92] tracking-[-0.065em]">Support that already knows the business.</h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/55">Create one secure workspace for your team, your approved knowledge, and every customer conversation.</p>
          <div className="mt-9 space-y-3 text-sm text-white/65">
            {["Organization-isolated knowledge", "Approval-controlled agent actions", "Clear activity and source history"].map((item) => <div key={item} className="flex items-center gap-3"><span className="grid size-6 place-items-center rounded-full bg-white/8"><Check className="size-3.5 text-[#dbf97e]" /></span>{item}</div>)}
          </div>
        </div>

        <div className="mx-auto w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#fbfaf6] p-6 text-[#10251d] shadow-[0_35px_100px_rgba(0,0,0,0.38)] sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#196b4d]">{eyebrow}</p>
          <h2 className="mt-3 text-4xl font-semibold tracking-[-0.055em]">{title}</h2>
          <p className="mt-3 text-sm leading-6 text-[#66756f]">{description}</p>
          <div className="mt-7">{children}</div>
        </div>
      </section>
    </main>
  );
}

