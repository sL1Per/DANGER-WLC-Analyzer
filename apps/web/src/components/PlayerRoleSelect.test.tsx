import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RpbRow } from "@wcl/core";
import { PlayerRoleSelect } from "./PlayerRoleSelect";

const row = { playerId: 7, playerName: "Aragorn", role: "physical" } as RpbRow;

describe("PlayerRoleSelect", () => {
  it("renders an accessible role select and reports changes", () => {
    const onChange = vi.fn();
    render(<PlayerRoleSelect row={row} onChange={onChange} />);
    const select = screen.getByLabelText(/role for Aragorn/i);
    fireEvent.change(select, { target: { value: "tank" } });
    expect(onChange).toHaveBeenCalledWith("Aragorn", "tank");
  });
});
