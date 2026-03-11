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

export function useVocabulary() {
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWords = async () => {
    const { data, error } = await supabase
      .from('vocabulary')
      .select('*')
      .order('added_date', { ascending: false });

    if (!error && data) {
      setWords(data);
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
    exampleSentence?: string,
    context?: string,
    usageHint?: string,
    sourceTag?: string,
    scaffoldPrompt?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const cleanedWord = cleanWordText(word);
    const wordType = detectWordType(cleanedWord);

    await supabase.from('vocabulary').insert({
      user_id: user.id,
      word: cleanedWord,
      definition,
      example_sentence: exampleSentence,
      context,
      usage_hint: usageHint,
      source_tag: sourceTag,
      scaffold_prompt: scaffoldPrompt,
      category: 'JUST_ADDED',
      word_type: wordType,
    });
  };

  const updateWord = async (id: string, updates: Partial<VocabularyWord>) => {
    setWords((prev) =>
      prev.map((w) => (w.id === id ? { ...w, ...updates } : w))
    );
    await supabase
      .from('vocabulary')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
  };

  const deleteWord = async (id: string) => {
    await supabase.from('vocabulary').delete().eq('id', id);
  };

  const practiceWord = async (id: string, userSentence: string) => {
    const word = words.find((w) => w.id === id);
    if (!word) return;

    const newPracticeCount = word.practice_count + 1;
    const newUserSentences = [...word.user_sentences, userSentence];

    let newCategory = word.category;
    if (word.category === 'JUST_ADDED' && newPracticeCount >= 1) {
      newCategory = 'LEARNING';
    } else if (word.category === 'LEARNING' && newPracticeCount >= 3) {
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
