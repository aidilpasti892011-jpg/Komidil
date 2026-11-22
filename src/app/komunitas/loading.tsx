import { Sk, SkeletonPage } from "@/components/Skeleton";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="mx-auto max-w-[720px]">
        <div className="mb-3 flex items-center justify-between"><Sk className="h-8 w-40" /><Sk className="h-9 w-28 !rounded-full" /></div>
        <div className="no-scrollbar mb-3 flex gap-2 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => <Sk key={i} className="h-10 w-24 flex-none !rounded-full" />)}
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="space-y-2.5 rounded-2xl border border-line bg-card p-4">
              <div className="flex items-center gap-2"><Sk className="h-7 w-7 !rounded-full bg-line/60" /><Sk className="h-4 w-32 bg-line/60" /></div>
              <Sk className="h-5 w-4/5 bg-line/60" />
              <Sk className="h-4 w-full bg-line/60" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonPage>
  );
}
