import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, VocabularyWord, ChatMessage } from './supabase';
import { User } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, loading, signIn, signUp, signOut };
}

function cleanWordText(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/\*\*/g, '');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/^[-•]\s*/, '');
  cleaned = cleaned.replace(/^\d+\.\s*/, '');
  return cleaned.trim();
}

function detectWordType(text: string): 'word' | 'phrase' | 'sentence' {
  const spaceCount = (text.match(/\s+/g) || []).length;
  if (spaceCount >= 4 || text.length > 35) {
    return 'sentence';
  }
  if (text.includes(' ')) {
    return 'phrase';
  }
  return 'word';
}

// Fields that are safe to send to Supabase update
const DB_UPDATE_FIELDS = new Set([
  'word', 'definition', 'example_sentence', 'context', 'usage_hint',
  'source_tag', 'sentence_starters', 'scaffold_prompt', 'category',
  'word_type', 'familiarity', 'practice_count', 'last_practiced',
  'user_sentences', 'added_date', 'is_public', 'is_archived', 'is_conversational',
  'collocations',
  'distinction',
  'next_review_at',
  'usefulness',
]);

function sanitizeUpdates(updates: Partial<VocabularyWord>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (DB_UPDATE_FIELDS.has(key)) {
      clean[key] = value;
    }
  }
  return clean;
}

export function useVocabulary() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);
  // Track in-flight saves to prevent real-time subscription from overwriting
  const savingRef = useRef(new Set<string>());
  // Track archived IDs for the entire session — survives fetchWords re-fetches
  // This prevents race conditions where DB propagation lag reverts archive state
  const sessionArchivedIds = useRef(new Set<string>());

  const fetchWords = async () => {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('*, distinction, collocations')
      .order('added_date', { ascending: false });

    if (!error && data) {
      setWords(prev => {
        // Merge: don't overwrite words that are currently being saved
        let result: VocabularyWord[];
        if (savingRef.current.size === 0) {
          result = data;
        } else {
          result = data.map(fetchedWord => {
            if (savingRef.current.has(fetchedWord.id)) {
              // Keep the optimistic local version while save is in flight
              const localVersion = prev.find(w => w.id === fetchedWord.id);
              return localVersion || fetchedWord;
            }
            return fetchedWord;
          });
        }

        // Apply session-level archive mask — prevents DB propagation lag
        // from reverting archive state on subsequent fetchWords calls
        if (sessionArchivedIds.current.size === 0) return result;
        return result.map(w =>
          sessionArchivedIds.current.has(w.id) ? { ...w, is_archived: true } : w
        );
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWords();

    const channel = supabase
      .channel('vocabulary-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vocabulary' }, () => {
        fetchWords();
      })
      .subscribe();

    // Re-fetch when auth state changes (login/logout) so RLS-filtered
    // words update immediately without requiring a manual refresh
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(() => {
      fetchWords();
    });

    return () => {
      supabase.removeChannel(channel);
      authSubscription.unsubscribe();
    };
  }, []);

  const checkDuplicate = async (word: string): Promise<VocabularyWord | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const cleanedWord = cleanWordText(word).toLowerCase();
    const { data } = await supabase
      .from('vocabulary')
      .select('*')
      .eq('user_id', user.id)
      .ilike('word', cleanedWord)
      .maybeSingle();

    return data;
  };

  const addWord = async (
    word: string,
    definition: string,
    options?: {
      exampleSentence?: string;
      context?: string;
      usageHint?: string;
      sourceTag?: string;
      scaffoldPrompt?: string;
      wordType?: 'word' | 'phrase' | 'sentence';
      collocations?: import('./supabase').CollocationsData;
      distinction?: string;
    }
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cleanedWord = options?.wordType === 'sentence' ? word.trim() : cleanWordText(word);
    const wordType = options?.wordType || detectWordType(cleanedWord);

    const { data: newWord, error } = await supabase.from('vocabulary').insert({
      user_id: user.id,
      word: cleanedWord,
      definition,
      example_sentence: options?.exampleSentence,
      context: options?.context,
      usage_hint: options?.usageHint,
      source_tag: options?.sourceTag,
      scaffold_prompt: options?.scaffoldPrompt,
      collocations: options?.collocations,
      distinction: options?.distinction,
      category: 'LEARNING',
      word_type: wordType,
    }).select().single();

    if (error) {
      console.error('Failed to add word:', error);
    } else if (newWord) {
      // Immediately prepend to state — don't wait for real-time subscription
      setWords(prev => [newWord, ...prev]);
    }
  };

  const updateWord = async (id: string, updates: Partial<VocabularyWord>) => {
    // Optimistic update
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );

    // Mark as saving so real-time subscription doesn't overwrite
    savingRef.current.add(id);

    const cleanUpdates = sanitizeUpdates(updates);
    const { error } = await supabase
      .from('vocabulary')
      .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
      .eq('id', id);

    // Clear saving flag after a short delay to let real-time catch up
    setTimeout(() => {
      savingRef.current.delete(id);
    }, 2000);

    if (error) {
      console.error('Failed to save word update:', error);
      // Revert optimistic update on failure
      fetchWords();
    }
  };

  const deleteWord = async (id: string) => {
    setWords((prev) => prev.filter((w) => w.id !== id));
    await supabase.from('vocabulary').delete().eq('id', id);
  };

  const archiveWord = async (id: string) => {
    sessionArchivedIds.current.add(id);
    await updateWord(id, { is_archived: true });
  };

  const unarchiveWord = async (id: string) => {
    sessionArchivedIds.current.delete(id);
    await updateWord(id, { is_archived: false });
  };

  const bulkArchiveWords = async (ids: string[]) => {
    if (ids.length === 0) return;
    ids.forEach(id => sessionArchivedIds.current.add(id));
    setWords(prev => prev.map(w => ids.includes(w.id) ? { ...w, is_archived: true } : w));
    ids.forEach(id => savingRef.current.add(id));
    await supabase.from('vocabulary').update({ is_archived: true, updated_at: new Date().toISOString() }).in('id', ids);
    setTimeout(() => ids.forEach(id => savingRef.current.delete(id)), 2000);
  };

  const BASE_DAYS: Record<string, number> = { again: 1, hard: 3, good: 7, easy: 21 };
  const USEFULNESS_MULT: Record<number, number> = { 1: 1.5, 2: 1.0, 3: 0.7, 4: 2.5 };

  const computeNextReviewAt = (rating: string, usefulness: number): string => {
    const days = BASE_DAYS[rating] * (USEFULNESS_MULT[usefulness] ?? 1.0);
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    return d.toISOString();
  };

  const practiceWord = async (
    id: string,
    userSentence: string,
    rating?: 'again' | 'hard' | 'good' | 'easy',
    usefulness?: 1 | 2 | 3 | 4,
  ) => {
    const word = words.find((w) => w.id === id);
    if (!word) return;

    const newPracticeCount = userSentence ? word.practice_count + 1 : word.practice_count;
    const newUserSentences = userSentence
      ? [...word.user_sentences, userSentence]
      : word.user_sentences;

    let newCategory = word.category;
    if (word.category === 'LEARNING' && newPracticeCount >= 3) {
      newCategory = 'KNOW_WELL';
    }

    const updates: Partial<VocabularyWord> = {
      practice_count: newPracticeCount,
      last_practiced: new Date().toISOString(),
      user_sentences: newUserSentences,
      category: newCategory,
      scaffold_prompt: null,
    };

    if (rating) {
      const effectiveUsefulness = usefulness ?? word.usefulness ?? 2;
      updates.next_review_at = computeNextReviewAt(rating, effectiveUsefulness);
    }
    if (usefulness !== undefined) {
      updates.usefulness = usefulness;
    }

    await updateWord(id, updates);
  };

  const setReviewDate = async (id: string, next_review_at: string | null) => {
    await updateWord(id, { next_review_at: next_review_at ?? undefined });
  };

  const bulkImport = async (entries: Array<{ word: string; definition: string }>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const vocabItems = entries.map(entry => {
      const cleanedWord = cleanWordText(entry.word);
      return {
        user_id: user.id,
        word: cleanedWord,
        definition: entry.definition,
        category: 'LEARNING',
        word_type: detectWordType(cleanedWord),
      };
    });

    await supabase.from('vocabulary').insert(vocabItems);
  };

  return {
    words,
    loading,
    addWord,
    updateWord,
    deleteWord,
    archiveWord,
    unarchiveWord,
    bulkArchiveWords,
    practiceWord,
    setReviewDate,
    computeNextReviewAt,
    bulkImport,
    checkDuplicate,
  };
}

