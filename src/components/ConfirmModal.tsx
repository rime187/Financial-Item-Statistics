import React, { useId } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { ModalDialog } from './ModalDialog';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  highlightText?: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  highlightText,
  confirmLabel,
  cancelLabel = '取消',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  const titleId = useId();
  const isDanger = variant === 'danger';

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onCancel}
      variant="modal"
      maxWidth="28rem"
      ariaLabelledBy={titleId}
      closedBy="any"
    >
      <div className="px-5 pt-5 pb-4 flex items-start gap-3.5">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isDanger
              ? 'bg-[#FEF2F2] text-[#EF4444]'
              : 'bg-[#FFFBEB] text-[#F59E0B]'
          }`}
        >
          {isDanger ? (
            <AlertTriangle className="w-5 h-5" aria-hidden="true" />
          ) : (
            <RotateCcw className="w-5 h-5" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h1 id={titleId} className="text-sm font-bold text-[#0F172A]">
            {title}
          </h1>
          <p className="text-xs text-[#64748B] mt-1.5 leading-relaxed">
            {description}
          </p>
          {highlightText && (
            <div className="mt-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-semibold text-[#0F172A] break-all">
              {highlightText}
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="关闭确认弹窗"
          onClick={onCancel}
          className="w-7 h-7 rounded-lg inline-flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="px-5 py-3.5 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2">
        <button
          type="button"
          autoFocus
          onClick={onCancel}
          className="px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-[#475569] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`px-4 py-2 rounded-lg text-white text-xs font-semibold transition-colors cursor-pointer ${
            isDanger
              ? 'bg-[#EF4444] hover:bg-[#DC2626]'
              : 'bg-[#2563EB] hover:bg-[#1D4ED8]'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </ModalDialog>
  );
};
