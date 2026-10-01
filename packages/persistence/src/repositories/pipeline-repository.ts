import type { PipelineDefinition } from '@eve-fabric/core';

export interface PipelineRepository {
  save(pipeline: PipelineDefinition): Promise<void>;
  getById(id: string): Promise<PipelineDefinition | undefined>;
  list(): Promise<PipelineDefinition[]>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryPipelineRepository implements PipelineRepository {
  private readonly store = new Map<string, PipelineDefinition>();

  async save(pipeline: PipelineDefinition): Promise<void> {
    this.store.set(pipeline.id, pipeline);
  }

  async getById(id: string): Promise<PipelineDefinition | undefined> {
    return this.store.get(id);
  }

  async list(): Promise<PipelineDefinition[]> {
    return [...this.store.values()];
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }
}
