import { ListSkeleton } from "@/components/site/list-skeleton";

export default function Loading() {
  return <ListSkeleton cols={2} count={4} aspect="aspect-[21/9]" />;
}
