import { useCallback } from 'react';
import { supabase } from './supabase';

export function useGrammarRatings(userId: string | null) {
  const rateCard = useCallback(async (
    errorId: string,
    patternName: string,
    remembered: boolean,
  ) => {
    if (!userId) return;
    await supabase.from('grammar_practice_ratings').insert({
      user_id: userId,
      error_id: errorId,
      pattern_name: patternName,
      remembered,
    });
  }, [userId]);

  return { rateCard };
}
