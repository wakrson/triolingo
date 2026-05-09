import { useState } from 'react';
import { useNavigate } from 'react-router';
import { LearningPathForm } from '../components/LearningPathForm';
import { LearningGraph } from '../components/LearningGraph';
import type { KnowledgeGraph } from '../types/assessment';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

type PathConfig = {
  timeLimit: string;
  experienceLevel: string;
  motivation: string;
};

type RequestPayload = {
  language: string;
  goal: string;
  timeline: string;
  experience_level: string;
};

type PersonalizeResponse = {
  graph: KnowledgeGraph;
  user_id: string;
  llm_system: string;
  llm_prompt: string;
  llm_response: string;
};

export function LearningPathPage() {
  const navigate = useNavigate();
  const [pathConfig, setPathConfig] = useState<PathConfig | null>(null);
  const [requestPayload, setRequestPayload] = useState<RequestPayload | null>(null);
  const [llmRequest, setLlmRequest] = useState<{ system: string; prompt: string; response: string; graph: PersonalizeResponse['graph']; userId: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (config: PathConfig) => {
    setIsSubmitting(true);
    setError(null);
    setLlmRequest(null);

    const payload: RequestPayload = {
      language: 'Spanish',
      goal: config.motivation,
      timeline: config.timeLimit,
      experience_level: config.experienceLevel,
    };
    setRequestPayload(payload);

    try {
      const response = await fetch(`${API_BASE_URL}/personalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      const data: PersonalizeResponse = await response.json();
      sessionStorage.setItem('triolingo_user_id', data.user_id);
      sessionStorage.setItem('triolingo_graph', JSON.stringify(data.graph));
      setLlmRequest({
        system: data.llm_system,
        prompt: data.llm_prompt,
        response: data.llm_response,
        graph: data.graph,
        userId: data.user_id,
      });
      setPathConfig(config);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit form');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="mb-2">Generate Your Path</h1>
        <p className="text-gray-400">Configure your personalized Spanish learning journey with triolingo</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <LearningPathForm onSubmit={handleSubmit} />
        </div>

        <div className="lg:col-span-2">
          {isSubmitting ? (
            <div className="border border-gray-800 rounded-lg bg-gray-900/30 p-12 flex flex-col items-center justify-center min-h-[600px] gap-4">
              <div className="w-8 h-8 border-2 border-gray-600 border-t-emerald-400 rounded-full animate-spin" />
              <p className="text-gray-400 text-sm">Personalizing your learning path...</p>
            </div>
          ) : error ? (
            <div className="border border-red-800 rounded-lg bg-red-900/20 p-12 flex items-center justify-center min-h-[600px]">
              <p className="text-red-400 text-center text-sm">{error}</p>
            </div>
          ) : pathConfig ? (
            <>
              <LearningGraph
                config={pathConfig}
                graph={llmRequest?.graph}
                onNodeClick={llmRequest ? (nodeId) => navigate(`/lesson/${encodeURIComponent(nodeId)}`) : undefined}
              />
              {llmRequest && (
                <>
                  <RequestPanel
                    title="LLM request (profile + knowledge graph)"
                    subtitle="What the backend sent to the model"
                    body={`SYSTEM:\n${llmRequest.system}\n\nPROMPT:\n${llmRequest.prompt}`}
                  />
                  <RequestPanel
                    title="LLM response (subgraph selection)"
                    subtitle="Node IDs the model chose to keep & mark known"
                    body={llmRequest.response}
                  />
                  <RequestPanel
                    title="Resulting subgraph"
                    subtitle={`${llmRequest.graph.nodes.length} nodes, ${llmRequest.graph.edges.length} edges sliced from the base graph`}
                    body={JSON.stringify(llmRequest.graph, null, 2)}
                  />
                </>
              )}
            </>
          ) : (
            <div className="border border-gray-800 rounded-lg bg-gray-900/30 p-12 flex items-center justify-center min-h-[600px]">
              <p className="text-gray-500 text-center">
                Fill out the form to generate your personalized learning path
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RequestPanel({ title, subtitle, body }: { title: string; subtitle: string; body: string }) {
  return (
    <details className="border border-gray-800 rounded-lg bg-gray-900/30 p-4 group" open>
      <summary className="cursor-pointer select-none">
        <span className="text-white font-medium">{title}</span>
        <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
      </summary>
      <pre className="mt-3 p-3 bg-black border border-gray-800 rounded text-xs text-[#39ff14] overflow-auto max-h-96 whitespace-pre-wrap break-words">
        {body}
      </pre>
    </details>
  );
}
