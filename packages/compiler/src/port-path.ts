/**
 * An edge may read a field of a record a step outputs: `cheapest.cheapest.location_id`
 * is the `location_id` field of the `cheapest` port of step `cheapest`. The part
 * after the node id is the port, then any fields, dot separated.
 */
export interface PortPath {
  readonly port: string;
  /** The fields read inside the port's value, outermost first; empty for the whole value. */
  readonly fieldPath: readonly string[];
}

export function splitPortPath(portAndFields: string): PortPath {
  const [port = '', ...fieldPath] = portAndFields.split('.');
  return { port, fieldPath };
}

/** The binding fields for a step-output edge reading `portAndFields`. */
export function outputBinding(portAndFields: string): {
  outputPortName: string;
  fieldPath?: readonly string[];
} {
  const { port, fieldPath } = splitPortPath(portAndFields);
  return fieldPath.length > 0 ? { outputPortName: port, fieldPath } : { outputPortName: port };
}
