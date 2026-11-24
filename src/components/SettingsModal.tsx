import React, { useState, useEffect } from 'react';
import { X, Sliders, Cpu, ShieldAlert, Sparkles, Check } from 'lucide-react';
import { UserSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
  onClearAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSave,
  onClearAllData
}) => {
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(settings);
      setShowClearConfirm(false);
      setSavedToast(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Settings</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure MUSTAFA AI behavior & preferences</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              Gemini Model
            </label>
            <select
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Recommended - Ultra Fast)</option>
              <option value="gemini-4-hydrogen">Gemini 4 Hydrogen (Smart & Balanced)</option>
            </select>
          </div>

          {/* Temperature */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Response Style ({formData.temperature})
              </label>
              <span className="text-xs text-zinc-500">
                {formData.temperature < 0.4 ? 'Precise' : formData.temperature > 0.8 ? 'Creative' : 'Balanced'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600 dark:accent-indigo-500 cursor-pointer"
            />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>0.0 (Strict)</span>
              <span>1.0 (Creative)</span>
            </div>
          </div>

          {/* System Instruction */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              System Instruction / Persona
            </label>
            <textarea
              rows={3}
              value={formData.systemInstruction}
              onChange={(e) => setFormData({ ...formData, systemInstruction: e.target.value })}
              placeholder="e.g. You are Mustafa, an expert, professional, and friendly AI assistant..."
              className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-300 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Data Management */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Data Management</h3>
            {showClearConfirm ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl space-y-3 animate-fadeIn">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-medium">
                  <ShieldAlert className="w-4 h-4" />
                  Are you sure you want to delete all chats?
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearAllData();
                      setShowClearConfirm(false);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Yes, Delete All
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 bg-zinc-200 dark:bg-zinc-700 hover:bg-zinc-300 dark:hover:bg-zinc-600 text-zinc-800 dark:text-zinc-200 text-xs font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 text-sm font-medium rounded-xl border border-red-200 dark:border-red-900/50 transition-colors w-full text-left flex items-center justify-between"
              >
                <span>Clear All Chat History</span>
                <span className="text-xs text-zinc-400">LocalStorage</span>
              </button>
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-sm font-medium rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              {savedToast ? (
                <>
                  <Check className="w-4 h-4 animate-bounce" />
                  Saved!
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
