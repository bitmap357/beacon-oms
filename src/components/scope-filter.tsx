"use client";

/** All / My facilities / Assigned to me — writes scope + mine onto the current URL. */
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

export function ScopeFilter({ includeMine = false }: { includeMine?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mine = params.get("mine") === "1";
  const scope = params.get("scope") === "assigned" ? "assigned" : "all";
  const current = mine && includeMine ? "mine" : scope;

  function setMode(mode: "all" | "assigned" | "mine") {
    const next = new URLSearchParams(params.toString());
    if (mode === "all") {
      next.delete("scope");
      next.delete("mine");
    } else if (mode === "assigned") {
      next.set("scope", "assigned");
      next.delete("mine");
    } else {
      next.delete("scope");
      next.set("mine", "1");
    }
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-nowrap gap-2">
      <Button size="sm" className="whitespace-nowrap" variant={current === "all" ? "default" : "secondary"} onClick={() => setMode("all")}>
        All
      </Button>
      <Button
        size="sm"
        className="whitespace-nowrap"
        variant={current === "assigned" ? "default" : "secondary"}
        onClick={() => setMode("assigned")}
      >
        My facilities
      </Button>
      {includeMine ? (
        <Button
          size="sm"
          className="whitespace-nowrap"
          variant={current === "mine" ? "default" : "secondary"}
          onClick={() => setMode("mine")}
        >
          Assigned to me
        </Button>
      ) : null}
    </div>
  );
}
