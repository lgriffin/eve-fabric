import type { CapabilityId, CapabilityVersion, CapabilitySource } from '../capability/index.js';
import type { SemanticTypeId } from '../semantic-type/semantic-type.js';

export type Readiness = 'ready' | 'partial' | 'unreachable';

export type MatchReason = 'port_compatible' | 'bridging' | 'search_match' | 'context_aware';

export type ProposalType = 'bridging' | 'auto_complete' | 'assisted' | 'smart_connect';

export interface PathStep {
  readonly capabilityId: CapabilityId;
  readonly capabilityName: string;
  readonly capabilityVersion: CapabilityVersion;
  readonly inputPort: string;
  readonly inputType: SemanticTypeId;
  readonly outputPort: string;
  readonly outputType: SemanticTypeId;
  readonly estimatedLatencyMs: number;
}

export interface SemanticPath {
  readonly sourceType: SemanticTypeId;
  readonly targetType: SemanticTypeId;
  readonly steps: readonly PathStep[];
  readonly length: number;
  readonly totalEstimatedCost: number;
  readonly requiresAuth: boolean;
  readonly authScopes: readonly string[];
}

export interface ExplanationStep {
  readonly fromType: SemanticTypeId;
  readonly toType: SemanticTypeId;
  readonly viaCapabilityId: CapabilityId;
  readonly viaCapabilityName: string;
  readonly inputPortName: string;
  readonly outputPortName: string;
  readonly description: string;
}

export interface DiscoverySuggestion {
  readonly capabilityId: CapabilityId;
  readonly capabilityVersion: CapabilityVersion;
  readonly capabilityName: string;
  readonly capabilityDescription: string;
  readonly capabilitySource: CapabilitySource;
  readonly relevance: number;
  readonly readiness: Readiness;
  readonly satisfiedInputs: readonly string[];
  readonly unsatisfiedInputs: readonly string[];
  readonly explanation: readonly ExplanationStep[];
  readonly matchReason: MatchReason;
}

export interface SatisfactionResult {
  readonly capabilityId: CapabilityId;
  readonly availableTypes: ReadonlySet<SemanticTypeId>;
  readonly satisfiedPorts: ReadonlyMap<string, SemanticTypeId>;
  readonly unsatisfiedPorts: ReadonlyMap<string, SemanticTypeId>;
  readonly satisfactionRatio: number;
  readonly isFullySatisfied: boolean;
}

export interface FlowProposal {
  readonly proposalType: ProposalType;
  readonly capabilitiesToInsert: readonly {
    readonly id: CapabilityId;
    readonly version: CapabilityVersion;
    readonly name: string;
  }[];
  readonly connectionsToMake: readonly {
    readonly sourceCapabilityId: CapabilityId;
    readonly sourcePort: string;
    readonly targetCapabilityId: CapabilityId;
    readonly targetPort: string;
  }[];
  readonly path: SemanticPath | null;
  readonly explanation: readonly ExplanationStep[];
  readonly estimatedCost: number;
  readonly authRequirements: readonly string[];
}

export interface FlowContext {
  readonly availableOutputTypes: ReadonlySet<SemanticTypeId>;
  readonly nodeOutputs: ReadonlyMap<string, readonly SemanticTypeId[]>;
  readonly existingCapabilityIds: ReadonlySet<CapabilityId>;
}

export interface PathOptions {
  readonly maxDepth?: number;
  readonly maxResults?: number;
  readonly preferShortest?: boolean;
}

export interface SuggestionOptions {
  readonly maxResults?: number;
  readonly includeUnreachable?: boolean;
}

export interface ConnectionSuggestion {
  readonly sourceNodeId: string;
  readonly sourcePortName: string;
  readonly sourceType: SemanticTypeId;
  readonly targetPortName: string;
  readonly targetType: SemanticTypeId;
  readonly confidence: number;
  readonly explanation: ExplanationStep;
}

export type DiscoveryQueryType =
  | 'port_discovery'
  | 'bridging'
  | 'goal_search'
  | 'context_suggestions'
  | 'auto_complete'
  | 'assisted';

export interface DiscoveryQuery {
  readonly queryType: DiscoveryQueryType;
  readonly sourceType?: SemanticTypeId;
  readonly targetType?: SemanticTypeId;
  readonly searchTerm?: string;
  readonly naturalLanguageGoal?: string;
  readonly flowContext?: FlowContext;
  readonly maxDepth?: number;
  readonly maxResults?: number;
}
