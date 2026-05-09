import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import type { GraphNode, KnowledgeGraph } from '../types/assessment';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

type Exercise = {
  exercise_id: string;
  type: 'fill_blank' | 'translate' | 'multiple_choice';
  prompt: string;
  options?: string[];
  correct_answer: string;
};

type GradeResponse = {
  correct: boolean;
  status: 'known' | 'weak' | 'unknown';
  feedback: string;
};

function loadGraph(): KnowledgeGraph | null {
  const raw = sessionStorage.getItem('triolingo_graph');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as KnowledgeGraph;
  } catch {
    return null;
  }
}

export function LessonPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const [userId] = useState(() => sessionStorage.getItem('triolingo_user_id'));
  const [graph] = useState(() => loadGraph());
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [grade, setGrade] = useState<GradeResponse | null>(null);
  const [grading, setGrading] = useState(false);

  const node: GraphNode | undefined = graph?.nodes.find((n) => n.id === nodeId);

  useEffect(() => {
    if (!userId || !nodeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API_BASE_URL}/exercise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, node_id: nodeId }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status} ${r.statusText}`);
        return (await r.json()) as Exercise;
      })
      .then((data) => {
        if (!cancelled) setExercise(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load exercise');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, nodeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exercise || !userId || !nodeId || grading) return;
    setGrading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE_URL}/exercise/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          node_id: nodeId,
          exercise_id: exercise.exercise_id,
          answer,
        }),
      });
      if (!r.ok) throw new Error(`Request failed: ${r.status} ${r.statusText}`);
      const data = (await r.json()) as GradeResponse & { updated_graph?: KnowledgeGraph };
      setGrade({ correct: data.correct, status: data.status, feedback: data.feedback });
      if (data.updated_graph) {
        sessionStorage.setItem('triolingo_graph', JSON.stringify(data.updated_graph));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to grade exercise');
    } finally {
      setGrading(false);
    }
  };

  if (!userId) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <p className="text-gray-400 mb-4">No active learning session found.</p>
        <Link to="/learning-path" className="text-emerald-400 hover:underline inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Generate a learning path first
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <Link to="/learning-path" className="text-gray-500 hover:text-gray-300 inline-flex items-center gap-2 mb-6 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to your path
      </Link>

      <div className="mb-8">
        <span className="text-xs font-mono tracking-widest text-emerald-400 uppercase">Lesson</span>
        <h1 className="mt-2 mb-1">{node?.label ?? nodeId}</h1>
        {node && (
          <p className="text-gray-400 text-sm">
            {node.type}
            {node.tags?.length ? ` · ${node.tags.join(' · ')}` : ''}
          </p>
        )}
      </div>

      {loading && (
        <div className="border border-gray-800 rounded-lg bg-gray-900/30 p-12 flex items-center justify-center min-h-[200px]">
          <p className="text-gray-400">Generating exercise…</p>
        </div>
      )}

      {error && !loading && (
        <div className="border border-red-900 rounded-lg bg-red-950/30 p-6">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {exercise && !loading && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border border-gray-800 rounded-lg bg-gray-900/30 p-6">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-3">{exercise.type.replace('_', ' ')}</p>
            <p className="text-white text-lg leading-relaxed whitespace-pre-wrap">{exercise.prompt}</p>
          </div>

          {exercise.type === 'multiple_choice' && exercise.options ? (
            <div className="space-y-2">
              {exercise.options.map((opt) => (
                <label
                  key={opt}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    answer === opt ? 'border-emerald-500 bg-emerald-950/20' : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="answer"
                    value={opt}
                    checked={answer === opt}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="accent-emerald-500"
                  />
                  <span className="text-white">{opt}</span>
                </label>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Your answer…"
              className="w-full p-3 bg-black border border-gray-800 rounded-lg text-white focus:border-emerald-500 outline-none"
              autoFocus
            />
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={grading || !answer.trim()}
              className="px-5 py-2 rounded-lg bg-emerald-500 text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-400 transition-colors"
            >
              {grading ? 'Checking…' : 'Check answer'}
            </button>
          </div>

          {grade && (
            <div
              className={`border rounded-lg p-5 ${
                grade.correct ? 'border-emerald-700 bg-emerald-950/20' : 'border-amber-700 bg-amber-950/20'
              }`}
            >
              <p className={`font-medium mb-2 ${grade.correct ? 'text-emerald-400' : 'text-amber-400'}`}>
                {grade.correct ? 'Correct' : 'Not quite'} · marked as {grade.status}
              </p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{grade.feedback}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
