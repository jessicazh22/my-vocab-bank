import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { PracticeSession, GrammarSession } from './grammar';

interface UsePracticeSessionReturn {
  sessions:        PracticeSession[];
  activeSession:   PracticeSession | null;
  loading:         boolean;
  startSession:    () => Promise<PracticeSession>;
  addRecording:    (transcript: string, durationSec: number) => Promise<GrammarSession>;
  removeRecording: (recordingId: string) => Promise<void>;
  endSession:      () => Promise<void>;
  discardSession:  () => void;
  deleteSession:   (sessionId: string) => Promise<void>;
}

type RawSession = {
  id: string;
  created_at: string;
  completed_at: string | null;
  grammar_sessions: Array<{
    id: string;
    transcript: string;
    duration_sec: number | null;
    word_count: number | null;
    analyzed_at: string | null;
    created_at: string;
    practice_session_id: string | null;
    sort_order: number;
  }> | null;
};

function toSession(raw: RawSession): PracticeSession {
  const recordings = (raw.grammar_sessions ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order) as GrammarSession[];
  return { id: raw.id, created_at: raw.created_at, completed_at: raw.completed_at, recordings };
}

function makeLocalRecording(
  transcript: string,
  durationSec: number,
  practiceSessionId: string,
  sortOrder: number,
): GrammarSession {
  return {
    id:                  crypto.randomUUID(),
    transcript,
    duration_sec:        durationSec,
    word_count:          transcript.trim().split(/\s+/).filter(Boolean).length,
    analyzed_at:         null,
    created_at:          new Date().toISOString(),
    practice_session_id: practiceSessionId,
    sort_order:          sortOrder,
  };
}

export function usePracticeSession(userId: string | null): UsePracticeSessionReturn {
  const [sessions, setSessions]           = useState<PracticeSession[]>([]);
  const [activeSession, setActiveSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading]             = useState(false);

  // ── Load completed sessions ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId) { setSessions([]); return; }
    setLoading(true);
    supabase
      .from('practice_sessions')
      .select(`
        id, created_at, completed_at,
        grammar_sessions (
          id, transcript, duration_sec, word_count, analyzed_at,
          created_at, practice_session_id, sort_order
        )
      `)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.warn('Sessions load error (migration may be pending):', error.message);
        else setSessions((data ?? []).map(r => toSession(r as RawSession)));
        setLoading(false);
      });
  }, [userId]);

  // ── startSession ─────────────────────────────────────────────────────────
  // Creates a LOCAL session immediately so the UI is never blocked waiting
  // for a DB round-trip. The DB record is created in the background; if it
  // fails (e.g. the migration hasn't been applied yet) the local session
  // keeps working — recordings will still be captured in component state.
  const startSession = useCallback(async (): Promise<PracticeSession> => {
    const local: PracticeSession = {
      id:           crypto.randomUUID(),
      created_at:   new Date().toISOString(),
      completed_at: null,
      recordings:   [],
    };
    setActiveSession(local);

    if (!userId) return local;

    // Fire-and-forget DB persist
    supabase
      .from('practice_sessions')
      .insert({ user_id: userId })
      .select('id, created_at, completed_at')
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.warn('Could not persist session to DB (migration pending?):', error.message);
          return;
        }
        if (data) {
          // Swap the local UUID for the real DB id so subsequent DB ops work
          setActiveSession(prev =>
            prev?.id === local.id
              ? { ...prev, id: data.id, created_at: data.created_at }
              : prev
          );
        }
      });

    return local;
  }, [userId]);

  // ── addRecording ──────────────────────────────────────────────────────────
  // Adds the recording to local state immediately, then persists to DB.
  const addRecording = useCallback(async (
    transcript: string,
    durationSec: number,
  ): Promise<GrammarSession> => {
    const sortOrder = activeSession?.recordings.length ?? 0;
    const sessionId = activeSession?.id ?? crypto.randomUUID();
    const local     = makeLocalRecording(transcript, durationSec, sessionId, sortOrder);

    // Optimistic update — visible immediately
    setActiveSession(prev => prev
      ? { ...prev, recordings: [...prev.recordings, local] }
      : null
    );

    if (!userId || !activeSession) return local;

    const { data, error } = await supabase
      .from('grammar_sessions')
      .insert({
        user_id:             userId,
        transcript,
        duration_sec:        durationSec,
        word_count:          local.word_count,
        practice_session_id: activeSession.id,
        sort_order:          sortOrder,
      })
      .select('id, transcript, duration_sec, word_count, analyzed_at, created_at, practice_session_id, sort_order')
      .single();

    if (error) {
      console.warn('Recording not saved to DB (migration pending?):', error.message);
      return local;
    }

    const saved = data as GrammarSession;
    // Replace local placeholder with the real DB row
    setActiveSession(prev => prev
      ? { ...prev, recordings: prev.recordings.map(r => r.id === local.id ? saved : r) }
      : null
    );
    return saved;
  }, [userId, activeSession]);

  // ── removeRecording ───────────────────────────────────────────────────────
  const removeRecording = useCallback(async (recordingId: string): Promise<void> => {
    setActiveSession(prev => prev
      ? { ...prev, recordings: prev.recordings.filter(r => r.id !== recordingId) }
      : null
    );
    const { error } = await supabase
      .from('grammar_sessions')
      .delete()
      .eq('id', recordingId);
    if (error) console.warn('Could not delete recording from DB:', error.message);
  }, []);

  // ── endSession ────────────────────────────────────────────────────────────
  const endSession = useCallback(async (): Promise<void> => {
    if (!activeSession) return;
    const completedAt = new Date().toISOString();
    const completed   = { ...activeSession, completed_at: completedAt };
    setSessions(prev => [completed, ...prev]);
    setActiveSession(null);

    if (!userId) return;

    const { error } = await supabase
      .from('practice_sessions')
      .update({ completed_at: completedAt })
      .eq('id', activeSession.id);
    if (error) console.warn('Could not persist session end to DB:', error.message);
  }, [userId, activeSession]);

  // ── discardSession ────────────────────────────────────────────────────────
  const discardSession = useCallback((): void => {
    const id = activeSession?.id;
    setActiveSession(null);
    if (!id || !userId) return;
    supabase.from('practice_sessions').delete().eq('id', id)
      .then(({ error }) => { if (error) console.warn('Could not discard session:', error.message); });
  }, [userId, activeSession]);

  // ── deleteSession ─────────────────────────────────────────────────────────
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    const { error } = await supabase
      .from('practice_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) console.warn('Could not delete session:', error.message);
  }, []);

  return { sessions, activeSession, loading, startSession, addRecording, removeRecording, endSession, discardSession, deleteSession };
}
