import { Loader2 } from 'lucide-react';

interface ScaffoldPromptProps {
  loading: boolean;
  text?: string | null;
  fallback?: string;                         // shown when !loading && !text
  loadingLabel?: string;                     // defaults to "Generating a prompt..."
}

export default function ScaffoldPrompt({
  loading,
  text,
  fallback,
  loadingLabel = 'Generating a prompt...',
}: ScaffoldPromptProps) {
  if (!loading && !text && !fallback) return null;

  return (
    <div className="p-4 bg-amber-900/10 border border-amber-800/20 rounded-lg">
      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin text-amber-400" />
          <p className="text-amber-200/60 text-sm">{loadingLabel}</p>
        </div>
      ) : (
        <p className="text-amber-200/80 text-sm leading-relaxed">
          {text ?? fallback}
        </p>
      )}
    </div>
  );
}
