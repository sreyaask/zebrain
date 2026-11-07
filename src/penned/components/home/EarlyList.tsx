"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { deliveryAreas } from "@/lib/mock";
import { joinEarlyList, live } from "@/lib/api";

type State = "idle" | "loading" | "done" | "error";

export function EarlyList() {
  const [email, setEmail] = useState("");
  const [area, setArea] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | undefined>();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address, like name@example.com.");
      return;
    }
    setError(undefined);
    setState("loading");
    if (live) {
      try {
        await joinEarlyList(email, area);
        setState("done");
      } catch {
        setState("error");
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 900));
    // Demo: addresses at example.com simulate a server error.
    if (email.trim().toLowerCase().endsWith("@example.com")) {
      setState("error");
      return;
    }
    setState("done");
  };

  if (state === "done") {
    return (
      <div className="animate-fade-in rounded-xl border border-line bg-surface p-6" role="status">
        <p className="font-hand text-3xl text-accent">You&apos;re on the list.</p>
        <p className="mt-2 text-sm text-muted">
          We&apos;ll email {email.trim()} the day we open{area ? ` in ${area}` : ""}. No other emails.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <Input
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@gmail.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Select label="Your area" optional value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">Choose an area</option>
          {deliveryAreas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>
      {state === "error" && (
        <p className="text-sm text-danger" role="alert">
          We couldn&apos;t add you just now. Please try again in a minute.
        </p>
      )}
      <Button type="submit" loading={state === "loading"} fullWidth>
        {state === "loading" ? "Adding you" : "Join the early list"}
      </Button>
    </form>
  );
}
