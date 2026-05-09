const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  difficulty: number;
  tags: string[];
  status: 'known' | 'weak' | 'unknown';
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export async function personalizeGraph(profile: {
  language: string;
  goal: string;
  timeline: string;
  experience_level: string;
}): Promise<{ graph: KnowledgeGraph }> {
  const res = await fetch(`${API_BASE}/personalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Personalize failed (${res.status}): ${body}`);
  }
  return res.json();
}

export async function getBaseGraph(): Promise<KnowledgeGraph> {
  const res = await fetch(`${API_BASE}/graph`);
  if (!res.ok) throw new Error(`Get graph failed: ${res.status}`);
  return res.json();
}

export async function getUserGraph(userId: string): Promise<KnowledgeGraph> {
  const res = await fetch(`${API_BASE}/graph/${userId}`);
  if (!res.ok) throw new Error(`Get user graph failed: ${res.status}`);
  return res.json();
}

export async function getNextSession(userId: string): Promise<{ user_id: string; recommended_nodes: GraphNode[] }> {
  const res = await fetch(`${API_BASE}/next-session/${userId}`);
  if (!res.ok) throw new Error(`Get session failed: ${res.status}`);
  return res.json();
}
