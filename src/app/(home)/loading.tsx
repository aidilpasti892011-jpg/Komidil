import { CardSkeleton, Sk, SkeletonPage } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Sk className="-mx-3.5 mb-4 h-[340px] !rounded-none md:mx-0 md:h-[400px] md:!rounded-[18px]" />
      <div className="mb-1.5 grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => <Sk key={i} className="h-11" />)}
      </div>
      <Sk className="mb-2.5 mt-5 h-6 w-44" />
      <div className="space-y-2">
        {[0, 1, 2].map((i) => <Sk key={i} className="h-[84px]" />)}
      </div>
      <Sk className="mb-2.5 mt-5 h-6 w-48" />
      <div className="no-scrollbar flex gap-3 overflow-hidden">
        {[0, 1, 2, 3].map((i) => <div key={i} className="w-[140px] flex-none md:w-[170px]"><CardSkeleton /></div>)}
      </div>
    </SkeletonPage>
  );
}
