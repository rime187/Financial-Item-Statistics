import React, { useEffect, useRef, useState } from 'react';

let cachedSupportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText =
    'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
    canTransitionDisplay()
  );
}

async function closeTopLayer(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 600)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }
  if (dialog.open) {
    dialog.close();
  }
}

/* ==================== Top-Layer Open Dialog Stack (for interactive Toasts) ==================== */

const openDialogStack: HTMLDialogElement[] = [];
const stackListeners = new Set<() => void>();

function notifyStackListeners() {
  for (const listener of stackListeners) listener();
}

function pushOpenDialog(dialog: HTMLDialogElement) {
  const idx = openDialogStack.indexOf(dialog);
  if (idx >= 0) openDialogStack.splice(idx, 1);
  openDialogStack.push(dialog);
  notifyStackListeners();
}

function removeOpenDialog(dialog: HTMLDialogElement) {
  const idx = openDialogStack.indexOf(dialog);
  if (idx >= 0) {
    openDialogStack.splice(idx, 1);
    notifyStackListeners();
  }
}

/**
 * Returns the topmost currently open modal `<dialog>` element, or `null`
 * if none is open. Allows floating status toasts (with Undo buttons) to
 * portal inside the active top-layer dialog so they remain visible and interactive.
 */
export function useTopOpenDialog(): HTMLDialogElement | null {
  const [topDialog, setTopDialog] = useState<HTMLDialogElement | null>(
    () => openDialogStack[openDialogStack.length - 1] ?? null
  );

  useEffect(() => {
    const sync = () => {
      setTopDialog(openDialogStack[openDialogStack.length - 1] ?? null);
    };
    stackListeners.add(sync);
    sync();
    return () => {
      stackListeners.delete(sync);
    };
  }, []);

  return topDialog;
}

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  variant?: 'modal' | 'drawer';
  maxWidth?: string;
  ariaLabelledBy?: string;
  ariaLabel?: string;
  closedBy?: 'any' | 'closerequest' | 'none';
  /**
   * Optional hook invoked when the user presses Esc or clicks outside.
   * Return `false` to consume the cancel (e.g. exit an inline edit row first)
   * without closing the dialog.
   */
  onBeforeCancel?: () => boolean;
  panelClassName?: string;
  children: React.ReactNode;
}

/**
 * Accessible native `<dialog>` wrapper using `showModal()` top-layer rendering,
 * progressive `closedby="any"` light dismiss with pointer-bounds fallback,
 * and smooth `@starting-style` + `overlay` top-layer transitions.
 */
export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  variant = 'modal',
  maxWidth,
  ariaLabelledBy,
  ariaLabel,
  closedBy = 'any',
  onBeforeCancel,
  panelClassName = '',
  children,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const onBeforeCancelRef = useRef(onBeforeCancel);
  const [shouldRender, setShouldRender] = useState(isOpen);

  onCloseRef.current = onClose;
  onBeforeCancelRef.current = onBeforeCancel;

  // Keep content mounted briefly during exit animation so transitions never flash empty
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }
    const timer = window.setTimeout(() => setShouldRender(false), 260);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Sync open/close state with native showModal() / closeTopLayer()
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.removeAttribute('data-closing');
      if (!dialog.open) {
        dialog.showModal();
      }
      pushOpenDialog(dialog);
    } else if (dialog.open) {
      removeOpenDialog(dialog);
      void closeTopLayer(dialog);
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog) removeOpenDialog(dialog);
    };
  }, []);

  // Native cancel, close, and fallback light-dismiss listeners
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event) => {
      event.preventDefault();
      if (onBeforeCancelRef.current && onBeforeCancelRef.current() === false) {
        return;
      }
      removeOpenDialog(dialog);
      void closeTopLayer(dialog);
    };

    const handleClose = () => {
      removeOpenDialog(dialog);
      dialog.removeAttribute('data-closing');
      dialog.returnValue = '';
      onCloseRef.current();
    };

    dialog.addEventListener('cancel', handleCancel);
    dialog.addEventListener('close', handleClose);

    // Fallback light dismiss when native `closedby` is unsupported (e.g. Safari)
    const needsClosedByFallback =
      closedBy === 'any' && !('closedBy' in HTMLDialogElement.prototype);
    let pressedOutside = false;

    const isOutside = (e: PointerEvent) => {
      const rect = dialog.getBoundingClientRect();
      return (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      );
    };

    const handlePointerDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (!pressedOutside || !isOutside(e)) {
        pressedOutside = false;
        return;
      }
      pressedOutside = false;
      if (onBeforeCancelRef.current && onBeforeCancelRef.current() === false) {
        return;
      }
      removeOpenDialog(dialog);
      void closeTopLayer(dialog);
    };

    if (needsClosedByFallback) {
      dialog.addEventListener('pointerdown', handlePointerDown);
      dialog.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      dialog.removeEventListener('cancel', handleCancel);
      dialog.removeEventListener('close', handleClose);
      if (needsClosedByFallback) {
        dialog.removeEventListener('pointerdown', handlePointerDown);
        dialog.removeEventListener('pointerup', handlePointerUp);
      }
    };
  }, [closedBy]);

  const variantClass =
    variant === 'drawer' ? 'app-dialog--drawer' : 'app-dialog--modal';

  const dialogStyle = maxWidth
    ? ({ '--dialog-max-w': maxWidth } as React.CSSProperties)
    : undefined;

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: closedBy } as Record<string, string>)}
      aria-labelledby={ariaLabelledBy}
      aria-label={!ariaLabelledBy ? ariaLabel : undefined}
      style={dialogStyle}
      className={`app-dialog ${variantClass}`}
    >
      {shouldRender && (
        <div
          className={`flex flex-col w-full ${
            variant === 'drawer'
              ? 'h-full bg-white border-l border-slate-200 shadow-2xl overflow-hidden'
              : 'max-h-[calc(100dvh-2rem)] bg-white rounded-2xl border border-slate-200/90 shadow-2xl overflow-hidden'
          } ${panelClassName}`}
        >
          {children}
        </div>
      )}
    </dialog>
  );
};
