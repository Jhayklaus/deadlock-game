import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../lib/store';
import { networkManager } from '../lib/network';
import { clsx } from 'clsx';
import { Send, Lock, Ghost, MessageSquare, Mic } from 'lucide-react';

interface ChatBoxProps {
  channel?: 'global' | 'mafia' | 'dead';
  className?: string;
}

/**
 * Per-channel styling.
 *
 * The global channel follows the active mode's accent, so chat belongs to
 * whichever game you are in. The private channels keep fixed colours, because
 * "this is the Mafia channel" has to read the same everywhere.
 */
const CHANNELS = {
  global: {
    title: 'Town Discussion',
    icon: MessageSquare,
    tag: null as string | null,
    header: 'bg-base/40 border-edge/50',
    accent: 'text-ink-muted',
    mine: 'bg-accent text-base',
    theirs: 'bg-surface text-ink border border-edge/50',
    placeholder: 'Type a message…',
    send: 'bg-accent text-base hover:brightness-110',
  },
  mafia: {
    title: 'Mafia Channel',
    icon: Lock,
    tag: 'Secret',
    header: 'bg-danger/10 border-danger/30',
    accent: 'text-danger',
    mine: 'bg-danger text-white',
    theirs: 'bg-danger/10 text-ink border border-danger/25',
    placeholder: 'Whisper to your partners…',
    send: 'bg-danger text-white hover:brightness-110',
  },
  dead: {
    title: 'Dead Chat',
    icon: Ghost,
    tag: 'Spirits',
    header: '',
    accent: 'text-violet-300',
    mine: ' text-white',
    theirs: ' text-ink border',
    placeholder: 'Speak from beyond…',
    send: ' text-white hover:brightness-110',
  },
} as const;

export default function ChatBox({ channel = 'global', className }: ChatBoxProps) {
  const [input, setInput] = useState('');
  const myId = useGameStore(state => state.myId);
  const typingPlayers = useGameStore(state => state.typingPlayers);
  const players = useGameStore(state => state.players);

  const messages = useGameStore(state => state.messages.filter(m => {
    if (m.recipientId) {
      // Whispers only surface in the global channel, and only to the people in them.
      if (channel !== 'global') return false;
      return m.senderId === myId || m.recipientId === myId;
    }
    if (m.isSystem) return true;
    if (channel === 'mafia') return m.channel === 'mafia';
    if (channel === 'dead') return m.channel === 'dead';
    return !m.channel || m.channel === 'global';
  }));

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    // `/w Name message` sends a private whisper.
    if (channel === 'global' && text.startsWith('/w ')) {
      const parts = text.split(' ');
      if (parts.length >= 3) {
        const targetName = parts[1];
        const content = parts.slice(2).join(' ');
        const target = Object.values(useGameStore.getState().players).find(
          p => p.name.toLowerCase() === targetName.toLowerCase()
        );
        if (target) networkManager.sendWhisper(target.id, content);
      }
    } else {
      networkManager.sendChatMessage(text, channel);
    }
    setInput('');
  };

  const cfg = CHANNELS[channel];
  const Icon = cfg.icon;
  const typing = Object.entries(typingPlayers || {})
    .filter(([id, isTyping]) => isTyping && players[id])
    .map(([id]) => players[id].name);

  return (
    <div
      className={clsx(
        'flex flex-col h-[400px] w-full max-w-md rounded-2xl overflow-hidden',
        'bg-elevated/70 backdrop-blur-xl border border-edge/60 edge-light shadow-lg',
        className
      )}
    >
      <header className={clsx('px-4 py-3 border-b flex justify-between items-center shrink-0', cfg.header)}>
        <h3 className={clsx('text-xs font-semibold uppercase tracking-[0.16em] flex items-center gap-2', cfg.accent)}>
          <Icon size={14} />
          {cfg.title}
        </h3>
        {cfg.tag && (
          <span className={clsx(
            'text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-[0.14em]',
            channel === 'mafia'
              ? 'bg-danger/15 text-danger border-danger/30'
              : 'bg-violet-500/15 text-violet-300 border-violet-500/30'
          )}>
            {cfg.tag}
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-base/30">
        {messages.length === 0 && (
          <p className="m-auto text-xs text-ink-muted/70">Nothing said yet.</p>
        )}

        {messages.map(msg => {
          const isMe = msg.senderId === myId;

          if (msg.isSystem) {
            return (
              <div key={msg.id} className="flex items-center gap-3 my-0.5">
                <div className="h-px flex-1 bg-edge/50" />
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted text-center max-w-[70%]">
                  {msg.content}
                </span>
                <div className="h-px flex-1 bg-edge/50" />
              </div>
            );
          }

          if (msg.recipientId) {
            const senderName = isMe ? 'You' : players[msg.senderId]?.name || 'Unknown';
            const recipientName = msg.recipientId === myId ? 'you' : players[msg.recipientId]?.name || 'Unknown';
            return (
              <div key={msg.id} className="self-center max-w-[92%]">
                <div className="rounded-xl px-3.5 py-2 bg-base/60 border border-edge/50 text-xs text-ink-muted flex items-start gap-2">
                  <Mic size={12} className="mt-0.5 shrink-0" />
                  <span>
                    <span className="font-semibold text-ink">{senderName}</span> whispered to{' '}
                    <span className="font-semibold text-ink">{recipientName}</span>:{' '}
                    <span className="text-ink italic">&ldquo;{msg.content}&rdquo;</span>
                  </span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={clsx(
                'flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-1 duration-200',
                isMe ? 'self-end items-end' : 'self-start items-start'
              )}
            >
              <span className="text-[10px] text-ink-muted mb-1 px-1 font-semibold uppercase tracking-[0.12em]">
                {isMe ? 'You' : msg.senderName}
              </span>
              <div
                className={clsx(
                  'px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words',
                  isMe ? `${cfg.mine} rounded-br-sm` : `${cfg.theirs} rounded-bl-sm`
                )}
              >
                {msg.content}
              </div>
            </div>
          );
        })}

        {channel === 'global' && typing.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-ink-muted px-1">
            <span className="flex gap-1">
              <span className="w-1 h-1 rounded-full bg-ink-muted animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1 h-1 rounded-full bg-ink-muted animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1 h-1 rounded-full bg-ink-muted animate-bounce" />
            </span>
            {typing.length === 1 ? `${typing[0]} is typing…` : `${typing.length} people are typing…`}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-edge/50 flex gap-2 shrink-0 bg-elevated/60">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={cfg.placeholder}
          aria-label={`Message ${cfg.title}`}
          className="flex-1 rounded-xl px-3.5 py-2.5 text-sm bg-base/60 border border-edge/60 text-ink
            placeholder:text-ink-muted/60 transition-all
            focus:outline-none focus:ring-2 focus:ring-accent/35 focus:border-accent/60"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          aria-label="Send"
          className={clsx(
            'w-10 h-10 shrink-0 grid place-items-center rounded-xl transition-all active:scale-95',
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:saturate-50',
            cfg.send
          )}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
