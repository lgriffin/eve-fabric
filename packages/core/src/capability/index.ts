export {
  type CapabilityId,
  type CapabilityVersion,
  type CapabilityRef,
  capabilityId,
  capabilityVersion,
  capabilityIdSchema,
  capabilityVersionSchema,
  compareVersions,
  isCompatibleUpgrade,
  isBreakingUpgrade,
} from './capability-id.js';

export {
  type AuthRequirement,
  type CachePolicy,
  type CostModel,
  type CapabilitySource,
  authRequirementSchema,
  cachePolicySchema,
  costModelSchema,
  capabilitySourceSchema,
} from './value-objects.js';

export { type SemanticPort, semanticPortSchema } from './semantic-port.js';

export {
  type CapabilityDefinition,
  type CapabilityAttach,
  type PipelineRef,
  type CapabilityUse,
  type CapabilityRun,
  type RunContext,
} from './capability-definition.js';

export { isCapabilityUse, sourceFromUses, scopesFromUses } from './uses.js';

export {
  capabilityDefinitionSchema,
  capabilityRefSchema,
  pipelineRefSchema,
  type CapabilityManifest,
} from './schemas.js';

export {
  CapabilityCatalog,
  CapabilityNotExecutableError,
  UnresolvableReferenceError,
  ResolverMissingError,
  InvalidAttachError,
  type CapabilityCatalogOptions,
} from './catalog.js';

export { type EditorType, getEditorType } from './input-editor-mapping.js';
