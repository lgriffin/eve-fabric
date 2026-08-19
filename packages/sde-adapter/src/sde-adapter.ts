import type { CapabilityDefinition, SourceAdapter, SourceAdapterResult } from '@eve-fabric/domain';

/**
 * Skeleton SDE (Static Data Export) adapter.
 *
 * Will be wired to the SDE data provider once the integration layer is in place.
 */
export class SdeAdapter implements SourceAdapter {
  readonly name = 'SDE';

  supports(capability: CapabilityDefinition): boolean {
    return capability.source === 'SDE';
  }

  async execute(
    _capability: CapabilityDefinition,
    _inputs: ReadonlyMap<string, unknown>,
  ): Promise<SourceAdapterResult> {
    // TODO: Wire to SDE data provider
    throw new Error('SDE adapter not yet connected to data provider');
  }
}
