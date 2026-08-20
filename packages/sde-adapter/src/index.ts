export { SdeAdapter, type SdeAdapterConfig } from './sde-adapter.js';

export async function createMemorySdeProvider(
  data?: Record<string, unknown>,
): Promise<import('@lgriffin/esi.ts/sde').IStaticDataProvider> {
  const memoryModule = (await import('@lgriffin/esi.ts/sde/memory')) as {
    MemorySdeProvider: new (
      data?: Record<string, unknown>,
    ) => import('@lgriffin/esi.ts/sde').IStaticDataProvider;
  };
  return new memoryModule.MemorySdeProvider(data);
}
