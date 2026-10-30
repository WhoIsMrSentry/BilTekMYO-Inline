'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './icons';
import type { IconName } from './icons';
import { statusMeta } from './domain';
import type { ContentStatus } from './domain';

export type Toast = { id: number; tone: 'success' | 'error'; message: string };
export type ConfirmRequest = { title: string; detail: string; action: string; tone?: 'danger' | 'primary'; run: () => Promise<void> | void };

export function Empty({ icon = 'layers', title, detail, action, onAction }: { icon?: IconName; title: string; detail: string; action?: string; onAction?: () => void }) {
  return (
    <div className="empty-state">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <strong>{title}</strong>
      <small>{detail}</small>
      {action && <button className="button button-soft" onClick={onAction} type="button">{action}</button>}
    </div>
  );
}

export function StatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`badge badge-${status}`}><i />{statusMeta[status]}</span>;
}

export function Modal({ title, description, onClose, children, wide }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const panel = useRef<HTMLDivElement>(null);
  useEscape(onClose);
  useEffect(() => { panel.current?.querySelector<HTMLElement>('input, button.button')?.focus(); }, []);
  return (
    <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div aria-label={title} aria-modal="true" className={wide ? 'modal modal-wide' : 'modal'} ref={panel} role="dialog">
        <header className="modal-head">
          <div><h2>{title}</h2>{description && <p>{description}</p>}</div>
          <button aria-label="Kapat" className="icon-button" onClick={onClose} type="button"><Icon name="close" /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest; onClose: () => void }) {
  return (
    <Modal description={request.detail} onClose={onClose} title={request.title}>
      <div className="modal-actions">
        <button className="button button-ghost" onClick={onClose} type="button">Vazgeç</button>
        <button className={`button ${request.tone === 'primary' ? 'button-primary' : 'button-danger'}`} onClick={() => { onClose(); void request.run(); }} type="button">{request.action}</button>
      </div>
    </Modal>
  );
}

export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div aria-live="polite" className="toast-stack">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.tone}`} key={toast.id} role="status">
          <Icon name={toast.tone === 'success' ? 'check' : 'alert'} size={17} />
          <span>{toast.message}</span>
          <button aria-label="Bildirimi kapat" onClick={() => onDismiss(toast.id)} type="button"><Icon name="close" size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function useEscape(onEscape: () => void) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onEscape(); };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onEscape]);
}
