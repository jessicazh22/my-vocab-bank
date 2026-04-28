import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { PracticeSession, GrammarSession } from './grammar';

interface UsePracticeSessionReturn {
  sessions:        PracticeSession[];
  activeSession:   PracticeSession | null;
  loading:         boolean;
  startSession:    () => Promise<PracticeSession>;
  addRecording:    (transcript: string, durationSec: number, speaker?: string | null) => Promise<GrammarSession>;
  removeRecording: (recordingId: string) => Promise<void>;
  endSession:      () => Promise<void>;
  discardSession:  () => void;
  deleteSession:   (sessionId: string) => Promise<void>;
  updateRecording: (recordingId: string, transcript: string) => Promise<void>;
  renameSession:   (sessionId: string, name: string) => Promise<void>;
  saveSnippet:     (transcript: string, durationSec: number, speaker?: string | null) => Promise<GrammarSession>;
}

type RawSession = {
  id: string;
  created_at: string;
  completed_at: string | null;
  name: string | null;
  grammar_sessions: Array<{
    id: string;
    transcript: string;
    duration_sec: number | null;
    word_count: number | null;
    analyzed_at: string | null;
    created_at: string;
    practice_session_id: string | null;
    sort_order: number;
    speaker: string | null;
  }> | null;
};

function toSession(raw: RawSession): PracticeSession {
  const recordings = (raw.grammar_sessions ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order) as GrammarSession[];
  return {
    id:           raw.id,
    created_at:   raw.created_at,
    completed_at: raw.completed_at,
    name:         raw.name,
    recordings,
  };
}

function defaultSessionName(): string {
  return 'Lesson, ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function makeLocalRecording(
  transcript: string,
  durationSec: number,
  practiceSessionId: string,
  sortOrder: number,
  speaker: string | null = null,
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
    speaker,
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
        id, created_at, completed_at, name,
        grammar_sessions (
          id, transcript, duration_sec, word_count, analyzed_at,
          created_at, practice_session_id, sort_order, speaker
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
  // Awaits the DB insert so activeSession.id is the real DB uuid before any
  // recording is added — required because grammar_sessions.practice_session_id
  // has a FK constraint and will reject a local placeholder uuid.
  const startSession = useCallback(async (): Promise<PracticeSession> => {
    const name  = defaultSessionName();
    const local: PracticeSession = {
      id:           crypto.randomUUID(),
      created_at:   new Date().toISOString(),
      completed_at: null,
      name,
      recordings:   [],
    };
    setActiveSession(local);

    if (!userId) return local;

    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({ user_id: userId, name })
      .select('id, created_at, completed_at, name')
      .single();

    if (error) {
      console.warn('Could not persist session to DB:', error.message);
      return local;
    }

    const withDbId: PracticeSession = { ...local, id: data.id, created_at: data.created_at, name: data.name };
    setActiveSession(withDbId);
    return withDbId;
  }, [userId]);

  // ── addRecording ──────────────────────────────────────────────────────────
  const addRecording = useCallback(async (
    transcript: string,
    durationSec: number,
    speaker: string | null = null,
  ): Promise<GrammarSession> => {
    const sortOrder = activeSession?.recordings.length ?? 0;
    const sessionId = activeSession?.id ?? crypto.randomUUID();
    const local     = makeLocalRecording(transcript, durationSec, sessionId, sortOrder, speaker);

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
        speaker,
      })
      .select('id, transcript, duration_sec, word_count, analyzed_at, created_at, practice_session_id, sort_order, speaker')
      .single();

    if (error) {
      console.warn('Recording not saved to DB:', error.message);
      return local;
    }

    const saved = data as GrammarSession;
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

  // ── updateRecording ───────────────────────────────────────────────────────
  const updateRecording = useCallback(async (recordingId: string, transcript: string): Promise<void> => {
    const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).filter(Boolean).length : 0;
    setSessions(prev => prev.map(s => ({
      ...s,
      recordings: s.recordings.map(r =>
        r.id === recordingId ? { ...r, transcript, word_count: wordCount } : r
      ),
    })));
    // Also update in active session if present
    setActiveSession(prev => prev ? {
      ...prev,
      recordings: prev.recordings.map(r =>
        r.id === recordingId ? { ...r, transcript, word_count: wordCount } : r
      ),
    } : null);
    const { error } = await supabase
      .from('grammar_sessions')
      .update({ transcript, word_count: wordCount })
      .eq('id', recordingId);
    if (error) console.warn('Could not update recording:', error.message);
  }, []);

  // ── renameSession ─────────────────────────────────────────────────────────
  const renameSession = useCallback(async (sessionId: string, name: string): Promise<void> => {
    setActiveSession(prev => prev?.id === sessionId ? { ...prev, name } : prev);
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, name } : s));
    const { error } = await supabase
      .from('practice_sessions')
      .update({ name })
      .eq('id', sessionId);
    if (error) console.warn('Could not rename session:', error.message);
  }, []);

  // ── saveSnippet ───────────────────────────────────────────────────────────
  // If a named session is active, add the snippet to it.
  // Otherwise: create a new one-off session, insert recording, mark complete.
  const saveSnippet = useCallback(async (
    transcript: string,
    durationSec: number,
    speaker: string | null = null,
  ): Promise<GrammarSession> => {
    // Route into active session if one exists
    if (activeSession) {
      return addRecording(transcript, durationSec, speaker);
    }

    const wordCount   = transcript.trim() ? transcript.trim().split(/\s+/).filter(Boolean).length : 0;
    const completedAt = new Date().toISOString();

    // Optimistic local record
    const localRec: GrammarSession = {
      id:                  crypto.randomUUID(),
      transcript,
      duration_sec:        durationSec,
      word_count:          wordCount,
      analyzed_at:         null,
      created_at:          new Date().toISOString(),
      practice_session_id: null,
      sort_order:          0,
      speaker,
    };
    const localSession: PracticeSession = {
      id:           crypto.randomUUID(),
      created_at:   localRec.created_at,
      completed_at: completedAt,
      name:         null,
      recordings:   [localRec],
    };
    setSessions(prev => [localSession, ...prev]);

    if (!userId) return localRec;

    // 1. Create session (no name for standalone snippets)
    const { data: sd, error: se } = await supabase
      .from('practice_sessions')
      .insert({ user_id: userId })
      .select('id, created_at')
      .single();
    if (se) { console.warn('saveSnippet: session insert failed:', se.message); return localRec; }

    // 2. Create recording
    const { data: rd, error: re } = await supabase
      .from('grammar_sessions')
      .insert({
        user_id:             userId,
        transcript,
        duration_sec:        durationSec,
        word_count:          wordCount,
        practice_session_id: sd.id,
        sort_order:          0,
        speaker,
      })
      .select('id, transcript, duration_sec, word_count, analyzed_at, created_at, practice_session_id, sort_order, speaker')
      .single();
    if (re) { console.warn('saveSnippet: recording insert failed:', re.message); return localRec; }

    // 3. Mark session complete
    await supabase.from('practice_sessions').update({ completed_at: completedAt }).eq('id', sd.id);

    const saved = rd as GrammarSession;
    setSessions(prev => prev.map(s =>
      s.id === localSession.id
        ? { id: sd.id, created_at: sd.created_at, completed_at: completedAt, name: null, recordings: [saved] }
        : s
    ));
    return saved;
  }, [userId, activeSession, addRecording]);

  return {
    sessions, activeSession, loading,
    startSession, addRecording, removeRecording,
    endSession, discardSession, deleteSession,
    updateRecording, renameSession, saveSnippet,
  };
}
