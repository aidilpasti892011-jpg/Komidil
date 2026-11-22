import { GridSkeleton, Sk, SkeletonPage } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Sk className="mb-3 mt-1.5 h-8 w-48" />
      <Sk className="h-11" />
      <div className="no-scrollbar flex gap-1.5 overflow-hidden py-2">
        {[0, 1, 2, 3, 4].map((i) => <Sk key={i} className="h-8 w-20 flex-none !rounded-full" />)}
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-2"><Sk className="h-11" /><Sk className="h-11" /></div>
      <Sk className="mb-3.5 mt-2 h-11" />
      <GridSkeleton />
    </SkeletonPage>
  );
}
