import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { clsx } from 'clsx';

interface ChatBoxProps {
  channel?: 'global' | 'mafia' | 'dead';
  className?: string;
}

export default function ChatBox({ channel = 'global', className }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const myId = useGameStore(state => state.myId);
  
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
                if (targetPlayer.isAlive) {
                   networkManager.sendWhisper(targetPlayer.id, content);
                } else {
                   // Cannot whisper to dead?
                   // Usually allowed if Medium, but let's restrict for now.
                   // Actually, system message "Player is dead" is better.
                   // For now, just send it, let network/logic handle or fail silently?
                   // Better to give feedback.
                   // We'll just send it.
                   networkManager.sendWhisper(targetPlayer.id, content);
                }
            } else {
                // Player not found
                // Add local system message?
                // For MVP, just ignore or maybe log console
                console.warn('Player not found:', targetName);
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
    <div className={clsx("flex flex-col h-[400px] w-full max-w-md bg-slate-900 rounded-lg border shadow-xl overflow-hidden", 
      isMafiaChat ? "border-red-900 shadow-red-900/20" : isDeadChat ? "border-purple-900 shadow-purple-900/20" : "border-slate-700",
      className
    )}>
      <div className={clsx("p-3 border-b flex justify-between items-center", 
        isMafiaChat ? "bg-red-950 border-red-900" : isDeadChat ? "bg-purple-950 border-purple-900" : "bg-slate-800 border-slate-700"
      )}>
        <h3 className={clsx("font-semibold", isMafiaChat ? "text-red-200" : isDeadChat ? "text-purple-200" : "text-slate-200")}>
          {isMafiaChat ? "Mafia Private Channel" : isDeadChat ? "Dead Chat 👻" : "Town Discussion"}
        </h3>
        {isMafiaChat && <span className="text-xs bg-red-900 text-red-200 px-2 py-0.5 rounded border border-red-800">SECRET</span>}
        {isDeadChat && <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded border border-purple-800">SPIRITS</span>}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/50">
        {messages.map((msg) => {
          const isMe = msg.senderId === myId;
          const isSystem = msg.isSystem;
          const isWhisper = !!msg.recipientId;
          
          if (isSystem) {
            return (
              <div key={msg.id} className="text-center text-xs text-slate-500 my-2 italic">
                {msg.content}
              </div>
            );
          }

          if (isWhisper) {
              const players = useGameStore.getState().players;
              const senderName = isMe ? 'You' : players[msg.senderId]?.name || 'Unknown';
              const recipientName = msg.recipientId === myId ? 'You' : players[msg.recipientId!]?.name || 'Unknown';
              
              return (
                  <div key={msg.id} className="flex flex-col items-center my-1 w-full">
                      <div className="bg-slate-900/80 border border-slate-700 rounded px-3 py-1 text-sm italic text-slate-400">
                          <span className="font-bold text-slate-500">{senderName}</span>
                          <span className="mx-1 text-slate-600">whispered to</span>
                          <span className="font-bold text-slate-500">{recipientName}</span>:
                          <span className="ml-2 text-slate-300">{msg.content}</span>
                      </div>
                  </div>
              );
          }

          return (
            <div 
              key={msg.id} 
              className={clsx(
                "flex flex-col max-w-[80%]",
                isMe ? "self-end items-end" : "self-start items-start"
              )}
            >
              <span className="text-xs text-slate-400 mb-1 px-1">
                {isMe ? 'You' : msg.senderName}
              </span>
              <div className={clsx(
                "px-3 py-2 rounded-lg text-sm break-words shadow-sm",
                isMe 
                  ? (isMafiaChat ? "bg-red-900 text-red-100 border border-red-800" : isDeadChat ? "bg-purple-900 text-purple-100 border border-purple-800" : "bg-slate-200 text-slate-900 rounded-tr-none font-medium")
                  : (isMafiaChat ? "bg-red-950/50 text-red-200 border border-red-900" : isDeadChat ? "bg-purple-950/50 text-purple-200 border border-purple-900" : "bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700")
              )}>
                {msg.content}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={clsx("p-3 border-t flex gap-2",
        isMafiaChat ? "bg-red-950 border-red-900" : isDeadChat ? "bg-purple-950 border-purple-900" : "bg-slate-800 border-slate-700"
      )}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isMafiaChat ? "Whisper to partners..." : isDeadChat ? "Speak from beyond..." : "Type a message..."}
          className={clsx("flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1",
            isMafiaChat 
              ? "bg-red-900/50 border-red-800 text-red-100 placeholder-red-400 focus:ring-red-700"
              : isDeadChat
                ? "bg-purple-900/50 border-purple-800 text-purple-100 placeholder-purple-400 focus:ring-purple-700"
                : "bg-slate-700 border-slate-600 text-white placeholder-slate-400 focus:ring-slate-500"
          )}
        />
        <button 
          type="submit" 
          disabled={!input.trim()}
          className={clsx("px-4 py-2 rounded text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed",
            isMafiaChat 
              ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50"
              : isDeadChat
                ? "bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50"
                : "bg-amber-500 hover:bg-amber-400 text-slate-900 shadow-lg shadow-amber-500/20"
          )}
        >
          Send
        </button>
      </form>
    </div>
  );
}