import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
