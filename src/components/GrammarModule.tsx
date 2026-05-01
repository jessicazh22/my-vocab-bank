import { useState, useEffect, useMemo } from 'react';
import { Mic, Clock, X, Zap } from 'lucide-react';
import { useTranscription } from '../lib/useTranscription';
import { usePracticeSession } from '../lib/usePracticeSession';
import TranscriptPanel from './TranscriptPanel';
import SessionDetail from './SessionDetail';
import GrammarAnalysis from './GrammarAnalysis';
import GrammarErrorSummary from './GrammarErrorSummary';
import PracticeDrill from './PracticeDrill';
import { RecordingFeed, relativeTime, formatDuration } from './RecordingFeed';
import { GLORIA_SESSIONS } from '../data/gloriaData';
import type { AnalyzedSession, GrammarErrorData } from '../data/gloriaData';
import { CATEGORY_COLORS } from '../lib/grammar';
import type { GrammarErrorCategory, GrammarSession, PracticeSession } from '../lib/grammar';

interface Props {
  userId: string | null;
  locale: 'en-AU' | 'en-US';
  view: 'coach' | 'sessions' | 'transcripts';
  onSessionEnded: () => void;
}

// ── Learning plan helpers ─────────────────────────────────────────────────────
const LP_HIGH_IMPACT = new Set<GrammarErrorCategory>([
  'tense_consistency', 'subject_verb_agreement', 'modal_verb_pattern',
  'verb_form', 'verb_missing', 'verb_redundancy', 'irregular_verb_form',
  'phrasal_verb_errors', 'demonstrative_agreement', 'verb_pattern',
]);

const LP_STYLE = new Set<GrammarErrorCategory>([
  'vague_reference', 'parallel_structure', 'word_choice',
  'sentence_structure', 'word_order', 'conjunction_misuse', 'redundant_words',
]);

const STUDENT_LABELS: Record<GrammarErrorCategory, string> = {
  tense_consistency:       'Past tense',
  subject_verb_agreement:  'Subject + verb',
  modal_verb_pattern:      'Might / could + base verb',
  article_misuse:          'The / a / an',
  demonstrative_agreement: 'This / these',
  singular_plural:         'Singular / plural',
  uncountable_noun:        'Uncountable noun',
  redundant_words:         'Extra word',
  verb_pattern:            '-ing form',
  verb_form:               'Verb ending',
  verb_choice:             'Wrong verb',
  verb_missing:            "Gonna needs 'are / is'",
  verb_redundancy:         'Extra verb',
  irregular_verb_form:     'Irregular verb',
  comparative_form:        'Comparing',
  preposition_errors:      'Preposition (on / in / at)',
  phrasal_verb_errors:     'Phrasal verb',
  conjunction_misuse:      'Connecting words',
  conjunction_missing:     'Missing connector',
  parallel_structure:      'Parallel structure',
  sentence_structure:      'Sentence structure',
  word_order:              'Word order',
  pronoun_form:            'Pronoun',
  subjunctive_errors:      'If it were',
  word_form:               'Word form',
  word_choice:             'Word choice',
  vague_reference:         'Too vague',
};

interface PlanItem {
  key: string;
  tag: string;
  rule: string;
  badgeClasses: string;
  isHighImpact: boolean;
  isStyle: boolean;
  errorCount: number;
  sessionCount: number;
  practiceError: GrammarErrorData | null;
  practiceSession: AnalyzedSession | null;
}

