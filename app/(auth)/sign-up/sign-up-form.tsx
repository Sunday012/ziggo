"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignUp } from "@clerk/nextjs";
import { ArrowRight, Eye, EyeOff, MailCheck } from "lucide-react";
import { getAuthErrorMessage } from "@/lib/auth-errors";

const inputClass = "mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none transition placeholder:text-[#9aa49f] focus:border-[#196b4d]/55 focus:ring-4 focus:ring-[#196b4d]/8";

export function SignUpForm() {
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isBusy = fetchStatus === "fetching";
  const globalError = errors.global?.[0]?.longMessage ?? errors.global?.[0]?.message ?? null;

  async function finishSignUp() {
    await signUp.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/select-org");
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
  }

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const { error } = await signUp.password({ emailAddress: email.trim(), password });
      if (error) throw error;
      const sent = await signUp.verifications.sendEmailCode();
      if (sent.error) throw sent.error;
      setVerificationSent(true);
    } catch (error) {
      setLocalError(getAuthErrorMessage(error, "Your Ziggo account could not be created. Please try again."));
    }
  }

  async function verifyAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const { error } = await signUp.verifications.verifyEmailCode({ code });
      if (error) throw error;
      if (signUp.status === "complete") await finishSignUp();
      else setLocalError("Your email was verified, but the account still needs more information.");
    } catch (error) {
      setLocalError(getAuthErrorMessage(error, "That verification code is invalid or has expired."));
    }
  }

  async function changeEmail() {
    await signUp.reset();
    setVerificationSent(false);
    setCode("");
    setPassword("");
    setLocalError(null);
  }

  if (verificationSent) {
    return (
      <form onSubmit={verifyAccount} className="space-y-5">
        <div className="rounded-2xl bg-[#edf7f0] p-4"><div className="flex items-center gap-2 text-sm font-bold"><MailCheck className="size-4 text-[#196b4d]" /> Check your inbox</div><p className="mt-2 text-xs leading-5 text-[#66756f]">We sent a six-digit code to <strong>{email}</strong>.</p></div>
        <div><label htmlFor="signup-code" className="text-xs font-bold">Verification code</label><input id="signup-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" className={inputClass} placeholder="Enter your code" required />{errors.fields.code && <p className="mt-1.5 text-xs text-red-700">{errors.fields.code.message}</p>}</div>
        <AuthError message={localError || globalError} />
        <button type="submit" disabled={isBusy || code.trim().length < 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white transition hover:bg-[#196b4d] disabled:opacity-45">{isBusy ? "Verifying…" : "Verify and continue"}<ArrowRight className="size-4" /></button>
        <div className="flex items-center justify-between text-xs"><button type="button" onClick={() => void changeEmail()} className="font-semibold text-[#66756f] hover:text-[#10251d]">Use another email</button><button type="button" onClick={() => void signUp.verifications.sendEmailCode()} className="font-bold text-[#196b4d]">Send another code</button></div>
      </form>
    );
  }

  return (
    <form onSubmit={submitAccount} className="space-y-5">
      <div><label htmlFor="signup-email" className="text-xs font-bold">Work email</label><input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={inputClass} placeholder="you@company.com" required />{errors.fields.emailAddress && <p className="mt-1.5 text-xs text-red-700">{errors.fields.emailAddress.message}</p>}</div>
      <div><label htmlFor="signup-password" className="text-xs font-bold">Password</label><div className="relative"><input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className={`${inputClass} pr-12`} placeholder="At least 8 characters" minLength={8} required /><button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-3 top-1/2 mt-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#75837d] hover:bg-black/5" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div>{errors.fields.password && <p className="mt-1.5 text-xs text-red-700">{errors.fields.password.message}</p>}<p className="mt-2 text-[11px] leading-4 text-[#8a9691]">Use a strong password you don&apos;t reuse elsewhere.</p></div>
      <AuthError message={localError || errors.fields.captcha?.message || globalError} />
      <div id="clerk-captcha" />
      <button type="submit" disabled={isBusy || !email.trim() || password.length < 8} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white transition hover:bg-[#196b4d] disabled:opacity-45">{isBusy ? "Creating account…" : "Create Ziggo account"}<ArrowRight className="size-4" /></button>
      <p className="text-center text-xs leading-5 text-[#66756f]">By continuing, you agree to use Ziggo responsibly and keep your workspace data authorized.</p>
      <p className="text-center text-xs text-[#66756f]">Already have an account? <Link href="/sign-in" className="font-bold text-[#196b4d]">Sign in</Link></p>
    </form>
  );
}

function AuthError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{message}</p> : null;
}

