import { useState, useRef, useEffect } from 'react';
import { Loader2, Send, Sparkles, MessageCircle } from 'lucide-react';
import { ChatMessage, callEdgeFunction } from '../lib/supabase';
import { useWordChat } from '../lib/hooks';

interface ChatPanelProps {
  wordId: string;
  word: string;
  definition?: string;
  accent?: 'amber' | 'teal' | 'violet';
  label?: string;
}

const ACCENT_STYLES = {
  amber: {
    bubble: 'bg-amber-900/20 border-amber-800/30',
    text: 'text-amber-300/90',
    spinner: 'text-amber-400',
    hover: 'hover:text-amber-400',
  },
  violet: {
    bubble: 'bg-violet-900/20 border-violet-800/30',
    text: 'text-violet-300/90',
    spinner: 'text-violet-400',
    hover: 'hover:text-violet-400',
  },
  teal: {
    bubble: 'bg-teal-900/20 border-teal-800/50',
    text: 'text-teal-300/90',
    spinner: 'text-teal-400',
    hover: 'hover:text-teal-400',
  },
};

export default function ChatPanel({
  wordId,
  word,
  definition,
  accent = 'amber',
  label = 'Ask AI about this word',
}: ChatPanelProps) {
  const { chatHistory, saveChat, loading: chatLoading } = useWordChat(wordId);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const styles = ACCENT_STYLES[accent];

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMessage = input.trim();
    setInput('');
    const newHistory: ChatMessage[] = [...chatHistory, { role: 'user', content: userMessage }];
    await saveChat(newHistory);
    setAiLoading(true);
    try {
      const data = await callEdgeFunction<{ answer?: string; error?: string }>('ask-vocabulary', {
        word,
        definition,
        question: userMessage,
        history: chatHistory,
      });
      const reply = data.answer ?? (data.error ? `Error: ${data.error}` : 'Unable to get a response. Try again later.');
      await saveChat([...newHistory, { role: 'assistant', content: reply }]);
    } catch {
      await saveChat([...newHistory, { role: 'assistant', content: 'Unable to get a response. Try again later.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  if (chatLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={18} className="animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 text-zinc-400 mb-3">
        <MessageCircle size={14} />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>

      {chatHistory.length > 0 && (
        <div ref={containerRef} className="max-h-48 overflow-y-auto space-y-2 mb-3">
          {chatHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg text-sm border ${
                msg.role === 'user'
                  ? 'bg-zinc-700/50 border-zinc-600 ml-6'
                  : `${styles.bubble} mr-6`
              }`}
            >
              <p className={`leading-relaxed ${msg.role === 'user' ? 'text-zinc-200' : styles.text}`}>
                {msg.content}
              </p>
            </div>
          ))}
          {aiLoading && (
            <div className={`${styles.bubble} border mr-6 p-2.5 rounded-lg`}>
              <Loader2 size={14} className={`animate-spin ${styles.spinner}`} />
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={chatHistory.length > 0 ? 'Follow up...' : 'How would I use this naturally?'}
          rows={1}
          className="w-full px-4 py-2.5 bg-zinc-800 text-zinc-100 rounded-lg border border-zinc-700 focus:outline-none focus:border-amber-600/50 pr-10 text-sm resize-none overflow-hidden"
          style={{ minHeight: '42px' }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || aiLoading}
          className={`absolute right-2 top-3 p-1.5 text-zinc-500 ${styles.hover} transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {chatHistory.length > 0 ? <Send size={16} /> : <Sparkles size={16} />}
        </button>
      </div>
    </div>
  );
}
