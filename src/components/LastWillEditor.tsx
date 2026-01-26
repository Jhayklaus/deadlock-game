import { useState } from 'react';
import { networkManager } from '../lib/network';
import { clsx } from 'clsx';
import { Scroll, X, Save, Check } from 'lucide-react';

export default function LastWillEditor() {
  const [content, setContent] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  const handleSave = () => {
    networkManager.updateLastWill(content);
    setIsSaved(true);
    setTimeout(() => setIsSaved(true), 2000); // Keep saved state
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setIsSaved(false);
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all hover:scale-105"
        >
          <Scroll size={20} className="text-amber-500" />
          <span className="font-bold text-sm uppercase tracking-wider">Last Will</span>
        </button>
      )}

      {isOpen && (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-5 w-80 sm:w-96 animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm uppercase tracking-wider">
              <Scroll size={16} className="text-amber-500" /> Last Will
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-500 hover:text-white transition p-1 hover:bg-slate-800 rounded-lg"
            >
              <X size={16} />
            </button>
          </div>
          
          <textarea
            value={content}
            onChange={handleChange}
            placeholder="Write your final words here... (Revealed upon death)"
            className="w-full h-40 bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 text-sm focus:outline-none focus:border-slate-600 resize-none mb-4 font-serif italic leading-relaxed"
          />
          
          <div className="flex justify-between items-center">
            <span className={clsx("text-xs transition-all flex items-center gap-1.5 font-bold", isSaved ? "text-green-500 opacity-100" : "opacity-0")}>
              <Check size={12} /> Saved
            </span>
            <button
              onClick={handleSave}
              disabled={isSaved}
              className={clsx(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                isSaved 
                  ? "bg-slate-800 text-slate-500 cursor-default" 
                  : "bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20"
              )}
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
