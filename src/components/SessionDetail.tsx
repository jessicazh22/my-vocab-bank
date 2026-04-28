import { ArrowLeft } from 'lucide-react';
import type { PracticeSession } from '../lib/grammar';
import { RecordingFeed, formatDuration } from './RecordingFeed';

interface Props {
  session: PracticeSession;
  userId: string | null;
  onBack: () => void;
  onUpdateRecording: (recordingId: string, transcript: string) => Promise<void>;
}

export default function SessionDetail({ session, userId, onBack, onUpdateRecording }: Props) {
  const totalWords    = session.recordings.reduce((n, r) => n + (r.word_count   ?? 0), 0);
  const totalDuration = session.recordings.reduce((n, r) => n + (r.duration_sec ?? 0), 0);

  const date = new Date(session.completed_at ?? session.created_at).toLocaleDateString(
    undefined, { day: 'numeric', month: 'long', year: 'numeric' },
  );

  // Feed expects recordings newest-first
  const recordings = [...session.recordings].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <div className="flex flex-col gap-6">

      {/* Nav row */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft size={14} />
          Sessions
        </button>
      </div>

      {/* Session meta */}
      <div className="max-w-2xl mx-auto w-full">
        <p className="text-base font-medium text-zinc-100">{date}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}
          {totalWords    > 0 && <> · {totalWords} words</>}
          {totalDuration > 0 && <> · {formatDuration(totalDuration)}</>}
        </p>
      </div>

      {/* Recordings in feed style */}
      <RecordingFeed
        recordings={recordings}
        loading={false}
        userId={userId}
        onSave={onUpdateRecording}
      />

    </div>
  );
}
