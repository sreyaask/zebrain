"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Container } from "@/components/ui/Section";
import { demoUser } from "@/lib/mock";
import { setSignedIn } from "@/lib/store";
import { live, signInWithPassword, signUpWithPassword } from "@/lib/api";

const DEMO_OTP = "123456";

function DemoLogin() {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp" | "done">("phone");
  const [phone, setPhone] = useState(demoUser.phone.replace("+91 ", ""));
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === "otp") otpRef.current?.focus();
  }, [step]);

  const digits = phone.replace(/\D/g, "");

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError("Enter a 10-digit Indian mobile number.");
      return;
    }
    setError(undefined);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    setLoading(false);
    setOtp("");
    setStep("otp");
    setResendIn(30);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setError(undefined);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    if (otp !== DEMO_OTP) {
      setError("That code doesn't match. Check the SMS and try again.");
      return;
    }
    setSignedIn(true);
    setStep("done");
    setTimeout(() => router.push("/orders"), 700);
  };

  return (
    <Container className="flex min-h-[70vh] max-w-sm flex-col justify-center py-16">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-semibold tracking-tight">{step === "phone" ? "Log in to Penned" : step === "otp" ? "Enter the code" : "You're in"}</h1>
        <p className="mt-2 text-[15px] text-muted">
          {step === "phone"
            ? "We'll text you a 6-digit code. No password needed."
            : step === "otp"
              ? `Sent to +91 ${digits.slice(0, 5)} ${digits.slice(5)}.`
              : "Taking you to your orders..."}
        </p>

        {step === "phone" && (
          <form onSubmit={sendCode} noValidate className="mt-8 space-y-4">
            <Input
              label="Mobile number"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              prefix="+91"
              maxLength={11}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
              error={error}
            />
            <Button type="submit" fullWidth size="lg" loading={loading}>
              {loading ? "Sending code" : "Send code"}
            </Button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={verify} noValidate className="mt-8 space-y-4">
            <Input
              ref={otpRef}
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              error={error}
              hint={`Demo code: ${DEMO_OTP}`}
              className="[&_input]:text-center [&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.5em]"
            />
            <Button type="submit" fullWidth size="lg" loading={loading}>
              {loading ? "Checking" : "Verify and log in"}
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setError(undefined);
                }}
                className="rounded text-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Change number
              </button>
              <button
                type="button"
                disabled={resendIn > 0 || loading}
                onClick={() => sendCode()}
                className="rounded text-accent hover:underline disabled:text-muted disabled:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
              </button>
            </div>
          </form>
        )}

        {step === "done" && (
          <p className="mt-8 font-hand text-4xl text-accent" role="status">
            Welcome back, {demoUser.name.split(" ")[0]}.
          </p>
        )}

        <p className="mt-10 text-xs leading-relaxed text-muted">
          By continuing you agree to receive order updates by SMS. We never share your number.
        </p>
      </div>
    </Container>
  );
}

/** Real sign-in: email and password, handled by Supabase. */
function PasswordLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    setError(undefined);
    setLoading(true);
    try {
      const fn = mode === "login" ? signInWithPassword : signUpWithPassword;
      await fn(email.trim().toLowerCase(), password);
      router.push("/orders/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="flex min-h-[70vh] max-w-sm flex-col justify-center py-16">
      <div className="animate-slide-up">
        <h1 className="text-2xl font-semibold tracking-tight">{mode === "login" ? "Log in to Penned" : "Create your account"}</h1>
        <p className="mt-2 text-[15px] text-muted">
          {mode === "login" ? "Use the email and password you signed up with." : "Takes ten seconds. You'll use this to order and track."}
        </p>
        <form onSubmit={submit} noValidate className="mt-8 space-y-4">
          <Input label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Password"
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={mode === "signup" ? "At least 8 characters." : undefined}
            error={error}
          />
          <Button type="submit" fullWidth size="lg" loading={loading}>
            {mode === "login" ? "Log in" : "Create account"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted">
          {mode === "login" ? "New to Penned? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError(undefined);
            }}
            className="rounded font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {mode === "login" ? "Create an account" : "Log in"}
          </button>
        </p>
      </div>
    </Container>
  );
}

export default function LoginPage() {
  return live ? <PasswordLogin /> : <DemoLogin />;
}