export function useLocale() {
  const [locale, setLocaleState] = useState<'en-US' | 'en-AU'>(() => {
    return (localStorage.getItem('english-locale') as 'en-US' | 'en-AU') || 'en-AU';
  });

  const setLocale = (loc: 'en-US' | 'en-AU') => {
    localStorage.setItem('english-locale', loc);
    setLocaleState(loc);
  };

  return { locale, setLocale };
}

export function useWordChat(wordId: string | null) {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadChat = useCallback(async () => {
    if (!wordId) {
      setChatHistory([]);
      setChatId(null);
      return;
    }

    setLoading(true);
    const { data } = await supabase
      .from('word_chats')
      .select('*')
      .eq('word_id', wordId)
      .maybeSingle();

    if (data) {
      setChatHistory(data.messages || []);
      setChatId(data.id);
    } else {
      setChatHistory([]);
      setChatId(null);
    }
    setLoading(false);
  }, [wordId]);

  useEffect(() => {
    loadChat();
  }, [loadChat]);

  const saveChat = useCallback(async (messages: ChatMessage[]) => {
    if (!wordId) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setChatHistory(messages);

    if (chatId) {
      await supabase
        .from('word_chats')
        .update({ messages, updated_at: new Date().toISOString() })
        .eq('id', chatId);
    } else {
      const { data } = await supabase
        .from('word_chats')
        .insert({ word_id: wordId, user_id: user.id, messages })
        .select('id')
        .single();
      if (data) {
        setChatId(data.id);
      }
    }
  }, [wordId, chatId]);

  const clearChat = useCallback(() => {
    setChatHistory([]);
    setChatId(null);
  }, []);

  return { chatHistory, loading, saveChat, clearChat };
}
