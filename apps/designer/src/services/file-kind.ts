/**
 * What a file opened in the designer holds: a saved question (GraphQL) or a
 * weave (package format v2). Anything else is not the designer's to open.
 */
type FileKind = 'question' | 'weave' | 'unknown';

export function fileKind(name: string, text: string): FileKind {
  const lower = name.toLowerCase();
  if (lower.endsWith('.graphql') || lower.endsWith('.gql')) return 'question';
  if (/^\s*(\{|query\b)/.test(text)) return 'question';
  if (/^format:\s*2\s*$/m.test(text)) return 'weave';
  return 'unknown';
}

/** The file types the designer opens, for a file picker's `accept`. */
export const OPENABLE = '.graphql,.gql,.weave.yaml,.yaml,.yml';
