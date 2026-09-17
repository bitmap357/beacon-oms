import { parseJson } from "@/lib/db-types";

type Snapshot = {
  openIncidents?: unknown[];
  openActions?: unknown[];
  overdueActions?: unknown[];
  pendingQa?: unknown[];
};

export function HandoverSnapshot({ value }: { value: string }) {
  const snapshot = parseJson<Snapshot>(value, {});
  const incidents = snapshot.openIncidents?.length ?? 0;
  const actions = snapshot.openActions?.length ?? 0;
  const overdue = snapshot.overdueActions?.length ?? 0;
  const qa = snapshot.pendingQa?.length ?? 0;
  return (
    <p className="text-[13px] text-slate">
      {incidents} open incident{incidents === 1 ? "" : "s"} · {actions} open action
      {actions === 1 ? "" : "s"}
      {overdue ? ` · ${overdue} overdue` : ""}
      {qa ? ` · ${qa} pending QA` : ""}
    </p>
  );
}
