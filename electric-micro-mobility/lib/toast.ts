/**
 * App-wide toast messages: a short, non-blocking note at the top of the screen.
 *
 * Use this instead of `Alert.alert` for results and errors that need no decision
 * ("Reserved", "Could not end ride"). Keep native dialogs for real confirmations
 * (delete account, pay for a package).
 *
 * The state lives in this module so hooks and plain functions can call `toast.*`
 * without a React context. `<ToastHost />` renders it.
 */

import { haptics } from '@/lib/haptics';

export type ToastKind = 'success' | 'error' | 'info';

export type ToastAction = { label: string; onPress: () => void };

export type ToastMessage = {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  action?: ToastAction;
  /** Milliseconds before it hides on its own. */
  duration: number;
};

type ShowOptions = { message?: string; action?: ToastAction; duration?: number };

type Listener = () => void;

const listeners = new Set<Listener>();
let current: ToastMessage | null = null;
let nextId = 1;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

/** Hosts mounted right now, newest last. Only the newest one renders (see `ToastHost`). */
let hosts: string[] = [];

function emit() {
  for (const l of listeners) l();
}

function clearTimer() {
  if (hideTimer != null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}

function show(kind: ToastKind, title: string, opts: ShowOptions = {}) {
  clearTimer();
  const duration = opts.duration ?? (opts.action ? 5000 : kind === 'error' ? 4500 : 3200);
  current = { id: nextId++, kind, title, message: opts.message, action: opts.action, duration };
  hideTimer = setTimeout(hide, duration);
  if (kind === 'success') haptics.success();
  else if (kind === 'error') haptics.error();
  emit();
}

function hide() {
  clearTimer();
  if (current == null) return;
  current = null;
  emit();
}

export const toast = {
  success: (title: string, opts?: ShowOptions) => show('success', title, opts),
  error: (title: string, opts?: ShowOptions) => show('error', title, opts),
  info: (title: string, opts?: ShowOptions) => show('info', title, opts),
  hide,
};

export function subscribeToast(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToast() {
  return current;
}

export function registerToastHost(id: string) {
  hosts = [...hosts.filter((h) => h !== id), id];
  emit();
}

export function unregisterToastHost(id: string) {
  hosts = hosts.filter((h) => h !== id);
  emit();
}

export function getTopToastHost(): string | undefined {
  return hosts[hosts.length - 1];
}
