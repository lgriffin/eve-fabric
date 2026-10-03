import { useCallback } from 'react';
import { useDraftStore } from '../stores/draft-store.js';
import { useToastStore } from '../stores/toast-store.js';
import { addWeave } from '../services/draft-client.js';
import { fileKind, OPENABLE } from '../services/file-kind.js';

/**
 * Opens what a file holds: a saved question becomes the open draft, and a
 * weave is added to the gateway's fabric (and offered as a move from then
 * on). Nothing else is the designer's to open.
 */
export function useOpenFile() {
  const addToast = useToastStore((s) => s.addToast);

  const openText = useCallback(
    async (name: string, text: string) => {
      const kind = fileKind(name, text);
      if (kind === 'question') {
        const opened = await useDraftStore.getState().load(text);
        if (opened) addToast('success', 'Opened', `The question in ${name}`);
        else addToast('error', 'Not opened', useDraftStore.getState().error ?? name);
        return;
      }
      if (kind === 'weave') {
        const added = await addWeave(text);
        if (!added.ok) {
          addToast('error', 'Weave not added', added.message);
          return;
        }
        addToast('success', 'Weave added', `${added.data.id}@${added.data.version} is now a move`);
        await useDraftStore.getState().refresh();
        return;
      }
      addToast('error', 'Not opened', `${name} is neither a question (.graphql) nor a weave`);
    },
    [addToast],
  );

  const openFile = useCallback(
    (file: File) => {
      void file.text().then((text) => openText(file.name, text));
    },
    [openText],
  );

  const handleOpen = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = OPENABLE;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) openFile(file);
    };
    input.click();
  }, [openFile]);

  /** A file dropped anywhere on the designer is opened as if picked. */
  const handleDrop = useCallback(
    (event: { preventDefault(): void; dataTransfer: DataTransfer | null }) => {
      const file = event.dataTransfer?.files[0];
      if (file === undefined) return;
      event.preventDefault();
      openFile(file);
    },
    [openFile],
  );

  return { handleOpen, handleDrop, openText };
}
