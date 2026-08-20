import { create } from 'zustand';
import type { Toast, ToastSeverity } from './types.js';

const MAX_TOASTS = 5;
const AUTO_DISMISS_MS = 8000;

let toastCounter = 0;

interface ToastState {
  toasts: Toast[];
}

interface ToastActions {
  addToast: (severity: ToastSeverity, title: string, message: string) => void;
  dismissToast: (id: string) => void;
}

function removeToast(set: (fn: (state: ToastState) => ToastState) => void, id: string) {
  set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
}

export const useToastStore = create<ToastState & ToastActions>()((set) => ({
  toasts: [],

  addToast: (severity, title, message) => {
    const id = `toast-${++toastCounter}`;
    const toast: Toast = {
      id,
      severity,
      title,
      message,
      dismissible: true,
      autoDismissMs: AUTO_DISMISS_MS,
      createdAt: Date.now(),
    };

    set((state) => {
      const updated = [...state.toasts, toast];
      return { toasts: updated.slice(-MAX_TOASTS) };
    });

    setTimeout(() => removeToast(set, id), AUTO_DISMISS_MS);
  },

  dismissToast: (id) => {
    removeToast(set, id);
  },
}));
