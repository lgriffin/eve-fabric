import type { CapabilityUse } from './capability-definition.js';
import type { CapabilitySource } from './value-objects.js';

const ESI_SCOPE_PREFIX = 'esi:';

/** Whether `use` is a well-formed {@link CapabilityUse}. */
export function isCapabilityUse(use: string): use is CapabilityUse {
  return (
    use === 'esi.public' ||
    use === 'sde' ||
    (use.startsWith(ESI_SCOPE_PREFIX) && use.length > ESI_SCOPE_PREFIX.length)
  );
}

/**
 * The source a capability's `uses` imply (constitution V): ESI when it
 * reaches ESI at all, else SDE when it reads the static export, else DERIVED.
 */
export function sourceFromUses(uses: readonly CapabilityUse[]): CapabilitySource {
  if (uses.some((u) => u === 'esi.public' || u.startsWith(ESI_SCOPE_PREFIX))) return 'ESI';
  if (uses.includes('sde')) return 'SDE';
  return 'DERIVED';
}

/** The SSO scopes a capability's `uses` require, in declaration order. */
export function scopesFromUses(uses: readonly CapabilityUse[]): string[] {
  return uses
    .filter((u) => u.startsWith(ESI_SCOPE_PREFIX))
    .map((u) => u.slice(ESI_SCOPE_PREFIX.length));
}
