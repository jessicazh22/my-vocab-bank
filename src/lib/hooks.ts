import { useEffect, useState, useCallback } from 'react';
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
  'user_sentences', 'added_date', 'is_public', 'is_archived',
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
  const savingRef = { current: new Set<string>() };

  const fetchWords = async () => {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('*')
      .order('added_date', { ascending: false });

    if (!error && data) {
      // Merge: don't overwrite words that are currently being saved
      setWords(prev => {
        if (savingRef.current.size === 0) return data;
        return data.map(fetchedWord => {
          if (savingRef.current.has(fetchedWord.id)) {
            // Keep the optimistic local version while save is in flight
            const localVersion = prev.find(w => w.id === fetchedWord.id);
            return localVersion || fetchedWord;
          }
          return fetchedWord;
        });
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

    return () => {
      supabase.removeChannel(channel);
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
    await supabase.from('vocabulary').delete().eq('id', id);
  };

  const archiveWord = async (id: string) => {
    await updateWord(id, { is_archived: true });
  };

  const practiceWord = async (id: string, userSentence: string) => {
    const word = words.find((w) => w.id === id);
    if (!word) return;

    const newPracticeCount = word.practice_count + 1;
    const newUserSentences = [...word.user_sentences, userSentence];

    let newCategory = word.category;
    if (word.category === 'LEARNING' && newPracticeCount >= 3) {
      newCategory = 'KNOW_WELL';
    }

    await updateWord(id, {
      practice_count: newPracticeCount,
      last_practiced: new Date().toISOString(),
      user_sentences: newUserSentences,
      category: newCategory,
    });
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
    practiceWord,
    bulkImport,
    checkDuplicate,
  };
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
