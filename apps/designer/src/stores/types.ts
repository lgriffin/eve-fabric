import type { Node } from '@xyflow/react';
import { z } from 'zod';

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
const ModeSchema = z.enum(['explore', 'build', 'review']);

export type Mode = z.infer<typeof ModeSchema>;

export const MODES: readonly Mode[] = ModeSchema.options;

/** The mode a URL hash names, if it names one. */
export function modeFromHash(hash: string): Mode | null {
  const named = ModeSchema.safeParse(hash.replace(/^#/, ''));
  return named.success ? named.data : null;
}

/** The mode the designer opens in: the one its URL names, else Explore. */
export function startingMode(): Mode {
  if (typeof window === 'undefined') return 'explore';
  return modeFromHash(window.location.hash) ?? 'explore';
}
