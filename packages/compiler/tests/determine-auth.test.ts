import { describe, it, expect, beforeEach } from 'vitest';
import { determineAuth } from '../src/determine-auth.js';
import { CapabilityCatalog } from '@eve-fabric/domain';
import type { PipelineDefinition } from '../src/pipeline-types.js';

function noAuthCapDef() {
  return {
    id: 'sde.types.lookup',
    version: 1,
    name: 'SDE Type Lookup',
    description: 'Look up type info from SDE',
    inputs: {
      typeId: { name: 'typeId', semanticType: 'eve.type.reference', required: true },
    },
    outputs: {
      typeName: { name: 'typeName', semanticType: 'eve.type.name', required: true },
    },
    source: 'SDE' as const,
    dependencies: [],
    auth: { required: false, scopes: [] },
    cache: {
      cacheable: true,
      defaultTtlSeconds: 86400,
      stalePermitted: true,
      identityInKey: false,
    },
    cost: { estimatedLatencyMs: 5, esiCallCount: 0 },
  };
}

function walletCapDef() {
  return {
    id: 'character.wallet',
    version: 1,
    name: 'Character Wallet',
    description: 'Fetch wallet data',
    inputs: {
      characterId: { name: 'characterId', semanticType: 'eve.character.reference', required: true },
    },
    outputs: {
      balance: { name: 'balance', semanticType: 'eve.currency.isk', required: true },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: { required: true, scopes: ['esi-wallet.read_character_wallet.v1'] },
    cache: { cacheable: true, defaultTtlSeconds: 120, stalePermitted: false, identityInKey: true },
    cost: { estimatedLatencyMs: 150, esiCallCount: 1 },
  };
}

function assetsCapDef() {
  return {
    id: 'character.assets',
    version: 1,
    name: 'Character Assets',
    description: 'Fetch character assets',
    inputs: {
      characterId: { name: 'characterId', semanticType: 'eve.character.reference', required: true },
    },
    outputs: {
      assets: { name: 'assets', semanticType: 'eve.asset.collection', required: true },
    },
    source: 'ESI' as const,
    dependencies: [],
    auth: {
      required: true,
      scopes: ['esi-assets.read_assets.v5', 'esi-wallet.read_character_wallet.v1'],
    },
    cache: { cacheable: true, defaultTtlSeconds: 3600, stalePermitted: false, identityInKey: true },
    cost: { estimatedLatencyMs: 300, esiCallCount: 2 },
  };
}

describe('determineAuth', () => {
  let catalog: CapabilityCatalog;

  beforeEach(() => {
    catalog = new CapabilityCatalog();
    catalog.register(noAuthCapDef());
    catalog.register(walletCapDef());
    catalog.register(assetsCapDef());
  });

  it('returns required=false when no capabilities need auth', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [{ id: 'lookup', capability: { id: 'sde.types.lookup' as any } }],
      edges: [],
      outputs: [],
    };

    const auth = determineAuth(pipeline, catalog);
    expect(auth.required).toBe(false);
    expect(auth.scopes).toHaveLength(0);
  });

  it('returns required=true when any capability needs auth', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'lookup', capability: { id: 'sde.types.lookup' as any } },
        { id: 'wallet', capability: { id: 'character.wallet' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const auth = determineAuth(pipeline, catalog);
    expect(auth.required).toBe(true);
    expect(auth.scopes).toContain('esi-wallet.read_character_wallet.v1');
  });

  it('unions scopes from all capabilities', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [
        { id: 'wallet', capability: { id: 'character.wallet' as any } },
        { id: 'assets', capability: { id: 'character.assets' as any } },
      ],
      edges: [],
      outputs: [],
    };

    const auth = determineAuth(pipeline, catalog);
    expect(auth.required).toBe(true);
    // Wallet has 1 scope, assets has 2 scopes, but one overlaps
    expect(auth.scopes).toContain('esi-wallet.read_character_wallet.v1');
    expect(auth.scopes).toContain('esi-assets.read_assets.v5');
    // No duplicates
    const uniqueScopes = new Set(auth.scopes);
    expect(uniqueScopes.size).toBe(auth.scopes.length);
  });

  it('returns empty auth for empty pipeline', () => {
    const pipeline: PipelineDefinition = {
      id: 'test.pipeline',
      version: 1,
      name: 'Test Pipeline',
      inputs: [],
      nodes: [],
      edges: [],
      outputs: [],
    };

    const auth = determineAuth(pipeline, catalog);
    expect(auth.required).toBe(false);
    expect(auth.scopes).toHaveLength(0);
  });
});
