import { useEffect } from 'react';
import { useDraftStore } from '../stores/draft-store.js';
import { modeFromHash, type Mode } from '../stores/types.js';

/**
 * A mode is a URL: #explore, #build or #review. The store opens in the one
 * the URL names; editing the hash switches, and switching writes the hash,
 * so a mode can be linked to and Back returns to the one before. A hash
 * that names no mode is replaced, not kept behind the first.
 */
export function useMode(): Mode {
  const mode = useDraftStore((s) => s.mode);
  const setMode = useDraftStore((s) => s.setMode);

  useEffect(() => {
    const follow = () => {
      const named = modeFromHash(window.location.hash);
      if (named !== null && named !== useDraftStore.getState().mode) setMode(named);
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [setMode]);

  useEffect(() => {
    if (window.location.hash === `#${mode}`) return;
    const write = modeFromHash(window.location.hash) === null ? 'replaceState' : 'pushState';
    window.history[write](null, '', `#${mode}`);
  }, [mode]);

  return mode;
}
