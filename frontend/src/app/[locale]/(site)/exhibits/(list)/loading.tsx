import { ListSkeleton } from "@/components/site/list-skeleton";

export default function Loading() {
  return <ListSkeleton cols={4} count={8} aspect="aspect-[4/5]" />;
}
