import { useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { PracticeSession } from '../lib/grammar';
import { RecordingFeed, formatDuration } from './RecordingFeed';

interface Props {
  session: PracticeSession;
  userId: string | null;
  onBack: () => void;
  onUpdateRecording: (recordingId: string, transcript: string) => Promise<void>;
  onRename: (name: string) => void;
}

export default function SessionDetail({ session, userId, onBack, onUpdateRecording, onRename }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);

  const totalWords    = session.recordings.reduce((n, r) => n + (r.word_count   ?? 0), 0);
  const totalDuration = session.recordings.reduce((n, r) => n + (r.duration_sec ?? 0), 0);

  const displayName = session.name
    || new Date(session.completed_at ?? session.created_at).toLocaleDateString(undefined, {
         day: 'numeric', month: 'long', year: 'numeric',
       });

  const handleNameBlur = () => {
    const val = nameRef.current?.value.trim() ?? '';
    if (val && val !== session.name) onRename(val);
  };

  // Sort recordings newest-first for the feed
  const recordings = [...session.recordings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">

      {/* Nav row */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        <ArrowLeft size={14} />
        Sessions
      </button>

      {/* Session header */}
      <div className="flex flex-col gap-1.5">
        <input
          ref={nameRef}
          defaultValue={session.name ?? ''}
          placeholder={displayName}
          onBlur={handleNameBlur}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.blur(); }
            if (e.key === 'Escape') { if (nameRef.current) nameRef.current.value = session.name ?? ''; nameRef.current?.blur(); }
          }}
          className="text-base font-medium text-zinc-100 bg-transparent outline-none
            border-b border-transparent hover:border-zinc-700 focus:border-zinc-500
            transition-colors w-full placeholder:text-zinc-400"
        />
        <p className="text-xs text-zinc-500">
          {session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}
          {totalWords    > 0 && <> · {totalWords} words</>}
          {totalDuration > 0 && <> · {formatDuration(totalDuration)}</>}
        </p>
      </div>

      {/* Recordings feed */}
      <RecordingFeed
        recordings={recordings}
        loading={false}
        userId={userId}
        onSave={onUpdateRecording}
        emptyMessage="No recordings in this session."
      />

    </div>
  );
}
