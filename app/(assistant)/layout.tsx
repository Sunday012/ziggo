import { SideNav } from "./_components/sidenav";

export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-dvh min-h-[640px] overflow-hidden bg-[#f6f3ec]">
      <div className="hidden h-full lg:block"><SideNav /></div>
      {children}
    </main>
  );
}
