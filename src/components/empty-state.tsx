"use client";

/** Illustrated empty list placeholder. */
export function IllustratedEmpty({
  title,
  image = "/brand/illustrations/empty-work.png",
  action,
}: {
  title: string;
  image?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-raised px-6 py-12 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="mx-auto mb-4 h-32 w-32 object-contain" />
      <p className="text-[15px] text-slate">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
