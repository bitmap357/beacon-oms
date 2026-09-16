"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#f6f1e6] px-4 py-16 text-center text-[#1c2430]">
        <h1 className="text-2xl font-semibold">Beacon could not load</h1>
        <p className="mt-2 max-w-md text-sm text-[#5b6472]">
          A system error stopped this page. Retry, or sign in again if you were in the middle of a session.
        </p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-[#5b6472]">Ref {error.digest}</p> : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-[#1558d6] px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
