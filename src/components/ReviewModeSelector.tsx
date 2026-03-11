import { X, BookOpen, RefreshCw } from 'lucide-react';

interface ReviewModeSelectorProps {
  onSelectLearn: () => void;
  onSelectRevise: () => void;
  onClose: () => void;
  learnCount: number;
  reviseCount: number;
}

export default function ReviewModeSelector({
  onSelectLearn,
  onSelectRevise,
  onClose,
  learnCount,
  reviseCount,
}: ReviewModeSelectorProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-800 rounded-xl w-full max-w-md border border-zinc-700">
        <div className="flex items-center justify-between p-6 border-b border-zinc-700">
          <h2 className="text-xl font-light text-zinc-100">Choose Review Mode</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <button
            onClick={onSelectLearn}
            disabled={learnCount === 0}
            className="w-full p-5 bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 hover:border-zinc-600 rounded-xl transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                <BookOpen size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-100 font-medium">Learn</h3>
                  <span className="text-xs text-zinc-500">{learnCount} words</span>
                </div>
                <p className="text-zinc-500 text-sm mt-1 leading-relaxed">
                  Active recall. See word, reveal definition, write your own sentence.
                </p>
              </div>
            </div>
          </button>

          <button
            onClick={onSelectRevise}
            disabled={reviseCount === 0}
            className="w-full p-5 bg-zinc-900 hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed border border-zinc-700 hover:border-zinc-600 rounded-xl transition-all text-left group"
          >
            <div className="flex items-start gap-4">
              <div className="p-2.5 bg-teal-500/10 rounded-lg text-teal-400 group-hover:bg-teal-500/20 transition-colors">
                <RefreshCw size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-100 font-medium">Revise</h3>
                  <span className="text-xs text-zinc-500">{reviseCount} items</span>
                </div>
                <p className="text-zinc-500 text-sm mt-1 leading-relaxed">
                  Passive review. Browse sentences and "Need to Use" words at your own pace.
                </p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
