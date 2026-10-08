import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isClerkConfigured } from "@/lib/auth-config";
import { AuthFrame } from "../_components/auth-frame";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (!isClerkConfigured()) return <AuthFrame eyebrow="Setup required" title="Authentication is not configured" description="Add the Clerk environment variables, then restart Ziggo."><p className="text-sm text-[#66756f]">See <code>.env.example</code> for the required server-side credentials.</p></AuthFrame>;
  const { userId } = await auth();
  if (userId) redirect("/select-org");
  return <AuthFrame eyebrow="Start with Ziggo" title="Create your account" description="Verify your email, create a workspace, and give your support agent the right context."><SignUpForm /></AuthFrame>;
}

