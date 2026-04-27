import { Mic } from 'lucide-react';

interface Props {
  userId: string | null;
  locale: 'en-AU' | 'en-US';
}

export default function GrammarModule({ userId, locale }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6">
      <div className="w-16 h-16 rounded-full bg-amber-900/30 border border-amber-800/40 flex items-center justify-center">
        <Mic size={28} className="text-amber-400" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-light text-zinc-100 mb-2">Grammar Coach</h2>
        <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
          Record yourself speaking and get personalised grammar coaching — coming soon.
        </p>
      </div>
      <button
        disabled
        className="flex items-center gap-2 px-6 py-3 bg-amber-900/30 text-amber-400/50 border border-amber-800/30 rounded-xl text-sm cursor-not-allowed"
      >
        <Mic size={16} />
        Start recording
      </button>
    </div>
  );
}
