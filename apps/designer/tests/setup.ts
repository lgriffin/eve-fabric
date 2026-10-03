/**
 * What React Flow needs of a browser that jsdom does not provide. Runs for
 * every test file; it only acts where a document exists.
 */
if (typeof window !== 'undefined') {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
  class DOMMatrixReadOnlyStub {
    m22 = 1;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([^)]+)\)/)?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }
  window.DOMMatrixReadOnly ??= DOMMatrixReadOnlyStub as unknown as typeof DOMMatrixReadOnly;
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: { configurable: true, get: () => 600 },
    offsetWidth: { configurable: true, get: () => 800 },
  });
  (SVGElement.prototype as unknown as { getBBox: () => DOMRect }).getBBox ??= () =>
    ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
}
