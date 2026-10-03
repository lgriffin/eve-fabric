import { useEffect } from 'react';

export interface ShortcutHandlers {
  onUndo: () => void;
  onSave: () => void;
  onSelectAll: () => void;
  onEscape: () => void;
  onToggleHelp: () => void;
}

function isTextInput(target: EventTarget | null): boolean {
  if (!target) return false;
  const el = target as { tagName?: string; isContentEditable?: boolean };
  if (!el.tagName) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
  return el.isContentEditable === true;
}

export function handleKeyboardShortcut(event: KeyboardEvent, handlers: ShortcutHandlers): void {
  const ctrl = event.ctrlKey || event.metaKey;
  const inText = isTextInput(event.target);

  if (ctrl && event.key === 's') {
    event.preventDefault();
    handlers.onSave();
    return;
  }

  if (ctrl && event.key.toLowerCase() === 'z') {
    event.preventDefault();
    handlers.onUndo();
    return;
  }

  if (ctrl && event.key.toLowerCase() === 'a' && !inText) {
    event.preventDefault();
    handlers.onSelectAll();
    return;
  }

  if (inText) return;

  if (event.key === 'Escape') {
    handlers.onEscape();
    return;
  }

  if (event.key === '?') {
    handlers.onToggleHelp();
  }
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    const listener = (e: KeyboardEvent) => handleKeyboardShortcut(e, handlers);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handlers]);
}
