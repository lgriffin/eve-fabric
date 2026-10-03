import { Kind, parse, type DocumentNode, type FieldNode, type SelectionNode } from 'graphql';
import type { Fabric, FabricIdentity } from '@eve-fabric/fabric';

/** The body a GraphQL client POSTs. */
export interface GraphQLRequest {
  readonly query?: unknown;
  readonly variables?: unknown;
}

/** A GraphQL response: the question's answer in the shape the document asked for, or why not. */
interface GraphQLAnswer {
  readonly status: number;
  readonly body: {
    readonly data?: Record<string, unknown> | null;
    readonly errors?: readonly { message: string; extensions: { code: string } }[];
  };
}

const isField = (selection: SelectionNode): selection is FieldNode => selection.kind === Kind.FIELD;
const nameOf = (field: FieldNode): string => field.alias?.value ?? field.name.value;

/** A document that asks only about the schema: every top-level field is `__schema`, `__type` or the like. */
export function isIntrospection(document: DocumentNode): boolean {
  const fields = document.definitions.flatMap((definition) =>
    definition.kind === Kind.OPERATION_DEFINITION
      ? definition.selectionSet.selections.filter(isField)
      : [],
  );
  return fields.length > 0 && fields.every((field) => field.name.value.startsWith('__'));
}

/**
 * A question's answer, nested the way its document asked. A saved question is
 * one chain of fields down to its cursor; the answer is the value there. One
 * selected field under the cursor is the answer itself, so it sits under that
 * field; several, or none, sit at the cursor.
 */
function shaped(document: DocumentNode, answer: unknown): Record<string, unknown> {
  const operation = document.definitions.find((d) => d.kind === Kind.OPERATION_DEFINITION);
  if (operation === undefined) return {};
  const path: string[] = [];
  let selections: readonly SelectionNode[] = operation.selectionSet.selections;
  for (;;) {
    const fields = selections.filter(isField);
    const [only] = fields;
    if (fields.length !== 1 || only === undefined || only.name.value.startsWith('__')) break;
    path.push(nameOf(only));
    if (only.selectionSet === undefined) break;
    selections = only.selectionSet.selections;
  }
  return path.reduceRight<unknown>((inner, name) => ({ [name]: inner }), answer) as Record<
    string,
    unknown
  >;
}

/**
 * Runs the question a GraphQL request carries. Variables are refused: a saved
 * question names its subject and fills its holes in the document itself.
 */
export async function answerQuestion(
  fabric: Fabric,
  request: GraphQLRequest,
  identity: FabricIdentity | undefined,
): Promise<GraphQLAnswer> {
  if (typeof request.query !== 'string') {
    return refused('a JSON body with a "query" string is required', 'BAD_REQUEST', 400);
  }
  if (request.variables !== undefined && Object.keys(request.variables as object).length > 0) {
    return refused(
      'a question takes no variables; write its values in the document',
      'BAD_REQUEST',
      400,
    );
  }
  let document: DocumentNode;
  try {
    document = parse(request.query);
  } catch (error) {
    return refused(messageOf(error), 'GRAPHQL_PARSE_FAILED', 400);
  }
  try {
    const draft = fabric.fromGraphQL(request.query, { as: identity });
    const { answer } = await fabric.query(draft);
    return { status: 200, body: { data: shaped(document, answer) } };
  } catch (error) {
    const code = error instanceof Error ? error.name : 'ERROR';
    return {
      status: 200,
      body: { data: null, errors: [{ message: messageOf(error), extensions: { code } }] },
    };
  }
}

function refused(message: string, code: string, status: number): GraphQLAnswer {
  return { status, body: { errors: [{ message, extensions: { code } }] } };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
