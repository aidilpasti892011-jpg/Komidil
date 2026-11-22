import { Sk, SkeletonPage } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <Sk className="my-2 h-5 w-24" />
      <div className="flex gap-3.5">
        <Sk className="aspect-[3/4] w-32 flex-none md:w-52" />
        <div className="flex-1 space-y-2.5 pt-1">
          <Sk className="h-7 w-4/5" />
          <Sk className="h-4 w-1/2" />
          <Sk className="h-4 w-2/3" />
          <Sk className="h-4 w-1/3" />
        </div>
      </div>
      <div className="my-3 flex gap-1.5">{[0, 1, 2].map((i) => <Sk key={i} className="h-7 w-20 !rounded-2xl" />)}</div>
      <Sk className="mb-3 h-12" />
      <div className="space-y-1.5"><Sk className="h-4" /><Sk className="h-4" /><Sk className="h-4 w-3/4" /></div>
      <Sk className="mb-2 mt-6 h-7 w-40" />
      <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Sk key={i} className="h-12" />)}</div>
    </SkeletonPage>
  );
}
