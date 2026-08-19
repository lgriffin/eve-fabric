import { z } from 'zod';

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type CapabilityId = Brand<string, 'CapabilityId'>;
export type CapabilityVersion = Brand<number, 'CapabilityVersion'>;

const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;

export const capabilityIdSchema = z
  .string()
  .regex(CAPABILITY_ID_PATTERN, 'Must be dot-notation (e.g., "market.orders")');

export const capabilityVersionSchema = z.number().int().positive();

export function capabilityId(id: string): CapabilityId {
  if (!CAPABILITY_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid capability ID "${id}": must be lowercase dot-notation (e.g., "market.orders")`,
    );
  }
  return id as CapabilityId;
}

export function capabilityVersion(version: number): CapabilityVersion {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Invalid capability version "${version}": must be a positive integer`);
  }
  return version as CapabilityVersion;
}

export interface CapabilityRef {
  readonly id: CapabilityId;
  readonly version?: CapabilityVersion | undefined;
}
