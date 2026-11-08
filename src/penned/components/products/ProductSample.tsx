import { PagePreview } from "@/components/ui/PagePreview";
import { defaultLayout } from "@/lib/pricing";
import type { Product } from "@/lib/mock";

/** The product's own sample, written on its real paper (notebook page, card or journal page). */
export function ProductSample({ product, className, caption }: { product: Product; className?: string; caption?: string }) {
  const card = product.sampleSize === "a6";
  return (
    <PagePreview
      className={className}
      text={product.sample}
      paper={product.samplePaper}
      caption={caption}
      layout={{
        ...defaultLayout,
        pageSize: product.sampleSize,
        marginMm: card ? 9 : 16,
        lineSpacing: card ? 1.05 : 1.2,
        ink: product.slug === "invitations" || product.slug === "business-mail" ? "black" : "blue",
      }}
    />
  );
}
