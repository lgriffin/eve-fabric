// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, cleanup, act } from '@testing-library/react';
import { useMode } from '../../src/hooks/useMode.js';
import { modeFromHash, startingMode } from '../../src/stores/types.js';
import { useDraftStore } from '../../src/stores/draft-store.js';

describe('useMode', () => {
  beforeEach(() => {
    window.location.hash = '';
    useDraftStore.getState().clear();
    useDraftStore.setState({ mode: 'explore' });
  });
  afterEach(() => cleanup());

  it('reads a mode from the hash and ignores anything else', () => {
    expect(modeFromHash('#build')).toBe('build');
    expect(modeFromHash('#review')).toBe('review');
    expect(modeFromHash('#elsewhere')).toBeNull();
    expect(modeFromHash('')).toBeNull();
  });

  it('starts in the mode the URL names', () => {
    window.location.hash = '#build';
    expect(startingMode()).toBe('build');
    const { result } = renderHook(() => useMode());
    expect(result.current).toBe('build');
  });

  it('writes the mode to the hash when it changes', () => {
    const { result } = renderHook(() => useMode());
    expect(window.location.hash).toBe('#explore');
    act(() => useDraftStore.getState().setMode('review'));
    expect(result.current).toBe('review');
    expect(window.location.hash).toBe('#review');
  });

  it('pushes a switch, so Back returns to the mode before', () => {
    window.location.hash = '#explore';
    const before = window.history.length;
    renderHook(() => useMode());
    act(() => useDraftStore.getState().setMode('build'));
    expect(window.location.hash).toBe('#build');
    expect(window.history.length).toBe(before + 1);
  });

  it('replaces a hash that names no mode rather than keeping it behind the first', () => {
    window.location.hash = '#elsewhere';
    const before = window.history.length;
    renderHook(() => useMode());
    expect(window.location.hash).toBe('#explore');
    expect(window.history.length).toBe(before);
  });

  it('follows the hash when the user changes it', () => {
    const { result } = renderHook(() => useMode());
    act(() => {
      window.location.hash = '#build';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current).toBe('build');
  });
});
