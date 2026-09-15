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
    <div className="rounded-[12px] border border-hairline bg-surface-raised px-5 py-10 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image} alt="" className="mx-auto mb-4 h-28 w-28 object-contain" />
      <p className="text-sm text-slate">{title}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
