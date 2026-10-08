"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization, useOrganizationList } from "@clerk/nextjs";
import { ArrowLeft, ArrowRight, Building2, Check, Plus } from "lucide-react";
import { getAuthErrorMessage } from "@/lib/auth-errors";

export function WorkspacePicker() {
  const router = useRouter();
  const { organization: activeOrganization } = useOrganization();
  const { isLoaded, createOrganization, setActive, userMemberships } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openWorkspace(organizationId: string) {
    if (!setActive) return;
    setBusyId(organizationId);
    setError(null);
    try {
      await setActive({ organization: organizationId });
      router.push("/assistant");
      router.refresh();
    } catch (error) {
      setError(getAuthErrorMessage(error, "That workspace could not be opened. Please try again."));
      setBusyId(null);
    }
  }

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createOrganization || !setActive) return;
    setBusyId("new");
    setError(null);
    try {
      const organization = await createOrganization({ name: name.trim() });
      await setActive({ organization: organization.id });
      router.push("/assistant");
      router.refresh();
    } catch (error) {
      setError(getAuthErrorMessage(error, "Your workspace could not be created. Please try another name."));
      setBusyId(null);
    }
  }

  if (!isLoaded) {
    return <div className="w-full max-w-xl space-y-3 rounded-[2rem] border border-black/8 bg-white/70 p-5 shadow-[0_28px_80px_rgba(16,37,29,0.12)]"><div className="h-16 animate-pulse rounded-2xl bg-black/5" /><div className="h-16 animate-pulse rounded-2xl bg-black/5" /><div className="h-12 animate-pulse rounded-xl bg-black/5" /></div>;
  }

  if (creating) {
    return (
      <div className="w-full max-w-xl rounded-[2rem] border border-black/8 bg-white/75 p-6 shadow-[0_28px_80px_rgba(16,37,29,0.12)] backdrop-blur-xl sm:p-8">
        <button type="button" onClick={() => { setCreating(false); setError(null); }} className="inline-flex items-center gap-2 text-xs font-bold text-[#66756f] transition hover:text-[#10251d]"><ArrowLeft className="size-3.5" /> All workspaces</button>
        <div className="mt-7 grid size-12 place-items-center rounded-2xl bg-[#dff6e8] text-[#196b4d]"><Building2 className="size-5" /></div>
        <h2 className="mt-5 text-3xl font-semibold tracking-[-0.045em]">Create a workspace</h2>
        <p className="mt-2 text-sm leading-6 text-[#66756f]">Use your company or team name. You can invite teammates after setup.</p>
        <form onSubmit={createWorkspace} className="mt-7">
          <label htmlFor="workspace-name" className="text-xs font-bold">Workspace name</label>
          <input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={64} autoFocus className="mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none transition focus:border-[#196b4d]/55 focus:ring-4 focus:ring-[#196b4d]/8" placeholder="Acme Support" required />
          {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</p>}
          <button type="submit" disabled={busyId === "new" || name.trim().length < 2} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white transition hover:bg-[#196b4d] disabled:opacity-45">{busyId === "new" ? "Creating workspace…" : "Create workspace"}<ArrowRight className="size-4" /></button>
        </form>
      </div>
    );
  }

  const memberships = userMemberships.data ?? [];
  return (
    <div className="w-full max-w-xl rounded-[2rem] border border-black/8 bg-white/75 p-5 shadow-[0_28px_80px_rgba(16,37,29,0.12)] backdrop-blur-xl sm:p-7">
      <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[#196b4d]">Your workspaces</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">Choose where to work</h2></div><span className="rounded-full bg-[#edf7f0] px-3 py-1.5 text-[10px] font-bold text-[#527064]">{memberships.length} {memberships.length === 1 ? "workspace" : "workspaces"}</span></div>
      <div className="mt-6 space-y-2">
        {memberships.map(({ organization }) => {
          const isActive = activeOrganization?.id === organization.id;
          return <button key={organization.id} type="button" onClick={() => void openWorkspace(organization.id)} disabled={Boolean(busyId)} className="group flex w-full items-center gap-3 rounded-2xl border border-black/7 bg-white p-3 text-left transition hover:border-[#196b4d]/25 hover:bg-[#f5fbf7] disabled:opacity-50"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#10251d] text-xs font-black text-[#dbf97e]">{organization.name.slice(0, 2).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{organization.name}</span><span className="mt-1 flex items-center gap-1.5 text-[10px] text-[#75837d]">{isActive ? <><Check className="size-3 text-[#196b4d]" /> Currently active</> : "Support workspace"}</span></span><ArrowRight className="size-4 text-[#a4ada9] transition group-hover:translate-x-0.5 group-hover:text-[#196b4d]" /></button>;
        })}
        {memberships.length === 0 && <div className="rounded-2xl border border-dashed border-black/12 bg-white/50 px-6 py-8 text-center"><Building2 className="mx-auto size-6 text-[#8a9691]" /><p className="mt-3 text-sm font-bold">Your first workspace starts here</p><p className="mt-2 text-xs leading-5 text-[#75837d]">Create a home for your support agent, knowledge, and team.</p></div>}
      </div>
      {userMemberships.hasNextPage && <button type="button" disabled={userMemberships.isFetching} onClick={() => userMemberships.fetchNext()} className="mt-3 h-10 w-full rounded-xl text-xs font-bold text-[#527064] hover:bg-black/5">{userMemberships.isFetching ? "Loading…" : "Load more workspaces"}</button>}
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</p>}
      <button type="button" onClick={() => { setCreating(true); setError(null); }} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#196b4d]/20 bg-[#edf7f0] text-sm font-bold text-[#196b4d] transition hover:border-[#196b4d]/35 hover:bg-[#dff6e8]"><Plus className="size-4" /> Create another workspace</button>
    </div>
  );
}

