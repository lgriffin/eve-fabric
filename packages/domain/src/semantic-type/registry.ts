import type { SemanticTypeDefinition, SemanticTypeId } from './semantic-type.js';

export class SemanticTypeRegistry {
  private readonly types = new Map<string, SemanticTypeDefinition>();

  register(type: SemanticTypeDefinition): void {
    const key = type.id as string;
    if (this.types.has(key)) {
      throw new Error(`Semantic type "${key}" is already registered`);
    }
    this.types.set(key, type);
  }

  get(id: SemanticTypeId): SemanticTypeDefinition {
    const type = this.types.get(id);
    if (!type) {
      throw new Error(`Semantic type "${id as string}" is not registered`);
    }
    return type;
  }

  has(id: SemanticTypeId): boolean {
    return this.types.has(id);
  }

  listByCategory(category: string): ReadonlyArray<SemanticTypeDefinition> {
    return [...this.types.values()].filter((t) => t.category === category);
  }

  list(): ReadonlyArray<SemanticTypeDefinition> {
    return [...this.types.values()];
  }

  isCompatible(sourceTypeId: SemanticTypeId, targetTypeId: SemanticTypeId): boolean {
    return (sourceTypeId as string) === (targetTypeId as string);
  }
}