function buildLearningPlan(analyzedSessions: AnalyzedSession[]): {
  high: PlanItem[]; medium: PlanItem[]; style: PlanItem[];
} {
  type Tagged = GrammarErrorData & { _session: AnalyzedSession };
  const tagged: Tagged[] = analyzedSessions.flatMap(s =>
    s.errors.map(e => ({ ...e, _session: s }))
  );

  const map = new Map<string, { meta: Omit<PlanItem, 'errorCount' | 'sessionCount' | 'practiceError' | 'practiceSession'>; errors: Tagged[]; sessionIds: Set<string> }>();

  for (const err of tagged) {
    const key = err.grammar_pattern?.name ?? STUDENT_LABELS[err.category];
    const isStyle = LP_STYLE.has(err.category);
    const isHighImpact = LP_HIGH_IMPACT.has(err.category) && !isStyle;
    if (map.has(key)) {
      const entry = map.get(key)!;
      entry.errors.push(err);
      entry.sessionIds.add(err._session.id);
    } else {
      map.set(key, {
        meta: { key, tag: key, rule: err.grammar_pattern?.structure ?? '', badgeClasses: CATEGORY_COLORS[err.category], isHighImpact, isStyle },
        errors: [err],
        sessionIds: new Set([err._session.id]),
      });
    }
  }

  const items: PlanItem[] = Array.from(map.values()).map(({ meta, errors, sessionIds }) => {
    // Pick the error with the most practice_sentences (most substantial drill)
    const withPractice = errors.reduce((best, e) => {
      const bestCount = best?.practice_sentences?.length ?? 0;
      const eCount = e.practice_sentences?.length ?? 0;
      return eCount > bestCount ? e : best;
    }, null as GrammarErrorData | null);
    return { ...meta, errorCount: errors.length, sessionCount: sessionIds.size, practiceError: withPractice, practiceSession: withPractice?._session ?? null };
  });

  const byCount = (a: PlanItem, b: PlanItem) => b.errorCount - a.errorCount;
  return {
    high:   items.filter(p => p.isHighImpact).sort(byCount),
    medium: items.filter(p => !p.isHighImpact && !p.isStyle).sort(byCount),
    style:  items.filter(p => p.isStyle),
  };
}

