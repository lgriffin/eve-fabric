import { z } from 'zod';

declare const __brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type CapabilityId = Brand<string, 'CapabilityId'>;
export type CapabilityVersion = Brand<string, 'CapabilityVersion'>;

const CAPABILITY_ID_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
const SEMVER_CORE = /^\d+\.\d+\.\d+/;
const SEMVER_PRERELEASE = /(-[a-zA-Z0-9.]+)?/;
const SEMVER_BUILD = /(\+[a-zA-Z0-9.]+)?$/;
const SEMVER_PATTERN = new RegExp(
  SEMVER_CORE.source + SEMVER_PRERELEASE.source + SEMVER_BUILD.source,
);

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
  z.string().regex(SEMVER_PATTERN, 'Must be semver (e.g., "1.0.0" or "1.0.0-beta.1")'),
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
      `Invalid capability version "${version}": must be semver format (e.g., "1.0.0" or "1.0.0-beta.1")`,
    );
  }
  return version as CapabilityVersion;
}

function splitSemver(v: CapabilityVersion): { core: string; prerelease: string | undefined } {
  const str = v as string;
  const buildIdx = str.indexOf('+');
  const noBuild = buildIdx >= 0 ? str.slice(0, buildIdx) : str;
  const preIdx = noBuild.indexOf('-');
  if (preIdx >= 0) {
    return { core: noBuild.slice(0, preIdx), prerelease: noBuild.slice(preIdx + 1) };
  }
  return { core: noBuild, prerelease: undefined };
}

function compareNumericStrings(a: string, b: string): number {
  if (a.length !== b.length) return a.length - b.length;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function compareVersions(a: CapabilityVersion, b: CapabilityVersion): number {
  const av = splitSemver(a);
  const bv = splitSemver(b);
  const aParts = av.core.split('.');
  const bParts = bv.core.split('.');
  for (let i = 0; i < 3; i++) {
    const cmp = compareNumericStrings(aParts[i]!, bParts[i]!);
    if (cmp !== 0) return cmp;
  }
  if (av.prerelease === undefined && bv.prerelease === undefined) return 0;
  if (av.prerelease === undefined) return 1;
  if (bv.prerelease === undefined) return -1;
  if (av.prerelease < bv.prerelease) return -1;
  if (av.prerelease > bv.prerelease) return 1;
  return 0;
}

export function isCompatibleUpgrade(from: CapabilityVersion, to: CapabilityVersion): boolean {
  const fromMajor = splitSemver(from).core.split('.')[0]!;
  const toMajor = splitSemver(to).core.split('.')[0]!;
  return fromMajor === toMajor && compareVersions(to, from) > 0;
}

export function isBreakingUpgrade(from: CapabilityVersion, to: CapabilityVersion): boolean {
  const fromMajor = splitSemver(from).core.split('.')[0]!;
  const toMajor = splitSemver(to).core.split('.')[0]!;
  return compareNumericStrings(toMajor, fromMajor) > 0;
}

export interface CapabilityRef {
  readonly id: CapabilityId;
  readonly version?: CapabilityVersion | undefined;
}
