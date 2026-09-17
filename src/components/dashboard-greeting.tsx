"use client";

/**
 * Time-of-day greeting from the user's local clock (not server TZ).
 * SSR shows "Hello"; after mount we switch to morning / afternoon / evening.
 */
import { useEffect, useState } from "react";

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardGreeting({ name }: { name: string }) {
  const first = name.split(" ")[0] || name;
  const [hello, setHello] = useState("Hello");

  useEffect(() => {
    setHello(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <h1 className="font-heading mt-2 text-[28px] leading-[1.15] text-ink sm:text-[32px] lg:text-[40px]">
      {hello}, <span className="text-brand">{first}</span>.
    </h1>
  );
}
