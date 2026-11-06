import { Spinner } from "@/components/ui/Spinner";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-muted" role="status">
      <Spinner className="h-5 w-5" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
