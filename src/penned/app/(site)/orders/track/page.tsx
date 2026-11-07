"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TrackingView } from "@/components/tracking/TrackingView";

/** Tracking for real orders: /orders/track/?code=PEN-1043 (works on a static host for any code). */
function Track() {
  const code = useSearchParams().get("code") ?? "";
  return <TrackingView id={code} />;
}

export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <Track />
    </Suspense>
  );
}
