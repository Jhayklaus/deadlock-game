import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { clsx } from 'clsx';
import { Send, Lock, Ghost, MessageSquare, Mic } from 'lucide-react';

interface ChatBoxProps {
  channel?: 'global' | 'mafia' | 'dead';
  className?: string;
}

export default function ChatBox({ channel = 'global', className }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const myId = useGameStore(state => state.myId);
  const typingPlayers = useGameStore(state => state.typingPlayers);
  const players = useGameStore(state => state.players);
  
  const messages = useGameStore(state => state.messages.filter(m => {
    // Handle Whispers
    if (m.recipientId) {
       // Only show relevant whispers in Global Chat
       if (channel !== 'global') return false;
       
       // Show if I sent it OR if I received it
       return m.senderId === myId || m.recipientId === myId;
    }

    if (m.isSystem) return true;
    if (channel === 'mafia') return m.channel === 'mafia';
    if (channel === 'dead') return m.channel === 'dead';
    return !m.channel || m.channel === 'global';
  }));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    // Check for whisper command: /w Name Message
    if (channel === 'global' && input.startsWith('/w ')) {
        const parts = input.split(' ');
        if (parts.length >= 3) {
            const targetName = parts[1];
            const content = parts.slice(2).join(' ');
            
            // Find player by name
            const players = useGameStore.getState().players;
            const targetPlayer = Object.values(players).find(p => p.name.toLowerCase() === targetName.toLowerCase());
            
            if (targetPlayer) {
                networkManager.sendWhisper(targetPlayer.id, content);
            }
        }
    } else {
        networkManager.sendChatMessage(input.trim(), channel);
    }
    setInput('');
  };

  const isMafiaChat = channel === 'mafia';
  const isDeadChat = channel === 'dead';

  return (
    <div className={clsx("flex flex-col h-[400px] w-full max-w-md bg-slate-900 rounded-xl border shadow-xl overflow-hidden transition-all", 
      isMafiaChat ? "border-red-900/50 shadow-red-900/20" : isDeadChat ? "border-purple-900/50 shadow-purple-900/20" : "border-slate-800 shadow-black/50",
      className
    )}>
      <div className={clsx("p-4 border-b flex justify-between items-center", 
        isMafiaChat ? "bg-red-950/50 border-red-900/50" : isDeadChat ? "bg-purple-950/50 border-purple-900/50" : "bg-slate-950 border-slate-800"
      )}>
        <h3 className={clsx("font-bold text-sm uppercase tracking-wider flex items-center gap-2", isMafiaChat ? "text-red-400" : isDeadChat ? "text-purple-400" : "text-slate-400")}>
          {isMafiaChat ? <Lock size={16} /> : isDeadChat ? <Ghost size={16} /> : <MessageSquare size={16} />}
          {isMafiaChat ? "Mafia Channel" : isDeadChat ? "Dead Chat" : "Town Discussion"}
        </h3>
        {isMafiaChat && <span className="text-[10px] bg-red-900/50 text-red-200 px-2 py-0.5 rounded border border-red-800 font-bold tracking-wider">SECRET</span>}
        {isDeadChat && <span className="text-[10px] bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded border border-purple-800 font-bold tracking-wider">SPIRITS</span>}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/30 custom-scrollbar">
        {messages.map((msg) => {
          const isMe = msg.senderId === myId;
          const isSystem = msg.isSystem;
          const isWhisper = !!msg.recipientId;
          
          if (isSystem) {
            return (
              <div key={msg.id} className="flex items-center justify-center gap-2 my-2 opacity-60">
                <div className="h-px w-8 bg-slate-700"></div>
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{msg.content}</span>
                <div className="h-px w-8 bg-slate-700"></div>
              </div>
            );
          }

          if (isWhisper) {
              const players = useGameStore.getState().players;
              const senderName = isMe ? 'You' : players[msg.senderId]?.name || 'Unknown';
              const recipientName = msg.recipientId === myId ? 'You' : players[msg.recipientId!]?.name || 'Unknown';
              
              return (
                  <div key={msg.id} className="flex flex-col items-center my-2 w-full">
                      <div className="bg-slate-900/80 border border-slate-700/50 rounded-lg px-4 py-2 text-xs text-slate-400 flex items-center gap-2">
                          <Mic size={12} className="text-slate-500" />
                          <span>
                            <span className="font-bold text-slate-300">{senderName}</span> whispered to <span className="font-bold text-slate-300">{recipientName}</span>:
                            <span className="ml-1 text-slate-200 italic">"{msg.content}"</span>
                          </span>
                      </div>
                  </div>
              );
          }

          return (
            <div 
              key={msg.id} 
              className={clsx(
                "flex flex-col max-w-[85%]",
                isMe ? "self-end items-end" : "self-start items-start"
              )}
            >
              <span className="text-[10px] text-slate-500 mb-1 px-1 font-bold uppercase tracking-wider">
                {isMe ? 'You' : msg.senderName}
              </span>
              <div className={clsx(
                "px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm",
                isMe 
                  ? (isMafiaChat ? "bg-red-600 text-white rounded-tr-sm" : isDeadChat ? "bg-purple-600 text-white rounded-tr-sm" : "bg-blue-600 text-white rounded-tr-sm")
                  : (isMafiaChat ? "bg-red-950/80 text-red-100 border border-red-900/50 rounded-tl-sm" : isDeadChat ? "bg-purple-950/80 text-purple-100 border border-purple-900/50 rounded-tl-sm" : "bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-sm")
              )}>
                {msg.content}
              </div>
            </div>
          );
        })}
        
        {/* Typing Indicator */}
        {channel === 'global' && Object.entries(typingPlayers || {}).map(([id, isTyping]) => {
            if (!isTyping || !players[id]) return null;
            return (
               <div key={`typing-${id}`} className="flex items-center gap-2 text-[10px] text-slate-500 italic animate-pulse px-4 mb-2">
                 <div className="flex gap-1">
                   <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                   <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                   <span className="w-1 h-1 bg-slate-500 rounded-full animate-bounce"></span>
                 </div>
                 {players[id].name} is typing...
               </div>
            );
        })}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={clsx("p-3 border-t flex gap-2",
        isMafiaChat ? "bg-red-950/30 border-red-900/50" : isDeadChat ? "bg-purple-950/30 border-purple-900/50" : "bg-slate-900 border-slate-800"
      )}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isMafiaChat ? "Whisper to partners..." : isDeadChat ? "Speak from beyond..." : "Type a message..."}
          className={clsx("flex-1 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all bg-opacity-50",
            isMafiaChat 
              ? "bg-red-900/20 border border-red-900/30 text-red-100 placeholder-red-400/50 focus:ring-red-900/50 focus:bg-red-900/30"
              : isDeadChat
                ? "bg-purple-900/20 border border-purple-900/30 text-purple-100 placeholder-purple-400/50 focus:ring-purple-900/50 focus:bg-purple-900/30"
                : "bg-slate-800 border-slate-700 text-white placeholder-slate-500 focus:ring-blue-900/50 focus:bg-slate-800/80"
          )}
        />
        <button 
          type="submit" 
          disabled={!input.trim()}
          className={clsx("p-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            isMafiaChat 
              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20"
              : isDeadChat
                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20"
                : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
          )}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}