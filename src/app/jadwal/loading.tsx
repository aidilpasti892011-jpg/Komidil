import { Sk, SkeletonPage } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Sk className="mb-3 mt-1.5 h-8 w-44" />
      <div className="mb-3 flex gap-1.5">
        {[0, 1, 2].map((i) => <Sk key={i} className="h-8 w-24 !rounded-full" />)}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => <Sk key={i} className="h-[76px]" />)}
      </div>
    </SkeletonPage>
  );
}
