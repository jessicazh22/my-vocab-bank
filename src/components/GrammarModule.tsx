import { Mic, CheckCircle2 } from 'lucide-react';

interface Props {
  userId: string | null;
  locale: 'en-AU' | 'en-US';
}

const FEATURES = [
  'Speak freely — no scripts, no prompts',
  'Errors flagged by category with plain-English explanations',
  'Style suggestions to sound more natural',
  'What you did well, always highlighted first',
];

export default function GrammarModule({ userId, locale }: Props) {
  return (
    <div className="max-w-lg mx-auto py-20 flex flex-col items-center gap-10">

      {/* Icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-2xl bg-amber-900/25 border border-amber-800/40 flex items-center justify-center">
          <Mic size={26} className="text-amber-400" />
        </div>
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500/30 border border-amber-500/50" />
      </div>

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl font-light text-zinc-100 mb-3">Grammar Coach</h2>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Record yourself speaking on any topic. Get personalised coaching on grammar errors, word choice, and what you're already doing well.
        </p>
      </div>

      {/* Feature list */}
      <ul className="w-full flex flex-col gap-2.5">
        {FEATURES.map(f => (
          <li key={f} className="flex items-start gap-3 text-sm text-zinc-400">
            <CheckCircle2 size={15} className="text-amber-500/70 mt-0.5 shrink-0" />
            {f}
          </li>
        ))}
      </ul>

      {/* CTA — disabled until recording is wired up */}
      <button
        disabled
        className="flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm
          bg-amber-900/20 text-amber-500/50 border border-amber-800/30
          cursor-not-allowed select-none"
      >
        <Mic size={15} />
        Start recording
        <span className="ml-1 text-[10px] text-amber-600/60 uppercase tracking-wider">Coming soon</span>
      </button>

    </div>
  );
}
