// Shared inline diff utility — used by GrammarAnalysis and GrammarErrorSummary

export type DiffPart = { type: 'same' | 'del' | 'add'; text: string };

function lcsMatrix(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp;
}

function backtrackWords(
  dp: number[][], a: string[], b: string[],
): Array<{ type: 'same' | 'del' | 'add'; item: string }> {
  const ops: Array<{ type: 'same' | 'del' | 'add'; item: string }> = [];
  let i = a.length, j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.unshift({ type: 'same', item: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', item: b[j - 1] });
      j--;
    } else {
      ops.unshift({ type: 'del', item: a[i - 1] });
      i--;
    }
  }
  return ops;
}

function charDiff(oldStr: string, newStr: string): DiffPart[] {
  const a = oldStr.split('');
  const b = newStr.split('');
  const dp = lcsMatrix(a, b);
  const ops = backtrackWords(dp, a, b);
  const parts: DiffPart[] = [];
  for (const op of ops) {
    const last = parts[parts.length - 1];
    if (last && last.type === op.type) last.text += op.item;
    else parts.push({ type: op.type, text: op.item });
  }
  return parts;
}

function countTransitions(parts: DiffPart[]): number {
  let count = 0;
  for (let k = 1; k < parts.length; k++) {
    const prevSame = parts[k - 1].type === 'same';
    const currSame = parts[k].type === 'same';
    if (prevSame !== currSame) count++;
  }
  return count;
}

/**
 * Word-level diff with character-level refinement for clean substitutions.
 * e.g. "realise" → "realised"  shows realise[d]
 * e.g. "got"     → "have"      shows ~~got~~ have
 */
export function inlineDiff(original: string, corrected: string): DiffPart[] {
  const origWords = original.split(' ').filter(Boolean);
  const corrWords = corrected.split(' ').filter(Boolean);
  const dp = lcsMatrix(origWords, corrWords);
  const wordOps = backtrackWords(dp, origWords, corrWords);

  type GroupedOp =
    | { type: 'same' | 'del' | 'add'; word: string }
    | { type: 'sub'; old: string; new: string };

  const grouped: GroupedOp[] = [];
  for (let k = 0; k < wordOps.length; k++) {
    const op = wordOps[k];
    const next = wordOps[k + 1];
    if (op.type === 'del' && next?.type === 'add') {
      grouped.push({ type: 'sub', old: op.item, new: next.item });
      k++;
    } else {
      grouped.push({ type: op.type as 'same' | 'del' | 'add', word: op.item });
    }
  }

  const result: DiffPart[] = [];

  for (let k = 0; k < grouped.length; k++) {
    const g = grouped[k];
    if (k > 0) result.push({ type: 'same', text: ' ' });

    if (g.type === 'same') {
      result.push({ type: 'same', text: g.word });
    } else if (g.type === 'del') {
      result.push({ type: 'del', text: g.word });
    } else if (g.type === 'add') {
      result.push({ type: 'add', text: g.word });
    } else {
      const parts = charDiff(g.old, g.new);
      const sameLen = parts
        .filter(p => p.type === 'same')
        .reduce((n, p) => n + p.text.length, 0);
      const similarity = sameLen / Math.max(g.old.length, g.new.length);
      const transitions = countTransitions(parts);

      if (similarity > 0.6 && transitions <= 1) {
        result.push(...parts);
      } else {
        result.push({ type: 'del', text: g.old });
        result.push({ type: 'same', text: ' ' });
        result.push({ type: 'add', text: g.new });
      }
    }
  }

  return result;
}
