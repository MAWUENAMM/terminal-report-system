"use client";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-5">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title mt-2">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {description}
        </p>
      </div>
      {children}
    </header>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="surface rounded-2xl p-10 text-center text-sm leading-7 text-muted">
      {children}
    </div>
  );
}
export function Restricted() {
  return (
    <Empty>
      You do not have access to this page. Use your assigned workspace from the
      navigation.
    </Empty>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const last = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const nodes = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] button:not(:disabled),[role="dialog"] input:not(:disabled),[role="dialog"] select:not(:disabled),[role="dialog"] textarea:not(:disabled),[role="dialog"] a[href]',
          ),
        );
        if (!nodes.length) return;
        const first = nodes[0],
          end = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          end.focus();
        } else if (!e.shiftKey && document.activeElement === end) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handler);
    document.querySelector<HTMLElement>('[role="dialog"] button')?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handler);
      last?.focus();
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-white p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            className="rounded-lg p-2"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </header>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
