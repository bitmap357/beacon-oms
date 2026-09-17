"use client";

/**
 * Time-of-day greeting from the user's local clock (not server TZ).
 * SSR shows the first name only; after mount we add morning / afternoon / evening.
 */
import { useEffect, useState } from "react";
import { greetingForHour } from "@/lib/greeting";

export function DashboardGreeting({ name }: { name: string }) {
  const first = name.split(" ")[0] || name;
  const [hello, setHello] = useState<string | null>(null);

  useEffect(() => {
    setHello(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <h1 className="font-heading mt-2 text-[28px] leading-[1.15] text-ink sm:text-[32px] lg:text-[40px]">
      {hello ? `${hello}, ` : null}
      <span className="text-brand">{first}</span>
      {hello ? "." : null}
    </h1>
  );
}
