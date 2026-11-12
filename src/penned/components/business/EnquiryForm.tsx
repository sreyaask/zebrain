"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { live } from "@/lib/session";
import { segments } from "@/lib/segments";

type State = "idle" | "loading" | "done" | "error";

/** "Request samples and a quote" on the For business page. Saved to business_enquiries (admins read them). */
export function EnquiryForm() {
  const [segment, setSegment] = useState("business");
  const [organisation, setOrganisation] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{ organisation?: string; name?: string; email?: string; quantity?: string }>({});
  const [state, setState] = useState<State>("idle");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!organisation.trim()) next.organisation = "Enter your organisation's name.";
    if (!name.trim()) next.name = "Enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = "Enter a valid email address, like name@company.com.";
    const qty = quantity.trim() ? Number(quantity) : undefined;
    if (qty !== undefined && (!Number.isInteger(qty) || qty < 1 || qty > 1_000_000)) next.quantity = "Enter a whole number, like 200.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setState("loading");
    try {
      if (live) {
        // Loaded on demand so this page doesn't carry the Supabase library.
        const { sendBusinessEnquiry } = await import("@/lib/api");
        await sendBusinessEnquiry({ segment, organisation, name, email, phone, quantity: qty, message });
      } else {
        await new Promise((r) => setTimeout(r, 900));
        // Demo: addresses at example.com simulate a server error.
        if (email.trim().toLowerCase().endsWith("@example.com")) throw new Error("demo");
      }
      setState("done");
    } catch {
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="animate-fade-in rounded-xl border border-accent/50 bg-surface p-6" role="status">
        <p className="font-hand text-3xl text-accent">Thank you, {name.trim().split(" ")[0]}.</p>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          We&apos;ve got your request for {organisation.trim()}. We&apos;ll reply to {email.trim()} with sample cards and a quote.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-line bg-surface p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="You are" value={segment} onChange={(e) => setSegment(e.target.value)}>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value="other">Something else</option>
        </Select>
        <Input label="Organisation" autoComplete="organization" value={organisation} onChange={(e) => setOrganisation(e.target.value)} error={errors.organisation} />
        <Input label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input label="Work email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input label="Phone" optional type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          label="How many cards or letters?"
          optional
          inputMode="numeric"
          placeholder="e.g. 200"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          error={errors.quantity}
        />
      </div>
      <Textarea
        label="What would you like written?"
        optional
        className="[&_textarea]:min-h-[110px]"
        placeholder="e.g. Thank-you cards to 300 donors after our annual campaign, in our founder's handwriting."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={2000}
      />
      {state === "error" && (
        <p className="text-sm text-danger" role="alert">
          We couldn&apos;t send that just now. Please try again in a minute.
        </p>
      )}
      <Button type="submit" loading={state === "loading"} fullWidth>
        {state === "loading" ? "Sending" : "Request samples and a quote"}
      </Button>
      <p className="text-xs text-muted">We only use these details to reply to you.</p>
    </form>
  );
}
