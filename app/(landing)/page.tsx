import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  MessageCircleMore,
  Zap,
} from "lucide-react";
import { Show, SignInButton } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth-config";

const features = [
  {
    icon: MessageCircleMore,
    eyebrow: "Human by design",
    title: "Conversations, not canned replies.",
    copy: "Ziggo keeps the tone warm, the answers clear, and your brand present in every response.",
  },
  {
    icon: Zap,
    eyebrow: "Always available",
    title: "The quick answer, right on time.",
    copy: "Handle repetitive questions instantly and give your team more room for the conversations that need them.",
  },
  {
    icon: null,
    eyebrow: "Made for your business",
    title: "One agent. Your context.",
    copy: "Every workspace gets a focused support agent that understands the company it represents.",
  },
];

function PrimaryCta() {
  if (!isClerkConfigured()) {
    return (
      <a href="#platform" className="inline-flex h-14 items-center rounded-full bg-[#dbf97e] px-7 text-sm font-bold text-[#10251d] shadow-[0_12px_35px_rgba(219,249,126,0.18)] transition hover:-translate-y-0.5 hover:bg-white">
        Explore the platform <ArrowUpRight className="ml-2 size-4" />
      </a>
    );
  }

  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal" forceRedirectUrl="/select-org">
          <button className="inline-flex h-14 items-center rounded-full bg-[#dbf97e] px-7 text-sm font-bold text-[#10251d] shadow-[0_12px_35px_rgba(219,249,126,0.18)] transition hover:-translate-y-0.5 hover:bg-white">
            Build your support agent <ArrowUpRight className="ml-2 size-4" />
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <Link href="/select-org" className="inline-flex h-14 items-center rounded-full bg-[#dbf97e] px-7 text-sm font-bold text-[#10251d] shadow-[0_12px_35px_rgba(219,249,126,0.18)] transition hover:-translate-y-0.5 hover:bg-white">
          Open your workspace <ArrowUpRight className="ml-2 size-4" />
        </Link>
      </Show>
    </>
  );
}

