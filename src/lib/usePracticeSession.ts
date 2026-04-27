import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { PracticeSession, GrammarSession } from './grammar';

interface UsePracticeSessionReturn {
  /** Completed sessions, newest first */
  sessions: PracticeSession[];
  /** The currently-open session (null when idle) */
  activeSession: PracticeSession | null;
  loading: boolean;
  startSession:    () => Promise<PracticeSession | null>;
  addRecording:    (transcript: string, durationSec: number) => Promise<GrammarSession | null>;
  removeRecording: (recordingId: string) => Promise<void>;
  endSession:      () => Promise<void>;
  discardSession:  () => Promise<void>;
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

export function usePracticeSession(userId: string | null): UsePracticeSessionReturn {
  const [sessions, setSessions]           = useState<PracticeSession[]>([]);
  const [activeSession, setActiveSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading]             = useState(false);

  // Load completed sessions
  useEffect(() => {
    if (!userId) { setSessions([]); return; }
    setLoading(true);
    supabase
      .from('practice_sessions')
      .select(`
        id, created_at, completed_at,
        grammar_sessions ( id, transcript, duration_sec, word_count, analyzed_at, created_at, practice_session_id, sort_order )
      `)
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error('Error loading sessions:', error);
        else setSessions((data ?? []).map(r => toSession(r as RawSession)));
        setLoading(false);
      });
  }, [userId]);

  // ── startSession ─────────────────────────────────────────────────────────────
  const startSession = useCallback(async (): Promise<PracticeSession | null> => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('practice_sessions')
      .insert({ user_id: userId })
      .select('id, created_at, completed_at')
      .single();
    if (error) { console.error('Error starting session:', error); return null; }
    const session: PracticeSession = { ...(data as { id: string; created_at: string; completed_at: string | null }), recordings: [] };
    setActiveSession(session);
    return session;
  }, [userId]);

  // ── addRecording ─────────────────────────────────────────────────────────────
  const addRecording = useCallback(async (
    transcript: string,
    durationSec: number,
  ): Promise<GrammarSession | null> => {
    if (!userId || !activeSession) return null;
    const wordCount  = transcript.trim().split(/\s+/).filter(Boolean).length;
    const sortOrder  = activeSession.recordings.length;
    const { data, error } = await supabase
      .from('grammar_sessions')
      .insert({
        user_id:             userId,
        transcript,
        duration_sec:        durationSec,
        word_count:          wordCount,
        practice_session_id: activeSession.id,
        sort_order:          sortOrder,
      })
      .select('id, transcript, duration_sec, word_count, analyzed_at, created_at, practice_session_id, sort_order')
      .single();
    if (error) { console.error('Error saving recording:', error); return null; }
    const recording = data as GrammarSession;
    setActiveSession(prev => prev
      ? { ...prev, recordings: [...prev.recordings, recording] }
      : null);
    return recording;
  }, [userId, activeSession]);

  // ── removeRecording ───────────────────────────────────────────────────────────
  const removeRecording = useCallback(async (recordingId: string): Promise<void> => {
    // Optimistic
    setActiveSession(prev => prev
      ? { ...prev, recordings: prev.recordings.filter(r => r.id !== recordingId) }
      : null);
    const { error } = await supabase
      .from('grammar_sessions')
      .delete()
      .eq('id', recordingId);
    if (error) console.error('Error removing recording:', error);
  }, []);

  // ── endSession ────────────────────────────────────────────────────────────────
  const endSession = useCallback(async (): Promise<void> => {
    if (!userId || !activeSession) return;
    const completedAt = new Date().toISOString();
    const { error } = await supabase
      .from('practice_sessions')
      .update({ completed_at: completedAt })
      .eq('id', activeSession.id);
    if (error) { console.error('Error ending session:', error); return; }
    setSessions(prev => [{ ...activeSession, completed_at: completedAt }, ...prev]);
    setActiveSession(null);
  }, [userId, activeSession]);

  // ── discardSession ────────────────────────────────────────────────────────────
  const discardSession = useCallback(async (): Promise<void> => {
    if (!activeSession) return;
    setActiveSession(null);
    const { error } = await supabase
      .from('practice_sessions')
      .delete()
      .eq('id', activeSession.id);
    if (error) console.error('Error discarding session:', error);
  }, [activeSession]);

  // ── deleteSession ─────────────────────────────────────────────────────────────
  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    setSessions(prev => prev.filter(s => s.id !== sessionId)); // optimistic
    const { error } = await supabase
      .from('practice_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) {
      console.error('Error deleting session:', error);
      // Rollback: re-fetch
      supabase
        .from('practice_sessions')
        .select('id, created_at, completed_at, grammar_sessions ( id, transcript, duration_sec, word_count, analyzed_at, created_at, practice_session_id, sort_order )')
        .eq('id', sessionId)
        .single()
        .then(({ data }) => {
          if (data) setSessions(prev =>
            [toSession(data as RawSession), ...prev]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          );
        });
    }
  }, []);

  return { sessions, activeSession, loading, startSession, addRecording, removeRecording, endSession, discardSession, deleteSession };
}
