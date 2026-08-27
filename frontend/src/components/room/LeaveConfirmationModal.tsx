'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { LogOut, AlertTriangle } from 'lucide-react';

interface LeaveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function LeaveConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading = false,
}: LeaveConfirmationModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Leave Room?" maxWidth="sm">
      <div className="space-y-5 text-left">
        <div className="flex items-start gap-3.5 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-200">
              Are you sure you want to leave this room?
            </p>
            <p className="text-xs text-rose-300/80 leading-relaxed">
              You will be removed as an active participant from the lobby. If the auction is live, the draft will proceed.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="text-slate-300 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onConfirm}
            isLoading={isLoading}
            className="bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-900/30"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Leave Room
          </Button>
        </div>
      </div>
    </Modal>
  );
}