function PlanRow({ item, onPractice, muted = false }: {
  item: PlanItem;
  onPractice: (sessionId: string, errorId: string) => void;
  muted?: boolean;
}) {
  return (
    <div className="py-3.5 flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {!muted ? (
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${item.badgeClasses}`}>
              {item.tag}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-400 font-medium">{item.tag}</span>
          )}
          <span className="text-[11px] text-zinc-600">
            {item.errorCount} error{item.errorCount !== 1 ? 's' : ''}
          </span>
          {item.sessionCount > 1 && (
            <span className="text-[11px] text-amber-500/80 font-medium">· appeared again</span>
          )}
        </div>
        {item.practiceError && item.practiceSession && (
          <button
            onClick={() => onPractice(item.practiceSession!.id, item.practiceError!.id)}
            className="shrink-0 flex items-center gap-1 text-xs text-zinc-500 hover:text-amber-300 transition-colors"
          >
            <Zap size={11} />
            Practice
          </button>
        )}
      </div>
      {item.rule && (
        <p className="text-[11px] text-zinc-500 leading-relaxed">{item.rule}</p>
      )}
    </div>
  );
}

// ── Sessions list (view = 'sessions') ─────────────────────────────────────────
function CompletedSessionRow({
  session, onDelete, onSelect,
}: {
  session: PracticeSession;
  onDelete: () => void;
  onSelect: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const totalWords    = session.recordings.reduce((n, r) => n + (r.word_count   ?? 0), 0);
  const totalDuration = session.recordings.reduce((n, r) => n + (r.duration_sec ?? 0), 0);
  const first         = session.recordings[0];
  const preview       = first?.transcript.slice(0, 160).trimEnd() ?? '';
  const truncated     = (first?.transcript.length ?? 0) > 160;

  return (
    <div
      className="group flex flex-col gap-2.5 px-4 py-4 rounded-xl bg-zinc-800/40 border border-zinc-700/50 hover:border-zinc-600/60 transition-colors cursor-pointer"
      onClick={e => { if ((e.target as HTMLElement).closest('button')) return; onSelect(); }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1.5">
            <Clock size={11} />
            {relativeTime(session.completed_at ?? session.created_at)}
          </span>
          <span className="text-zinc-600">
            {session.recordings.length} recording{session.recordings.length !== 1 ? 's' : ''}
          </span>
          {totalWords    > 0 && <span className="text-zinc-600">{totalWords} words</span>}
          {totalDuration > 0 && <span className="text-zinc-600">{formatDuration(totalDuration)}</span>}
        </div>
        {confirming ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-zinc-500">Delete?</span>
            <button onClick={onDelete} className="text-xs text-rose-400 hover:text-rose-300 transition-colors font-medium">Yes</button>
            <button onClick={() => setConfirming(false)} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors">No</button>
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); setConfirming(true); }}
            className="opacity-0 group-hover:opacity-100 p-1 text-zinc-600 hover:text-rose-400 transition-all"
          >
            <X size={13} />
          </button>
        )}
      </div>
      {preview && (
        <p className="text-xs text-zinc-500 leading-relaxed">
          {preview}{truncated ? '…' : ''}
        </p>
      )}
    </div>
  );
}

function LearningPlanView({
  sessions, loading, onPractice, onDelete, onSelect,
}: {
  sessions: PracticeSession[];
  loading: boolean;
  onPractice: (sessionId: string, errorId: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { high, medium, style } = buildLearningPlan(GLORIA_SESSIONS);
  const totalErrors = high.reduce((n, p) => n + p.errorCount, 0)
    + medium.reduce((n, p) => n + p.errorCount, 0)
    + style.reduce((n, p) => n + p.errorCount, 0);

  return (
    <div className="max-w-2xl mx-auto w-full flex flex-col pb-16">

      {/* Header */}
      <div className="py-5">
        <h1 className="text-base font-semibold text-zinc-100 tracking-tight">Your learning plan</h1>
        <p className="text-xs text-zinc-500 mt-0.5">
          {GLORIA_SESSIONS.length} sessions · {totalErrors} errors to work on
        </p>
      </div>

      {/* High-priority patterns */}
      {high.length > 0 && (
        <div className="flex flex-col">
          <div className="border-t border-zinc-800" />
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium pt-4 pb-1">
            High priority
          </p>
          {high.map((item, i) => (
            <div key={item.key}>
              {i > 0 && <div className="border-t border-zinc-800/40" />}
              <PlanRow item={item} onPractice={onPractice} />
            </div>
          ))}
        </div>
      )}

      {/* Medium patterns */}
      {medium.length > 0 && (
        <div className="flex flex-col">
          <div className="border-t border-zinc-800/60 mt-2" />
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium pt-4 pb-1">
            Also noticed
          </p>
          {medium.map((item, i) => (
            <div key={item.key}>
              {i > 0 && <div className="border-t border-zinc-800/30" />}
              <PlanRow item={item} onPractice={onPractice} />
            </div>
          ))}
        </div>
      )}

      {/* Style patterns */}
      {style.length > 0 && (
        <div className="flex flex-col">
          <div className="border-t border-zinc-800/30 mt-2" />
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-medium pt-4 pb-1">
            Style
          </p>
          <p className="text-[11px] text-zinc-400 italic pb-2">Valid but could sound more natural</p>
          {style.map((item, i) => (
            <div key={item.key}>
              {i > 0 && <div className="border-t border-zinc-800/20" />}
              <PlanRow item={item} onPractice={onPractice} muted />
            </div>
          ))}
        </div>
      )}

      {/* User's recorded sessions */}
      {!loading && sessions.length > 0 && (
        <div className="flex flex-col">
          <div className="border-t border-zinc-800/30 mt-4" />
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium pt-4 pb-2">
            Your recordings
          </p>
          <div className="flex flex-col gap-2">
            {sessions.map(s => (
              <CompletedSessionRow
                key={s.id}
                session={s}
                onDelete={() => onDelete(s.id)}
                onSelect={() => onSelect(s.id)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GrammarModule({ userId, locale, view }: Props) {
  const {
    transcript, interimTranscript,
    isListening, isTranscribing,
    supported, durationSec,
    start, stop, reset,
  } = useTranscription(locale);

  const {
    sessions, loading,
    saveSnippet, deleteSession, updateRecording,
    startSession, endSession, activeSession, addRecording,
  } = usePracticeSession(userId);

  const [selectedSessionId,   setSelectedSessionId]   = useState<string | null>(null);
  const [selectedAnalysisId,  setSelectedAnalysisId]  = useState<string | null>(null);
  const [selectedErrorId,     setSelectedErrorId]     = useState<string | null>(null);
  const [analysisSubView,     setAnalysisSubView]      = useState<'summary' | 'transcript'>('summary');
  const [autoSaving,          setAutoSaving]           = useState(false);

  // Flat feed: all recordings newest-first
  const allRecordings = useMemo(() =>
    sessions
      .flatMap(s => s.recordings)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [sessions],
  );

  // Auto-save when Whisper transcript is ready
  useEffect(() => {
    if (!transcript || isListening || isTranscribing || autoSaving) return;
    setAutoSaving(true);
    const save = activeSession
      ? addRecording(transcript, durationSec, null)
      : saveSnippet(transcript, durationSec, null);
    save.finally(() => { reset(); setAutoSaving(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript, isListening, isTranscribing]);

  // Keyboard shortcut: Space
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return;
      e.preventDefault();
      if      (isListening)                    stop();
      else if (!isTranscribing && !autoSaving) start();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isListening, isTranscribing, autoSaving, start, stop]);

  // ── Sessions view ──────────────────────────────────────────────────────────
  if (view === 'sessions') {
    // PracticeDrill — entered directly from learning plan (both IDs set)
    if (selectedAnalysisId && selectedErrorId) {
      const analysis = GLORIA_SESSIONS.find(s => s.id === selectedAnalysisId);
      const error = analysis?.errors.find(e => e.id === selectedErrorId);
      if (analysis && error) {
        return (
          <PracticeDrill
            error={error}
            session={analysis}
            allSessions={GLORIA_SESSIONS}
            userId={userId}
            onBack={() => { setSelectedErrorId(null); setSelectedAnalysisId(null); }}
          />
        );
      }
    }

    // GrammarErrorSummary / transcript — secondary path (analysisId set, no errorId)
    if (selectedAnalysisId && !selectedErrorId) {
      const analysis = GLORIA_SESSIONS.find(s => s.id === selectedAnalysisId);
      if (analysis) {
        if (analysisSubView === 'transcript') {
          return (
            <GrammarAnalysis
              session={analysis}
              onBack={() => setAnalysisSubView('summary')}
              backLabel="Your errors"
            />
          );
        }
        return (
          <GrammarErrorSummary
            session={analysis}
            allSessions={GLORIA_SESSIONS}
            onBack={() => { setSelectedAnalysisId(null); setAnalysisSubView('summary'); }}
            onViewTranscript={() => setAnalysisSubView('transcript')}
            onStartPractice={(errorId) => setSelectedErrorId(errorId)}
          />
        );
      }
    }

    // User's recorded session detail
    const selectedSession = selectedSessionId
      ? sessions.find(s => s.id === selectedSessionId) ?? null
      : null;

    if (selectedSession) {
      return (
        <SessionDetail
          session={selectedSession}
          userId={userId}
          onBack={() => setSelectedSessionId(null)}
          onUpdateRecording={updateRecording}
        />
      );
    }

    // Default: Learning Plan
    return (
      <LearningPlanView
        sessions={sessions}
        loading={loading}
        onPractice={(sessionId, errorId) => {
          setSelectedAnalysisId(sessionId);
          setSelectedErrorId(errorId);
        }}
        onDelete={id => { deleteSession(id); if (selectedSessionId === id) setSelectedSessionId(null); }}
        onSelect={setSelectedSessionId}
      />
    );
  }

  // ── Transcripts view ──────────────────────────────────────────────────────────
  if (view === 'transcripts') {
    // Check both Gloria sessions and user's sessions
    const selectedAnalysis = selectedAnalysisId
      ? GLORIA_SESSIONS.find(s => s.id === selectedAnalysisId) ?? null
      : null;

    const selectedSession = selectedSessionId
      ? sessions.find(s => s.id === selectedSessionId) ?? null
      : null;

    // Check transcript view first (takes precedence)
    if (analysisSubView === 'transcript' && selectedAnalysis) {
      return (
        <GrammarAnalysis
          session={selectedAnalysis}
          onBack={() => setAnalysisSubView('summary')}
          backLabel="Your errors"
        />
      );
    }

    // If a Gloria session is selected, show GrammarErrorSummary
    if (selectedAnalysis && !selectedSessionId) {
      return (
        <GrammarErrorSummary
          session={selectedAnalysis}
          allSessions={GLORIA_SESSIONS}
          onBack={() => { setSelectedAnalysisId(null); setAnalysisSubView('summary'); }}
          onViewTranscript={() => setAnalysisSubView('transcript')}
          onStartPractice={(errorId) => setSelectedErrorId(errorId)}
        />
      );
    }

    // If a user session is selected, show SessionDetail
    if (selectedSession) {
      return (
        <SessionDetail
          session={selectedSession}
          userId={userId}
          onBack={() => setSelectedSessionId(null)}
          onUpdateRecording={updateRecording}
        />
      );
    }

    if (loading) return <p className="text-xs text-zinc-600 py-8 text-center">Loading…</p>;

    return (
      <div className="max-w-2xl mx-auto w-full flex flex-col gap-8 pb-16">
        <div className="py-5">
          <h1 className="text-base font-semibold text-zinc-100 tracking-tight">Transcripts</h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            {GLORIA_SESSIONS.length} analysed + {sessions.length} of your own
          </p>
        </div>

        {/* Gloria's analysed sessions */}
        <div className="flex flex-col gap-2.5 border-t border-zinc-800 pt-4">
          <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium px-1">
            Sample sessions
          </p>
          {GLORIA_SESSIONS.map(s => (
            <div
              key={s.id}
              onClick={() => setSelectedAnalysisId(s.id)}
              className="group flex flex-col gap-2.5 px-4 py-4 rounded-xl
                bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700/60
                transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-zinc-500">{s.speaker}</span>
                </div>
                <span className="text-[11px] text-zinc-700">
                  {s.errors.length} error{s.errors.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-sm font-medium text-zinc-300">{s.topic}</p>
              <p className="text-xs text-zinc-600 leading-relaxed line-clamp-2">
                {s.transcript.slice(0, 140).trimEnd()}…
              </p>
            </div>
          ))}
        </div>

        {/* User's recorded sessions */}
        {sessions.length > 0 && (
          <div className="flex flex-col gap-2.5 border-t border-zinc-800 pt-4">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium px-1">
              Your recordings
            </p>
            {sessions.map(s => (
              <CompletedSessionRow
                key={s.id}
                session={s}
                onDelete={() => { deleteSession(s.id); if (selectedSessionId === s.id) setSelectedSessionId(null); }}
                onSelect={() => setSelectedSessionId(s.id)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Coach view — recording active ──────────────────────────────────────────
  if (isListening || isTranscribing || autoSaving) {
    return (
      <TranscriptPanel
        transcript={transcript}
        interimTranscript={interimTranscript}
        isListening={isListening}
        isTranscribing={isTranscribing || autoSaving}
        durationSec={durationSec}
        onStop={stop}
      />
    );
  }

  // ── Coach view — feed ──────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="max-w-2xl mx-auto w-full flex items-center justify-between gap-4">
        <p className="text-[11px] text-zinc-600">
          Press{' '}
          <kbd className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 font-mono text-[11px] text-zinc-500">
            Space
          </kbd>{' '}
          to record · again to stop
        </p>

        <div className="flex items-center gap-3 shrink-0">
          {activeSession ? (
            <>
              <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {activeSession.recordings.length} snippet{activeSession.recordings.length !== 1 ? 's' : ''}
              </span>
              <button
                onClick={endSession}
                className="px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-emerald-900/30 hover:bg-emerald-900/50 text-emerald-300
                  border border-emerald-800/40 transition-all duration-150"
              >
                End session
              </button>
            </>
          ) : (
            <>
              {userId && (
                <button
                  onClick={() => startSession()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium
                    text-zinc-500 hover:text-zinc-300 border border-zinc-800
                    hover:border-zinc-700 transition-all duration-150"
                >
                  New session
                </button>
              )}
              {supported && (
                <button
                  onClick={start}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                    bg-amber-900/30 hover:bg-amber-900/50 text-amber-300 border border-amber-800/40
                    transition-all duration-150 active:scale-95"
                >
                  <Mic size={14} />
                  Record
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <RecordingFeed recordings={allRecordings} loading={loading} userId={userId} onSave={updateRecording} />
    </div>
  );
}
