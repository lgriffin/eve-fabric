/**
 * What a file opened in the designer holds: a saved question (GraphQL), a
 * weave (package format v2), or a pipeline written as YAML.
 */
type FileKind = 'question' | 'weave' | 'pipeline';

export function fileKind(name: string, text: string): FileKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.graphql') || lower.endsWith('.gql')) return 'question';
  if (/^\s*(\{|query\b)/.test(text)) return 'question';
  if (/^format:\s*2\s*$/m.test(text)) return 'weave';
  return 'pipeline';
}

/** The file types the designer opens, for a file picker's `accept`. */
export const OPENABLE = '.graphql,.gql,.yaml,.yml';
