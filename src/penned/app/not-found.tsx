import { LinkButton } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-5 py-24 text-center">
      <p className="font-hand text-4xl text-accent">This page is blank.</p>
      <h1 className="mt-4 text-xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-sm text-muted">The link may be old, or the order number may be mistyped.</p>
      <div className="mt-8 flex justify-center gap-3">
        <LinkButton href="/orders" variant="secondary">My orders</LinkButton>
        <LinkButton href="/">Go home</LinkButton>
      </div>
    </div>
  );
}
