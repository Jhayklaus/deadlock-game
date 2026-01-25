import { useState } from 'react';
import { networkManager } from '../lib/network';
import { clsx } from 'clsx';

export default function LastWillEditor() {
  const [content, setContent] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  const handleSave = () => {
    networkManager.sendLastWillUpdate(content);
    setIsSaved(true);
    setTimeout(() => setIsSaved(true), 2000); // Keep saved state
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsSaved(false);
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transition"
        >
          <span className="text-xl">📜</span>
          <span className="font-bold text-sm uppercase tracking-wider">Last Will</span>
        </button>
      )}

      {isOpen && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-4 w-80 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <span>📜</span> Last Will & Testament
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-slate-300 transition"
            >
              ✕
            </button>
          </div>
          
          <textarea
            value={content}
            onChange={handleChange}
            placeholder="Write your final words here... (Revealed upon death)"
            className="w-full h-32 bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-300 text-sm focus:outline-none focus:border-slate-600 resize-none mb-3 font-serif italic"
          />
          
          <div className="flex justify-between items-center">
            <span className={clsx("text-xs transition-opacity", isSaved ? "text-green-500 opacity-100" : "opacity-0")}>
              Saved ✓
            </span>
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={clsx(
                "px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition",
                isSaved 
                  ? "bg-slate-800 text-slate-500 cursor-default" 
                  : "bg-slate-700 hover:bg-slate-600 text-white"
              )}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
