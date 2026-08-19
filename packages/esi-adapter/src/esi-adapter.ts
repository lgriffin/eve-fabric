import type {
  CapabilityDefinition,
  SourceAdapter,
  SourceAdapterResult,
} from '@eve-fabric/domain';

/**
 * Skeleton ESI (EVE Swagger Interface) adapter.
 *
 * Will be wired to @lgriffin/esi.ts once the full integration layer is in place.
 */
export class EsiAdapter implements SourceAdapter {
  readonly name = 'ESI';

  supports(capability: CapabilityDefinition): boolean {
    return capability.source === 'ESI';
  }

  async execute(
    _capability: CapabilityDefinition,
    _inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult> {
    // TODO: Wire to @lgriffin/esi.ts HTTP client
    throw new Error('ESI adapter not yet connected to ESI.ts');
  }
}
