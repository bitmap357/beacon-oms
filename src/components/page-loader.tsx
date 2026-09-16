/** Full-panel loading state used by route `loading.tsx` files and Suspense fallbacks. */
export function PageLoader({ label = "Loading Beacon" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <span className="relative h-12 w-12" aria-hidden>
        <span className="absolute inset-0 rounded-full border-2 border-hairline" />
        <span className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-brand border-r-gold" />
      </span>
      <p className="text-sm text-slate">{label}</p>
    </div>
  );
}
