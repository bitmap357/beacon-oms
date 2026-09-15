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
    <div className="rounded-2xl border border-hairline bg-surface-raised px-4 py-10 text-center sm:px-6 sm:py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="mx-auto mb-4 h-24 w-24 object-contain sm:h-32 sm:w-32" />
      <p className="text-[15px] text-slate">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
