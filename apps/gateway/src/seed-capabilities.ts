import type { InMemoryFabricRegistry } from '@eve-fabric/domain';
import { allCapabilities } from '@eve-fabric/capability-sdk';

export function seedPrebuiltCapabilities(registry: InMemoryFabricRegistry): void {
  for (const capability of allCapabilities) {
    registry.register(capability);
  }
}
