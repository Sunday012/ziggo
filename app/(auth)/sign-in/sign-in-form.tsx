"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { ArrowRight, Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import { getAuthErrorMessage } from "@/lib/auth-errors";

type Phase = "password" | "mfa" | "reset-email" | "reset-code" | "new-password";
type MfaStrategy = "email_code" | "phone_code" | "totp" | "backup_code";

const inputClass = "mt-2 h-12 w-full rounded-xl border border-black/10 bg-white px-4 text-sm outline-none transition placeholder:text-[#9aa49f] focus:border-[#196b4d]/55 focus:ring-4 focus:ring-[#196b4d]/8";

export function SignInForm() {
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [phase, setPhase] = useState<Phase>("password");
  const [mfaStrategy, setMfaStrategy] = useState<MfaStrategy | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isBusy = fetchStatus === "fetching";
  const globalError = errors.global?.[0]?.longMessage ?? errors.global?.[0]?.message ?? null;

  async function finishSignIn() {
    await signIn.finalize({
      navigate: ({ decorateUrl }) => {
        const url = decorateUrl("/select-org");
        if (url.startsWith("http")) window.location.href = url;
        else router.push(url);
      },
    });
  }

  async function prepareSecondFactor() {
    const strategies = signIn.supportedSecondFactors.map((factor) => factor.strategy);
    if (strategies.includes("email_code")) {
      const { error } = await signIn.mfa.sendEmailCode();
      if (error) throw error;
      setMfaStrategy("email_code");
    } else if (strategies.includes("totp")) {
      setMfaStrategy("totp");
    } else if (strategies.includes("phone_code")) {
      const { error } = await signIn.mfa.sendPhoneCode();
      if (error) throw error;
      setMfaStrategy("phone_code");
    } else if (strategies.includes("backup_code")) {
      setMfaStrategy("backup_code");
    } else {
      throw new Error("Your account requires a sign-in method that is not available here.");
    }
    setPhase("mfa");
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const { error } = await signIn.password({ emailAddress: email.trim(), password });
      if (error) throw error;
      if (signIn.status === "complete") await finishSignIn();
      else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") await prepareSecondFactor();
      else setLocalError("Ziggo could not complete this sign-in. Check your account details and try again.");
    } catch (error) {
      setLocalError(getAuthErrorMessage(error, error instanceof Error ? error.message : "Sign-in failed. Please try again."));
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const result = mfaStrategy === "totp"
        ? await signIn.mfa.verifyTOTP({ code })
        : mfaStrategy === "backup_code"
          ? await signIn.mfa.verifyBackupCode({ code })
          : mfaStrategy === "phone_code"
            ? await signIn.mfa.verifyPhoneCode({ code })
            : await signIn.mfa.verifyEmailCode({ code });
      if (result.error) throw result.error;
      if (signIn.status === "complete") await finishSignIn();
      else setLocalError("The verification is not complete yet. Check the code and try again.");
    } catch (error) {
      setLocalError(getAuthErrorMessage(error, "That verification code could not be confirmed."));
    }
  }

  async function sendResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      await signIn.reset();
      const identified = await signIn.create({ identifier: email.trim() });
      if (identified.error) throw identified.error;
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) throw sent.error;
      setPhase("reset-code");
    } catch (error) {
      setLocalError(getAuthErrorMessage(error, "A reset code could not be sent to that address."));
    }
  }

  async function verifyResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (error) throw error;
      if (signIn.status === "needs_new_password") setPhase("new-password");
      else setLocalError("The reset code could not be completed. Request a new one and try again.");
    } catch (error) {
      setLocalError(getAuthErrorMessage(error, "That reset code is invalid or has expired."));
    }
  }

  async function submitNewPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    try {
      const { error } = await signIn.resetPasswordEmailCode.submitPassword({ password });
      if (error) throw error;
      if (signIn.status === "complete") await finishSignIn();
      else if (signIn.status === "needs_second_factor" || signIn.status === "needs_client_trust") await prepareSecondFactor();
    } catch (error) {
      setLocalError(getAuthErrorMessage(error, "Your password could not be updated."));
    }
  }

  async function startOver() {
    await signIn.reset();
    setPhase("password");
    setMfaStrategy(null);
    setCode("");
    setPassword("");
    setLocalError(null);
  }

  if (phase === "mfa") {
    const prompt = mfaStrategy === "totp" ? "Enter the code from your authenticator app." : mfaStrategy === "backup_code" ? "Enter one of your recovery codes." : `We sent a security code to your ${mfaStrategy === "phone_code" ? "phone" : "email"}.`;
    return <form onSubmit={submitMfa} className="space-y-5"><div className="rounded-2xl bg-[#edf7f0] p-4"><div className="flex items-center gap-2 text-sm font-bold"><KeyRound className="size-4 text-[#196b4d]" /> Security check</div><p className="mt-2 text-xs leading-5 text-[#66756f]">{prompt}</p></div><div><label htmlFor="signin-code" className="text-xs font-bold">Verification code</label><input id="signin-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" className={inputClass} placeholder="Enter your code" required /></div><AuthError message={localError || errors.fields.code?.message || globalError} /><button type="submit" disabled={isBusy || code.trim().length < 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white transition hover:bg-[#196b4d] disabled:opacity-45">{isBusy ? "Checking…" : "Verify and continue"}<ArrowRight className="size-4" /></button><div className="flex items-center justify-between text-xs"><button type="button" onClick={() => void startOver()} className="font-semibold text-[#66756f] hover:text-[#10251d]">Start over</button>{mfaStrategy === "email_code" && <button type="button" onClick={() => void signIn.mfa.sendEmailCode()} className="font-bold text-[#196b4d]">Send another code</button>}</div></form>;
  }

  if (phase === "reset-email") {
    return <form onSubmit={sendResetCode} className="space-y-5"><div><label htmlFor="reset-email" className="text-xs font-bold">Account email</label><div className="relative"><Mail className="absolute left-4 top-1/2 mt-1 size-4 -translate-y-1/2 text-[#8a9691]" /><input id="reset-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={`${inputClass} pl-11`} placeholder="you@company.com" required /></div></div><AuthError message={localError || errors.fields.identifier?.message || globalError} /><button type="submit" disabled={isBusy || !email.trim()} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white transition hover:bg-[#196b4d] disabled:opacity-45">{isBusy ? "Sending…" : "Send reset code"}<ArrowRight className="size-4" /></button><button type="button" onClick={() => setPhase("password")} className="w-full text-xs font-bold text-[#196b4d]">Back to sign in</button></form>;
  }

  if (phase === "reset-code") {
    return <form onSubmit={verifyResetCode} className="space-y-5"><div className="rounded-2xl bg-[#edf7f0] p-4"><p className="text-sm font-bold">Check your inbox</p><p className="mt-1 text-xs leading-5 text-[#66756f]">Enter the password-reset code sent to {email}.</p></div><div><label htmlFor="reset-code" className="text-xs font-bold">Reset code</label><input id="reset-code" value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" className={inputClass} placeholder="Enter your code" required /></div><AuthError message={localError || errors.fields.code?.message || globalError} /><button type="submit" disabled={isBusy || code.trim().length < 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white disabled:opacity-45">{isBusy ? "Checking…" : "Continue"}<ArrowRight className="size-4" /></button><button type="button" onClick={() => void startOver()} className="w-full text-xs font-bold text-[#196b4d]">Cancel reset</button></form>;
  }

  if (phase === "new-password") {
    return <form onSubmit={submitNewPassword} className="space-y-5"><PasswordField id="new-password" label="New password" value={password} onChange={setPassword} visible={showPassword} onVisibility={() => setShowPassword((current) => !current)} autoComplete="new-password" /><AuthError message={localError || errors.fields.password?.message || globalError} /><button type="submit" disabled={isBusy || password.length < 8} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white disabled:opacity-45">{isBusy ? "Updating…" : "Set new password"}<ArrowRight className="size-4" /></button></form>;
  }

  return (
    <form onSubmit={submitPassword} className="space-y-5">
      <div><label htmlFor="signin-email" className="text-xs font-bold">Work email</label><input id="signin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className={inputClass} placeholder="you@company.com" required />{errors.fields.identifier && <p className="mt-1.5 text-xs text-red-700">{errors.fields.identifier.message}</p>}</div>
      <div><div className="flex items-center justify-between"><label htmlFor="signin-password" className="text-xs font-bold">Password</label><button type="button" onClick={() => { setLocalError(null); setPhase("reset-email"); }} className="text-xs font-bold text-[#196b4d]">Forgot password?</button></div><PasswordField id="signin-password" value={password} onChange={setPassword} visible={showPassword} onVisibility={() => setShowPassword((current) => !current)} autoComplete="current-password" />{errors.fields.password && <p className="mt-1.5 text-xs text-red-700">{errors.fields.password.message}</p>}</div>
      <AuthError message={localError || globalError} />
      <button type="submit" disabled={isBusy || !email.trim() || !password} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#10251d] text-sm font-bold text-white transition hover:bg-[#196b4d] disabled:opacity-45">{isBusy ? "Signing in…" : "Sign in to Ziggo"}<ArrowRight className="size-4" /></button>
      <p className="text-center text-xs text-[#66756f]">New to Ziggo? <Link href="/sign-up" className="font-bold text-[#196b4d]">Create an account</Link></p>
    </form>
  );
}

function PasswordField({ id, label, value, onChange, visible, onVisibility, autoComplete }: { id: string; label?: string; value: string; onChange: (value: string) => void; visible: boolean; onVisibility: () => void; autoComplete: string }) {
  return <div>{label && <label htmlFor={id} className="text-xs font-bold">{label}</label>}<div className="relative"><input id={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className={`${inputClass} pr-12`} placeholder="At least 8 characters" minLength={8} required /><button type="button" onClick={onVisibility} className="absolute right-3 top-1/2 mt-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-[#75837d] hover:bg-black/5" aria-label={visible ? "Hide password" : "Show password"}>{visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></div>;
}

function AuthError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{message}</p> : null;
}

