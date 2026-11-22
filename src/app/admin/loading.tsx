import { Sk, SkeletonPage } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="mx-auto max-w-[900px]">
        <div className="mb-3 mt-1 flex items-center justify-between"><Sk className="h-8 w-44" /><Sk className="h-6 w-16" /></div>
        <div className="mb-4 flex gap-2 overflow-hidden">{[0, 1, 2, 3].map((i) => <Sk key={i} className="h-10 w-24 flex-none !rounded-full" />)}</div>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">{Array.from({ length: 10 }, (_, i) => <Sk key={i} className="h-[72px]" />)}</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><Sk className="h-36" /><Sk className="h-36" /></div>
      </div>
    </SkeletonPage>
  );
}
