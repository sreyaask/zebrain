import type { Metadata } from "next";
import { Suspense } from "react";
import { Container } from "@/components/ui/Section";
import { OrderFlow } from "@/components/order/OrderFlow";

export const metadata: Metadata = { title: "Get started" };

export default function OrderPage() {
  return (
    <Container className="max-w-4xl pt-10 sm:pt-14">
      <h1 className="sr-only">New order</h1>
      <Suspense fallback={null}>
        <OrderFlow />
      </Suspense>
    </Container>
  );
}
