import type { PipelineDefinition } from '@eve-fabric/core';
import { stringify } from 'yaml';

export function emitPipelineYaml(pipeline: PipelineDefinition): string {
  const doc: Record<string, unknown> = {
    id: pipeline.id,
    version: pipeline.version,
    name: pipeline.name,
  };

  if (pipeline.description) {
    doc.description = pipeline.description;
  }

  doc.inputs = pipeline.inputs.map((inp) => {
    const entry: Record<string, unknown> = {
      name: inp.name,
      semanticType: inp.semanticType,
    };
    if (inp.description) entry.description = inp.description;
    entry.required = inp.required;
    return entry;
  });

  doc.nodes = pipeline.nodes.map((node) => ({
    id: node.id,
    capability: { id: node.capability.id, version: node.capability.version as string },
  }));

  doc.edges = pipeline.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
  }));

  doc.outputs = pipeline.outputs.map((output) => ({
    name: output.name,
    source: output.source,
  }));

  return stringify(doc);
}
