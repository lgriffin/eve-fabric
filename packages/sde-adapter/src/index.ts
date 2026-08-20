export { SdeAdapter, type SdeAdapterConfig } from './sde-adapter.js';

export async function createMemorySdeProvider(
  data?: Record<string, unknown>,
): Promise<import('@lgriffin/esi.ts/sde').IStaticDataProvider> {
  const { MemorySdeProvider } = await import('@lgriffin/esi.ts/sde');
  return new MemorySdeProvider(data);
}
