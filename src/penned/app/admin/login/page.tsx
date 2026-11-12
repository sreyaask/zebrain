"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setLoading(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) setError(error.message === "Invalid login credentials" ? "Email or password is wrong." : error.message);
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-5">
      <p className="font-display text-2xl font-light tracking-[0.12em] text-accent">penned<span className="text-ink">.</span></p>
      <h1 className="mt-6 text-xl font-semibold">Admin sign in</h1>
      <form onSubmit={submit} noValidate className="mt-6 space-y-4">
        <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" fullWidth loading={loading}>
          Sign in
        </Button>
      </form>
    </div>
  );
}
