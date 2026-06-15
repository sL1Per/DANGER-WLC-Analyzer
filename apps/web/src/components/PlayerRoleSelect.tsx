import type { Role, RpbRow } from "@wcl/core";

const ROLES: Role[] = ["tank", "healer", "caster", "physical"];

export function PlayerRoleSelect({
  row,
  onChange,
}: {
  row: RpbRow;
  onChange: (playerName: string, role: Role) => void;
}) {
  return (
    <>
      <label className="sr-only" htmlFor={`role-${row.playerId}`}>
        role for {row.playerName}
      </label>
      <select
        id={`role-${row.playerId}`}
        aria-label={`role for ${row.playerName}`}
        value={row.role}
        onChange={(e) => onChange(row.playerName, e.target.value as Role)}
      >
        {ROLES.map((ro) => (
          <option key={ro} value={ro}>
            {ro}
          </option>
        ))}
      </select>
    </>
  );
}
