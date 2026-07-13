import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-5 w-48" />
      </header>
      <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-8">
        <div className="mb-8 grid grid-cols-3 gap-4">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <div className="grid gap-3">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-14 rounded-lg" />
        </div>
      </div>
    </>
  );
}
