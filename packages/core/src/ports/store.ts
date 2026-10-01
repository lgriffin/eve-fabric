/** A weave as kept: what identifies it and the document exactly as it was added. */
export interface StoredWeave {
  readonly id: string;
  readonly version: string;
  readonly digest: string;
  readonly document: string;
}

/**
 * Where a fabric keeps what it was given at run time, so a restart comes back
 * with it. Packs are code and come back by being installed again; weaves are
 * data and come back from here.
 */
export interface Store {
  putWeave(weave: StoredWeave): Promise<void>;
  listWeaves(): Promise<readonly StoredWeave[]>;
  removeWeave(id: string, version: string): Promise<void>;
}

/** A store that lasts as long as the process. */
export function memoryStore(): Store {
  const weaves = new Map<string, StoredWeave>();
  const key = (id: string, version: string) => `${id}@${version}`;
  return {
    putWeave(weave) {
      weaves.set(key(weave.id, weave.version), weave);
      return Promise.resolve();
    },
    listWeaves() {
      return Promise.resolve([...weaves.values()]);
    },
    removeWeave(id, version) {
      weaves.delete(key(id, version));
      return Promise.resolve();
    },
  };
}
