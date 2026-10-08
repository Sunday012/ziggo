import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/auth-config";
import { AuthFrame } from "../_components/auth-frame";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (!isClerkConfigured()) return <AuthSetupRequired />;
  const { userId } = await auth();
  if (userId) redirect("/select-org");
  return <AuthFrame eyebrow="Welcome back" title="Sign in to Ziggo" description="Open your support workspace and pick up where your team left off."><SignInForm /></AuthFrame>;
}

function AuthSetupRequired() {
  return <AuthFrame eyebrow="Setup required" title="Authentication is not configured" description="Add the Clerk environment variables, then restart Ziggo."><p className="text-sm text-[#66756f]">See <code>.env.example</code> for the required server-side credentials.</p></AuthFrame>;
}

