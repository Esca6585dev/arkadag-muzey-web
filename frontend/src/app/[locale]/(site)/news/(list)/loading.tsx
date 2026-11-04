import { ListSkeleton } from "@/components/site/list-skeleton";

export default function Loading() {
  return <ListSkeleton cols={3} count={6} />;
}
