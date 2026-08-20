import { describe, it, expect, vi } from 'vitest';
import {
  handleKeyboardShortcut,
  type ShortcutHandlers,
} from '../../src/hooks/useKeyboardShortcuts.js';

function makeEvent(
  key: string,
  opts: { ctrlKey?: boolean; shiftKey?: boolean; metaKey?: boolean; target?: unknown } = {},
) {
  return {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    metaKey: opts.metaKey ?? false,
    target: opts.target ?? null,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

function makeHandlers(): ShortcutHandlers {
  return {
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onSelectAll: vi.fn(),
    onEscape: vi.fn(),
    onToggleHelp: vi.fn(),
  };
}

describe('handleKeyboardShortcut', () => {
  it('Ctrl+Z triggers undo', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(makeEvent('z', { ctrlKey: true }), h);
    expect(h.onUndo).toHaveBeenCalledOnce();
  });

  it('Ctrl+Shift+Z triggers redo', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(makeEvent('z', { ctrlKey: true, shiftKey: true }), h);
    expect(h.onRedo).toHaveBeenCalledOnce();
    expect(h.onUndo).not.toHaveBeenCalled();
  });

  it('Ctrl+S triggers save', () => {
    const h = makeHandlers();
    const event = makeEvent('s', { ctrlKey: true });
    handleKeyboardShortcut(event, h);
    expect(h.onSave).toHaveBeenCalledOnce();
    expect(event.preventDefault).toHaveBeenCalled();
  });

  it('Delete triggers delete', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(makeEvent('Delete'), h);
    expect(h.onDelete).toHaveBeenCalledOnce();
  });

  it('Backspace triggers delete', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(makeEvent('Backspace'), h);
    expect(h.onDelete).toHaveBeenCalledOnce();
  });

  it('Escape triggers escape', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(makeEvent('Escape'), h);
    expect(h.onEscape).toHaveBeenCalledOnce();
  });

  it('? triggers help toggle', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(makeEvent('?'), h);
    expect(h.onToggleHelp).toHaveBeenCalledOnce();
  });

  it('Ctrl+A triggers select all', () => {
    const h = makeHandlers();
    handleKeyboardShortcut(makeEvent('a', { ctrlKey: true }), h);
    expect(h.onSelectAll).toHaveBeenCalledOnce();
  });

  it('ignores non-modifier shortcuts when target is an input', () => {
    const h = makeHandlers();
    const inputEl = { tagName: 'INPUT', isContentEditable: false };
    handleKeyboardShortcut(makeEvent('Delete', { target: inputEl }), h);
    expect(h.onDelete).not.toHaveBeenCalled();
  });

  it('ignores non-modifier shortcuts when target is a textarea', () => {
    const h = makeHandlers();
    const textarea = { tagName: 'TEXTAREA', isContentEditable: false };
    handleKeyboardShortcut(makeEvent('Backspace', { target: textarea }), h);
    expect(h.onDelete).not.toHaveBeenCalled();
  });

  it('allows Ctrl+S even in input elements', () => {
    const h = makeHandlers();
    const inputEl = { tagName: 'INPUT', isContentEditable: false };
    handleKeyboardShortcut(makeEvent('s', { ctrlKey: true, target: inputEl }), h);
    expect(h.onSave).toHaveBeenCalledOnce();
  });
});
