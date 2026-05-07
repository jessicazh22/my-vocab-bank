import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Collocation = {
  phrase: string;
  note?: string;
};

export type CollocationsData = {
  pairs: Collocation[];
  summary?: string;
};

export type VocabularyWord = {
  id: string;
  user_id: string;
  word: string;
  definition: string;
  example_sentence?: string;
  context?: string;
  usage_hint?: string;
  source_tag?: string;
  sentence_starters?: string[];
  scaffold_prompt?: string;
  category: 'KNOW_WELL' | 'LEARNING' | 'JUST_ADDED';
  word_type: 'word' | 'phrase' | 'sentence';
  familiarity: 'NEED_TO_LEARN' | 'NEED_TO_USE';
  added_date: string;
  practice_count: number;
  last_practiced?: string;
  user_sentences: string[];
  is_public: boolean;
  is_archived: boolean;
  collocations?: CollocationsData;
  distinction?: string;
  next_review_at?: string;
  usefulness: 1 | 2 | 3 | 4;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type WordChat = {
  id: string;
  word_id: string;
  user_id: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
};

export async function callEdgeFunction<T = unknown>(name: string, payload: unknown): Promise<T> {
  const res = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || (data && typeof data === 'object' && 'error' in data)) {
    throw new Error(data?.error ?? `Edge function ${name} failed (${res.status})`);
  }
  return data as T;
}
