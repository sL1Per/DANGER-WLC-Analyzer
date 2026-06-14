// packages/data/src/avoidableAbilities.ts
/** An ability whose damage is considered avoidable (stand-out-of, environmental).
 *  encounterId omitted = treated as globally avoidable. Curated; extend per boss
 *  during E2E using the probe to read real ability ids. */
export interface AvoidableAbility {
  abilityId: number;
  name: string;
  /** WCL encounter id this applies to; omit for global. */
  encounterId?: number;
  verified?: boolean;
}

// Starter set — extend during E2E. Verify each id on Wowhead.
export const avoidableAbilities: AvoidableAbility[] = [
  // Example global/environmental placeholders — replace/extend with real boss ids.
  { abilityId: 37098, name: "Vashj — Static Charge", encounterId: undefined, verified: false },
];

export const avoidableAbilityIds: Set<number> = new Set(avoidableAbilities.map((a) => a.abilityId));
