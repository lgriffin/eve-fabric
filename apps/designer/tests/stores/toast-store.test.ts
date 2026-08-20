import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useToastStore } from '../../src/stores/toast-store.js';

describe('toast-store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds a toast with generated id', () => {
    useToastStore.getState().addToast('error', 'Save failed', 'Cannot connect to gateway');

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]!.severity).toBe('error');
    expect(toasts[0]!.title).toBe('Save failed');
    expect(toasts[0]!.message).toBe('Cannot connect to gateway');
    expect(toasts[0]!.id).toBeTruthy();
  });

  it('dismisses a toast by id', () => {
    useToastStore.getState().addToast('success', 'Saved', 'Pipeline saved');
    const id = useToastStore.getState().toasts[0]!.id;

    useToastStore.getState().dismissToast(id);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('auto-dismisses after 8 seconds', () => {
    useToastStore.getState().addToast('info', 'Info', 'Something happened');
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(8000);

    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it('supports all severity levels', () => {
    const store = useToastStore.getState();
    store.addToast('error', 'E', 'm');
    store.addToast('warning', 'W', 'm');
    store.addToast('success', 'S', 'm');
    store.addToast('info', 'I', 'm');

    const severities = useToastStore.getState().toasts.map((t) => t.severity);
    expect(severities).toEqual(['error', 'warning', 'success', 'info']);
  });

  it('caps queue at 5 toasts', () => {
    const store = useToastStore.getState();
    for (let i = 0; i < 7; i++) {
      store.addToast('info', `Toast ${i}`, `Message ${i}`);
    }

    expect(useToastStore.getState().toasts).toHaveLength(5);
    expect(useToastStore.getState().toasts[0]!.title).toBe('Toast 2');
  });
});
