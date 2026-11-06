"use client";

import { Button, LinkButton } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="font-hand text-4xl text-accent">Ink smudge.</p>
      <h1 className="mt-4 text-xl font-semibold">Something went wrong on our side</h1>
      <p className="mt-2 text-sm text-muted">Your order details are safe. Try again, or head back home.</p>
      <div className="mt-8 flex justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/" variant="secondary">Go home</LinkButton>
      </div>
    </div>
  );
}
