import { orders } from "@/lib/mock";
import { TrackingView } from "@/components/tracking/TrackingView";

/**
 * Pre-render the demo orders plus the ID range the demo checkout hands out
 * (PEN-1043 to PEN-1082), so every link works on a static host.
 */
export function generateStaticParams() {
  const ids = new Set(orders.map((o) => o.id));
  for (let n = 1043; n <= 1082; n++) ids.add(`PEN-${n}`);
  return Array.from(ids).map((id) => ({ id }));
}

export const dynamicParams = false;

export default function TrackingPage({ params }: { params: { id: string } }) {
  return <TrackingView id={params.id} />;
}
