import type { FastifyInstance } from 'fastify';
import type { FabricRegistry, CapabilityDefinition } from '@eve-fabric/domain';
import { capabilityId, capabilityVersion } from '@eve-fabric/domain';
import type { CapabilitySource } from '@eve-fabric/domain';

function serializeDefinition(def: CapabilityDefinition): Record<string, unknown> {
  return {
    id: def.id,
    version: def.version,
    name: def.name,
    description: def.description,
    source: def.source,
    inputs: [...def.inputs.values()].map((p) => ({
      name: p.name,
      semanticType: p.semanticType,
      description: p.description,
      required: p.required,
    })),
    outputs: [...def.outputs.values()].map((p) => ({
      name: p.name,
      semanticType: p.semanticType,
      required: p.required,
    })),
    dependencies: (def.dependencies ?? []).map((d) => ({
      id: d.id,
      version: d.version ? (d.version as string) : undefined,
    })),
    auth: { requiredScopes: [...def.auth.scopes] },
    cache: { cacheable: def.cache.cacheable, ttlSeconds: def.cache.defaultTtlSeconds },
    isComposite: def.source === 'COMPOSITE',
  };
}

export function createRegistryRoutes(registry: FabricRegistry) {
  return async function registryRoutes(app: FastifyInstance): Promise<void> {
    app.get<{
      Querystring: { source?: string; search?: string; latest?: string };
    }>('/api/registry', async (req, reply) => {
      const source = req.query.source as CapabilitySource | undefined;
      const search = req.query.search;
      const latest = req.query.latest !== 'false';

      const capabilities = registry.list({ source, search, latestOnly: latest });
      return reply.status(200).send({
        capabilities: capabilities.map(serializeDefinition),
      });
    });

    app.get<{
      Params: { id: string };
      Querystring: { version?: string };
    }>('/api/registry/:id', async (req, reply) => {
      try {
        const capId = capabilityId(req.params.id);
        const capVer = req.query.version ? capabilityVersion(req.query.version) : undefined;
        const def = registry.get(capId, capVer);

        if (!def) {
          return reply.status(404).send({
            error: 'CAPABILITY_NOT_FOUND',
            message: `Capability '${req.params.id}' not found`,
          });
        }

        const versions = registry.getVersions(capId);
        const upgrades = capVer ? registry.findUpgrades({ id: capId, version: capVer }) : [];

        return reply.status(200).send({
          ...serializeDefinition(def),
          versions: versions.map((v) => v as string),
          upgrades: upgrades.map((u) => ({
            currentVersion: u.currentVersion,
            availableVersion: u.availableVersion,
            isCompatible: u.isCompatible,
            isBreaking: u.isBreaking,
          })),
        });
      } catch {
        return reply.status(404).send({
          error: 'CAPABILITY_NOT_FOUND',
          message: `Capability '${req.params.id}' not found`,
        });
      }
    });

    app.get<{
      Params: { id: string };
    }>('/api/registry/:id/versions', async (req, reply) => {
      try {
        const capId = capabilityId(req.params.id);
        const versions = registry.getVersions(capId);

        if (versions.length === 0) {
          return reply.status(404).send({
            error: 'CAPABILITY_NOT_FOUND',
            message: `Capability '${req.params.id}' not found`,
          });
        }

        return reply.status(200).send({
          id: req.params.id,
          versions: versions.map((v) => ({ version: v })),
        });
      } catch {
        return reply.status(404).send({
          error: 'CAPABILITY_NOT_FOUND',
          message: `Capability '${req.params.id}' not found`,
        });
      }
    });

    app.get<{
      Params: { id: string };
      Querystring: { version?: string };
    }>('/api/registry/:id/dependencies', async (req, reply) => {
      try {
        const capId = capabilityId(req.params.id);
        const capVer = req.query.version ? capabilityVersion(req.query.version) : undefined;
        const tree = registry.getDependencyGraph(capId, capVer);

        if (!tree) {
          return reply.status(404).send({
            error: 'CAPABILITY_NOT_FOUND',
            message: `Capability '${req.params.id}' not found`,
          });
        }

        return reply.status(200).send(serializeDependencyNode(tree));
      } catch {
        return reply.status(404).send({
          error: 'CAPABILITY_NOT_FOUND',
          message: `Capability '${req.params.id}' not found`,
        });
      }
    });

    app.get<{
      Params: { id: string };
      Querystring: { from?: string };
    }>('/api/registry/:id/upgrades', async (req, reply) => {
      try {
        const capId = capabilityId(req.params.id);
        const fromVersion = req.query.from ? capabilityVersion(req.query.from) : undefined;

        if (!fromVersion) {
          return reply.status(400).send({
            error: 'INVALID_VERSION',
            message: 'Query parameter "from" is required',
          });
        }

        const upgrades = registry.findUpgrades({ id: capId, version: fromVersion });

        return reply.status(200).send({
          id: req.params.id,
          fromVersion: fromVersion as string,
          upgrades: upgrades.map((u) => ({
            version: u.availableVersion,
            isCompatible: u.isCompatible,
            isBreaking: u.isBreaking,
          })),
        });
      } catch {
        return reply.status(404).send({
          error: 'CAPABILITY_NOT_FOUND',
          message: `Capability '${req.params.id}' not found`,
        });
      }
    });
  };
}

function serializeDependencyNode(node: {
  id: unknown;
  version: unknown;
  source: unknown;
  children: readonly unknown[];
}): Record<string, unknown> {
  return {
    id: node.id,
    version: node.version,
    source: node.source,
    children: (node.children as Array<typeof node>).map(serializeDependencyNode),
  };
}
