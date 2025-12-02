import React from 'react';

interface SettingsPanelProps {
  thinkingBudget: number;
  setThinkingBudget: (value: number) => void;
  isOpen: boolean;
  toggleOpen: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  thinkingBudget, 
  setThinkingBudget,
  isOpen,
  toggleOpen
}) => {
  return (
    <div className={`fixed inset-y-0 right-0 w-80 bg-slate-800 border-l border-slate-700 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="p-6 h-full flex flex-col">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-semibold text-white">Model Settings</h2>
          <button 
            onClick={toggleOpen}
            className="p-2 text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <label htmlFor="thinking-budget" className="text-sm font-medium text-slate-300">
              Thinking Budget
            </label>
            <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-cyan-400">
              {thinkingBudget} tokens
            </span>
          </div>
          <input
            id="thinking-budget"
            type="range"
            min="0"
            max="32768"
            step="1024"
            value={thinkingBudget}
            onChange={(e) => setThinkingBudget(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
          <p className="mt-2 text-xs text-slate-500">
            Allocates tokens for the model's internal reasoning process. Higher values allow for more complex problem solving. Set to 0 to disable thinking.
          </p>
        </div>

        <div className="mt-auto">
             <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400">
                    <span className="font-semibold text-cyan-400">Model:</span> gemini-3-pro-preview
                </p>
             </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;