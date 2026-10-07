import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MessageSquare, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import ChatBox from './ChatBox';

interface MobileChatDrawerProps {
  channel?: 'global' | 'mafia' | 'dead';
}

export default function MobileChatDrawer({ channel = 'global' }: MobileChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isMounted) return null;

  const content = (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={clsx(
          "fixed bottom-6 right-6 z-40 p-4 rounded-full shadow-xl transition-all duration-300 lg:hidden hover:scale-110 active:scale-95",
          channel === 'mafia' ? "bg-red-600 text-white shadow-red-900/50" :
            channel === 'dead' ? "bg-surface text-ink shadow-black/40" :
              "bg-indigo-600 text-white shadow-indigo-900/50"
        )}
        aria-label="Open Chat"
      >
        <div className='flex gap-2'>
          <p>Discuss</p>
          <MessageSquare size={24} />
        </div>
        {/* Unread indicator could go here */}
      </button>

      {/* Drawer Overlay */}
      <div
        className={clsx(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-300 lg:hidden",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* Drawer Content */}
      <div
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-50 h-[85vh] bg-elevated border-t border-edge/50 rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out lg:hidden flex flex-col",
          isOpen ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Handle Bar */}
        <div
          className="w-full p-2 flex justify-center items-center cursor-pointer hover:bg-surface/50 rounded-t-2xl transition-colors"
          onClick={() => setIsOpen(false)}
        >
          <div className="w-12 h-1.5 bg-surface rounded-full mb-1" />
        </div>

        {/* Header */}
        <div className="px-4 pb-4 flex justify-between items-center border-b border-edge/50/50">
          <h3 className={clsx("font-bold text-lg flex items-center gap-2",
            channel === 'mafia' ? "text-red-500" :
              channel === 'dead' ? "text-ink-muted" :
                "text-indigo-400"
          )}>
            {channel === 'mafia' ? "Mafia Chat" :
              channel === 'dead' ? "Graveyard Whispers" :
                "Global Chat"}
          </h3>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-surface rounded-full transition-colors text-ink-muted hover:text-white"
          >
            <ChevronDown size={24} />
          </button>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden p-4 pt-0">
          <ChatBox channel={channel} className="h-full border-0 bg-transparent shadow-none" />
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
