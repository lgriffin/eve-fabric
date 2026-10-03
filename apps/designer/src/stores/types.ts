import type { Node } from '@xyflow/react';

export type ToastSeverity = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  severity: ToastSeverity;
  title: string;
  message: string;
  dismissible: boolean;
  autoDismissMs: number;
  createdAt: number;
}

export interface CapabilityNodeData {
  capabilityId: string;
  capabilityVersion: string;
  label: string;
  source: string;
  inputs: Array<{ name: string; semanticType: string; required: boolean }>;
  outputs: Array<{ name: string; semanticType: string }>;
  [key: string]: unknown;
}

export type CapabilityFlowNode = Node<CapabilityNodeData, 'capability'>;

/**
 * The designer's three layouts over the one question. Explore shows the
 * subjects and moves alone; Build adds the canvas; Review opens a saved
 * question read-only, with Run. The mode is in the URL's hash too.
 */
export type Mode = 'explore' | 'build' | 'review';

export const MODES: readonly Mode[] = ['explore', 'build', 'review'];

function isMode(value: string): value is Mode {
  return (MODES as readonly string[]).includes(value);
}

/** The mode a URL hash names, if it names one. */
export function modeFromHash(hash: string): Mode | null {
  const name = hash.replace(/^#/, '');
  return isMode(name) ? name : null;
}

/** The mode the designer opens in: the one its URL names, else Explore. */
export function startingMode(): Mode {
  if (typeof window === 'undefined') return 'explore';
  return modeFromHash(window.location.hash) ?? 'explore';
}
