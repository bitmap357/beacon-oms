"use client";

/** Multi-select of active users, excluding the responsible person. */
export function PeoplePicker({
  users,
  excludeId,
  name = "participantIds",
  selectedIds,
}: {
  users: Array<{ id: string; name: string }>;
  excludeId?: string;
  name?: string;
  selectedIds?: string[];
}) {
  const members = users.filter((row) => row.id !== excludeId);
  if (members.length === 0) {
    return <p className="text-sm text-slate">No other people to add yet.</p>;
  }
  const selected = new Set(selectedIds || []);
  return (
    <div className="max-h-40 space-y-2 overflow-y-auto rounded-[12px] border border-hairline bg-surface px-3 py-2" key={excludeId || "all"}>
      {members.map((row) => (
        <label key={row.id} className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={row.id}
            defaultChecked={selected.has(row.id)}
            className="h-4 w-4 rounded border-hairline text-brand accent-brand"
          />
          {row.name}
        </label>
      ))}
    </div>
  );
}
