import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';
import type { GrammarSession } from './grammar';

interface UseGrammarSessionReturn {
  sessions: GrammarSession[];
  loading: boolean;
  saveSession: (transcript: string, durationSec: number) => Promise<GrammarSession | null>;
  deleteSession: (sessionId: string) => Promise<void>;
}

export function useGrammarSession(userId: string | null): UseGrammarSessionReturn {
  const [sessions, setSessions] = useState<GrammarSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) { setSessions([]); return; }
    setLoading(true);
    supabase
      .from('grammar_sessions')
      .select('id, transcript, duration_sec, word_count, analyzed_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) console.error('Error loading grammar sessions:', error);
        else setSessions((data ?? []) as GrammarSession[]);
        setLoading(false);
      });
  }, [userId]);

  const saveSession = useCallback(async (
    transcript: string,
    durationSec: number,
  ): Promise<GrammarSession | null> => {
    if (!userId) return null;
    const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;
    const { data, error } = await supabase
      .from('grammar_sessions')
      .insert({ user_id: userId, transcript, duration_sec: durationSec, word_count: wordCount })
      .select('id, transcript, duration_sec, word_count, analyzed_at, created_at')
      .single();
    if (error) { console.error('Error saving session:', error); return null; }
    const session = data as GrammarSession;
    setSessions(prev => [session, ...prev]);
    return session;
  }, [userId]);

  const deleteSession = useCallback(async (sessionId: string) => {
    // Optimistic update
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    const { error } = await supabase
      .from('grammar_sessions')
      .delete()
      .eq('id', sessionId);
    if (error) {
      console.error('Error deleting session:', error);
      // Roll back on failure
      supabase
        .from('grammar_sessions')
        .select('id, transcript, duration_sec, word_count, analyzed_at, created_at')
        .eq('id', sessionId)
        .single()
        .then(({ data }) => {
          if (data) setSessions(prev => [data as GrammarSession, ...prev].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ));
        });
    }
  }, []);

  return { sessions, loading, saveSession, deleteSession };
}