export default function Home() {
  return (
    <main className="overflow-hidden">
      <section className="noise relative min-h-[940px] overflow-hidden bg-[#07130f] px-5 pb-20 pt-36 text-white sm:px-8 lg:min-h-[880px] lg:pt-44">
        <div className="pointer-events-none absolute -left-36 top-44 size-[520px] rounded-full bg-[#196b4d]/30 blur-[110px]" />
        <div className="pointer-events-none absolute -right-40 top-12 size-[620px] rounded-full bg-[#8ed7b2]/15 blur-[130px]" />
        <div className="mx-auto grid max-w-7xl items-center gap-16 lg:grid-cols-[0.88fr_1.12fr] lg:gap-10">
          <div className="relative z-10 fade-up">
            <h1 className="balance max-w-3xl text-[clamp(3.4rem,7.2vw,7rem)] font-semibold leading-[0.88] tracking-[-0.07em]">
              Support that <span className="font-serif italic text-[#dbf97e]">shows up.</span>
            </h1>
            <p className="pretty mt-7 max-w-xl text-lg leading-8 text-white/62 sm:text-xl">
              Turn everyday questions into thoughtful conversations with an AI agent that sounds like your best support teammate.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <PrimaryCta />
              <a href="#how-it-works" className="group inline-flex items-center text-sm font-semibold text-white/75 transition hover:text-white">
                See how it works <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
            <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-white/45">
              <span className="flex items-center gap-2"><Check className="size-3.5 text-[#b9f4d4]" /> Set up in minutes</span>
              <span className="flex items-center gap-2"><Check className="size-3.5 text-[#b9f4d4]" /> No credit card</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-2xl fade-up-delay lg:translate-x-10">
            <div className="absolute -inset-10 rounded-full bg-[#b9f4d4]/10 blur-3xl" />
            <div className="relative rotate-[1.5deg] overflow-hidden rounded-[2rem] border border-white/12 bg-[#f8f7f1] p-3 text-[#10251d] shadow-[0_35px_100px_rgba(0,0,0,0.42)] sm:p-4">
              <div className="flex h-[580px] overflow-hidden rounded-[1.35rem] bg-white sm:h-[610px]">
                <aside className="hidden w-[34%] flex-col bg-[#10251d] p-5 text-white sm:flex">
                  <div className="mb-10 flex items-center gap-2.5"><Image src="/ziggo-mark.png" alt="" width={28} height={28} className="size-7 rounded-lg" /><b>ziggo</b></div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Inbox</span>
                  <div className="mt-4 rounded-xl bg-white/10 p-3">
                    <div className="flex items-center gap-2"><span className="size-8 rounded-lg bg-[#b9f4d4]" /><div><div className="text-xs font-semibold">Northstar</div><div className="mt-1 text-[9px] text-white/45">Active now</div></div></div>
                  </div>
                  <div className="mt-auto rounded-2xl border border-white/8 bg-white/5 p-4"><Image src="/ziggo-mark.png" alt="" width={16} height={16} className="mb-3 size-4 rounded" /><p className="text-[11px] leading-5 text-white/55">Your agent resolved 84% of today&apos;s questions.</p></div>
                </aside>
                <div className="flex min-w-0 flex-1 flex-col bg-[#fbfaf6]">
                  <div className="flex items-center justify-between border-b border-black/6 px-5 py-4">
                    <div><div className="text-sm font-bold">Northstar support</div><div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#66756f]"><span className="size-1.5 rounded-full bg-emerald-500" /> Online</div></div>
                    <span className="rounded-full border border-black/8 px-3 py-1 text-[9px] font-bold uppercase tracking-wider">AI agent</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-4 overflow-hidden p-5 sm:p-7">
                    <div className="max-w-[86%] rounded-2xl rounded-tl-md bg-white p-4 text-xs leading-5 shadow-sm ring-1 ring-black/5">Hi Maya! I&apos;m Northstar&apos;s support agent. What can I help you with today?</div>
                    <div className="ml-auto max-w-[84%] rounded-2xl rounded-tr-md bg-[#196b4d] p-4 text-xs leading-5 text-white">Can I change the delivery address on my order?</div>
                    <div className="max-w-[88%] rounded-2xl rounded-tl-md bg-white p-4 text-xs leading-5 shadow-sm ring-1 ring-black/5">Absolutely — if it hasn&apos;t shipped yet, I can help update it. Could you share the order number?</div>
                    <div className="ml-auto max-w-[70%] rounded-2xl rounded-tr-md bg-[#196b4d] p-4 text-xs leading-5 text-white">It&apos;s NS-4821.</div>
                    <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-white p-4 text-xs leading-5 shadow-sm ring-1 ring-black/5">Perfect. Order NS-4821 is still being prepared, so the address can be changed. Send me the new address and I&apos;ll take it from here.</div>
                  </div>
                  <div className="m-4 flex items-center gap-3 rounded-xl border border-black/8 bg-white p-2 pl-4 text-xs text-[#819089] shadow-sm"><span className="flex-1">Type your message…</span><span className="grid size-9 place-items-center rounded-lg bg-[#10251d] text-white"><ArrowUpRight className="size-4" /></span></div>
                </div>
              </div>
            </div>
            <div className="absolute -left-3 top-24 hidden -rotate-6 rounded-2xl bg-[#dbf97e] p-4 text-[#10251d] shadow-xl sm:block lg:-left-12"><div className="text-2xl font-black">84%</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider">resolved instantly</div></div>
          </div>
        </div>
      </section>

      <section id="platform" className="bg-[#f6f3ec] px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-end">
            <div><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#196b4d]">A calmer support queue</span><h2 className="balance mt-4 max-w-2xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">Helpful at every turn.</h2></div>
            <p className="max-w-xl text-base leading-7 text-[#66756f] lg:justify-self-end">Fast should still feel thoughtful. Ziggo gives your customers clear answers in the moment and keeps your team focused on higher-value work.</p>
          </div>
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            {features.map(({ icon: Icon, eyebrow, title, copy }, index) => (
              <article key={title} className={`group rounded-[1.75rem] border border-black/8 p-7 transition duration-300 hover:-translate-y-1 ${index === 1 ? "bg-[#10251d] text-white" : "bg-[#fffdf8]"}`}>
                <div className={`grid size-12 place-items-center rounded-2xl ${index === 1 ? "bg-[#dbf97e] text-[#10251d]" : "bg-[#dff6e8] text-[#196b4d]"}`}>{Icon ? <Icon className="size-5" /> : <Image src="/ziggo-mark.png" alt="" width={28} height={28} className="size-7 rounded-lg" />}</div>
                <p className={`mt-12 text-xs font-bold uppercase tracking-[0.15em] ${index === 1 ? "text-[#b9f4d4]" : "text-[#196b4d]"}`}>{eyebrow}</p>
                <h3 className="balance mt-3 text-3xl font-semibold leading-tight tracking-[-0.04em]">{title}</h3>
                <p className={`pretty mt-4 text-sm leading-6 ${index === 1 ? "text-white/55" : "text-[#66756f]"}`}>{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-[#b9f4d4] px-5 py-24 sm:px-8 lg:py-32">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-16 lg:grid-cols-[0.8fr_1.2fr]">
            <div><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#196b4d]">From zero to helpful</span><h2 className="balance mt-4 text-5xl font-semibold leading-[0.98] tracking-[-0.055em]">Ready before your next ticket arrives.</h2><p className="mt-6 max-w-md text-base leading-7 text-[#375c4e]">Start with your organization, open a conversation, and give your customers a faster path to the right answer.</p></div>
            <ol className="divide-y divide-[#10251d]/15 border-y border-[#10251d]/15">
              {[['01', 'Create your workspace', 'Give your business a home and invite your team when you are ready.'], ['02', 'Meet your AI agent', 'Ziggo creates a dedicated assistant around the active organization.'], ['03', 'Start resolving', 'Ask, refine, and keep the conversation moving with live streamed responses.']].map(([number, title, copy]) => (
                <li key={number} className="grid gap-4 py-7 sm:grid-cols-[70px_1fr_1.2fr] sm:items-start"><span className="font-mono text-xs font-bold text-[#196b4d]">{number}</span><h3 className="text-xl font-bold tracking-[-0.025em]">{title}</h3><p className="text-sm leading-6 text-[#375c4e]">{copy}</p></li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="why-ziggo" className="noise bg-[#07130f] px-5 py-24 text-white sm:px-8 lg:py-32">
        <div className="mx-auto max-w-5xl text-center"><Clock3 className="mx-auto size-8 text-[#dbf97e]" /><h2 className="balance mt-7 text-5xl font-semibold leading-[0.95] tracking-[-0.06em] sm:text-7xl">Give time back to your team. Give care back to support.</h2><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/55">A support experience customers enjoy and a queue your team can finally breathe around.</p><div className="mt-10"><PrimaryCta /></div></div>
      </section>

      <footer className="bg-[#07130f] px-5 pb-10 text-white sm:px-8"><div className="mx-auto flex max-w-7xl flex-col gap-5 border-t border-white/10 pt-8 text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between"><span>© {new Date().getFullYear()} Ziggo. Thoughtful support, on demand.</span><div className="flex gap-5"><Link href="/" className="hover:text-white">Privacy</Link><Link href="/" className="hover:text-white">Terms</Link></div></div></footer>
    </main>
  );
}
