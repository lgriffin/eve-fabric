import { z } from 'zod';

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type CapabilityId = Brand<string, 'CapabilityId'>;
export type CapabilityVersion = Brand<string, 'CapabilityVersion'>;

const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export const capabilityIdSchema = z
  .string()
  .regex(CAPABILITY_ID_PATTERN, 'Must be dot-notation (e.g., "market.orders")');

export const capabilityVersionSchema = z.preprocess(
  (val) => {
    if (typeof val === 'number' && Number.isInteger(val) && val >= 1) {
      return `${val}.0.0`;
    }
    return val;
  },
  z.string().regex(SEMVER_PATTERN, 'Must be semver (e.g., "1.0.0")'),
);

export function capabilityId(id: string): CapabilityId {
  if (!CAPABILITY_ID_PATTERN.test(id)) {
    throw new Error(
      `Invalid capability ID "${id}": must be lowercase dot-notation (e.g., "market.orders")`,
    );
  }
  return id as CapabilityId;
}

export function capabilityVersion(version: string | number): CapabilityVersion {
  if (typeof version === 'number') {
    if (!Number.isInteger(version) || version < 1) {
      throw new Error(`Invalid capability version "${version}": must be a positive integer`);
    }
    return `${version}.0.0` as CapabilityVersion;
  }
  if (!SEMVER_PATTERN.test(version)) {
    throw new Error(
      `Invalid capability version "${version}": must be semver format (e.g., "1.0.0")`,
    );
  }
  return version as CapabilityVersion;
}

function parseSemver(v: CapabilityVersion): [number, number, number] {
  const parts = (v as string).split('.').map(Number) as [number, number, number];
  return parts;
}

export function compareVersions(a: CapabilityVersion, b: CapabilityVersion): number {
  const [aMajor, aMinor, aPatch] = parseSemver(a);
  const [bMajor, bMinor, bPatch] = parseSemver(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

export function isCompatibleUpgrade(from: CapabilityVersion, to: CapabilityVersion): boolean {
  const [fromMajor] = parseSemver(from);
  const [toMajor] = parseSemver(to);
  return fromMajor === toMajor && compareVersions(to, from) > 0;
}

export function isBreakingUpgrade(from: CapabilityVersion, to: CapabilityVersion): boolean {
  const [fromMajor] = parseSemver(from);
  const [toMajor] = parseSemver(to);
  return toMajor > fromMajor;
}

export interface CapabilityRef {
  readonly id: CapabilityId;
  readonly version?: CapabilityVersion | undefined;
}
