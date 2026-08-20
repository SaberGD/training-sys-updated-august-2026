
import React, { useState, useEffect } from 'react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  entityName: string;
  entityType: string;
  isProcessing?: boolean;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  onCancel,
  onConfirm,
  entityName,
  entityType,
  isProcessing = false
}) => {
  const [input, setInput] = useState('');

  useEffect(() => {
    if (isOpen) setInput('');
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmedInput = input.trim().toLowerCase();
  const trimmedTarget = entityName.trim().toLowerCase();
  const isMatch = trimmedInput === trimmedTarget;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200 md:pl-72">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 bg-red-50/50">
          <h3 className="text-xl font-bold text-red-800 tracking-tight">Confirm Deletion</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-sm text-amber-800 font-semibold leading-relaxed">
              ⚠️ You are about to delete <strong>{entityType}</strong>: <span className="underline">{entityName}</span>. 
              This action is permanent and cannot be undone.
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-700">
              Type the exact name to confirm:
            </label>
            <input
              type="text"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isProcessing}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-200 focus:ring-2 focus:ring-red-500 outline-none transition-all font-mono text-sm"
              placeholder={entityName}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isProcessing}
              className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors border border-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!isMatch || isProcessing}
              className={`flex-1 py-3 text-white font-black rounded-xl shadow-lg transition-all ${
                isMatch && !isProcessing 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20 active:scale-95' 
                  : 'bg-slate-200 shadow-none cursor-not-allowed text-slate-400'
              }`}
            >
              {isProcessing ? 'Processing...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
