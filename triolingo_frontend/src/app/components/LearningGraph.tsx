import { CheckCircle2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';

// ── Types (mirror backend models.py) ──────────────────────────────────────────

interface GraphNode {
  id: string;
  label: string;
  type: string;
  difficulty: number;
  tags: string[];
  status: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface LearningGraphProps {
  config: {
    timeLimit: string;
    experienceLevel: string;
    motivation: string;
  };
}

// ── Constants ──────────────────────────────────────────────────────────────────

const NODE_RADIUS = 24;
const LEVEL_W     = 220;
const ROW_H       = 120;
const OFFSET_X    = 80;
const OFFSET_Y    = 80;

const TYPE_COLORS: Record<string, string> = {
  pronunciation: '#39ff14',
  grammar:       '#ffffff',
  vocabulary:    '#2ee010',
  conversational:'#60ff60',
  cultural:      '#f59e0b',
};

const STATUS_RING: Record<string, string> = {
  known:       '#39ff14',
  weak:        '#f59e0b',
  in_progress: '#60a5fa',
  unknown:     '#4b5563',
};

// ── Layout helpers ─────────────────────────────────────────────────────────────

/** BFS topological layout — assigns x/y from edge relationships */
function layoutNodes(
  rawNodes: GraphNode[],
  rawEdges: GraphEdge[],
): (GraphNode & { x: number; y: number; color: string })[] {
  const inDegree = new Map<string, number>();
  const children  = new Map<string, string[]>();

  for (const n of rawNodes) {
    inDegree.set(n.id, 0);
    children.set(n.id, []);
  }
  for (const e of rawEdges) {
    if (!inDegree.has(e.source) || !inDegree.has(e.target)) continue;
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    children.get(e.source)!.push(e.target);
  }

  // BFS → assign column
  const level = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) { level.set(id, 0); queue.push(id); }
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const curLv = level.get(cur) ?? 0;
    for (const child of children.get(cur) ?? []) {
      level.set(child, Math.max(level.get(child) ?? 0, curLv + 1));
      queue.push(child);
    }
  }

  // Group by column → assign row
  const byLevel = new Map<number, string[]>();
  for (const [id, lv] of level) {
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(id);
  }

  const coords = new Map<string, { x: number; y: number }>();
  for (const [lv, ids] of byLevel) {
    ids.forEach((id, row) => {
      coords.set(id, { x: lv * LEVEL_W + OFFSET_X, y: row * ROW_H + OFFSET_Y });
    });
  }

  return rawNodes.map(n => ({
    ...n,
    color: TYPE_COLORS[n.type] ?? '#39ff14',
    x: coords.get(n.id)?.x ?? OFFSET_X,
    y: coords.get(n.id)?.y ?? OFFSET_Y,
  }));
}

// Map form config fields → UserProfile fields expected by the backend
function configToProfile(config: LearningGraphProps['config']) {
  const goalMap: Record<string, string> = {
    travel:      'Travel & Tourism',
    work:        'Professional / Business',
    academic:    'Academic Studies',
    cultural:    'Cultural Exploration',
    family:      'Family & Relationships',
    immigration: 'Immigration / Relocation',
  };
  const timelineMap: Record<string, string> = {
    '3months': '3 months',
    '6months': '6 months',
    '1year':   '1 year',
    '2years':  '2 years',
  };
  const experienceMap: Record<string, string> = {
    'absolute-beginner':  'Absolute Beginner',
    'beginner':           'Beginner (A1)',
    'elementary':         'Elementary (A2)',
    'intermediate':       'Intermediate (B1)',
    'upper-intermediate': 'Upper Intermediate (B2)',
  };

  return {
    language:         'Spanish',
    goal:             goalMap[config.motivation]     ?? config.motivation,
    timeline:         timelineMap[config.timeLimit]  ?? config.timeLimit,
    experience_level: experienceMap[config.experienceLevel] ?? config.experienceLevel,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function LearningGraph({ config }: LearningGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [graph,       setGraph]       = useState<KnowledgeGraph | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);

  // Zoom / pan
  const [scale,     setScale]     = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning  = useRef(false);
  const lastMouse  = useRef({ x: 0, y: 0 });

  const resetView = useCallback(() => { setScale(1); setTranslate({ x: 0, y: 0 }); }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(Math.max(s * (e.deltaY > 0 ? 0.9 : 1.1), 0.3), 3));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.graph-node')) return;
    isPanning.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setTranslate(t => ({ x: t.x + dx, y: t.y + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  // Call POST /personalize whenever config changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setGraph(null);

    fetch(`backend`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(configToProfile(config)),
    })
      .then(r => {
        if (!r.ok) throw new Error(`Server error ${r.status}`);
        return r.json() as Promise<KnowledgeGraph>;
      })
      .then(data => { setGraph(data); resetView(); })
      .catch(err => setError(`Could not load graph: ${err.message}`))
      .finally(() => setLoading(false));
  }, [config, resetView]);

  // Layout computed nodes
  const { nodes, edges } = (() => {
    if (!graph) return { nodes: [], edges: [] };
    return {
      nodes: layoutNodes(graph.nodes, graph.edges),
      edges: graph.edges,
    };
  })();

  const canvasW = nodes.length ? Math.max(...nodes.map(n => n.x)) + 200 : 600;
  const canvasH = nodes.length ? Math.max(...nodes.map(n => n.y)) + 140 : 400;

  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900/30 p-8">

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="mb-2">Your Personalized Learning Path</h2>
          <p className="text-gray-400">
            Optimized for {getTimeLabel(config.timeLimit)} • {getMotivationLabel(config.motivation)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.min(s * 1.2, 3))} className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors" title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setScale(s => Math.max(s * 0.8, 0.3))} className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors" title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={resetView} className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors" title="Reset view">
            <Maximize2 className="w-4 h-4" />
          </button>
          <span className="ml-2 text-xs text-gray-500 tabular-nums">{Math.round(scale * 100)}%</span>
        </div>
      </div>

      {/* Graph viewport */}
      <div
        className="relative bg-black rounded-lg border border-gray-800 overflow-hidden select-none"
        style={{ height: '520px', cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div className="absolute bottom-3 left-3 text-xs text-gray-600 pointer-events-none z-10">
          Scroll to zoom · Drag to pan · Hover nodes for details
        </div>

        {/* Loading */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-gray-500 animate-pulse">Generating your learning path…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <p className="text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Canvas */}
        {!loading && !error && graph && (
          <div
            style={{
              transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              width: canvasW,
              height: canvasH,
              position: 'absolute',
            }}
          >
            {/* Edges */}
            <svg
              width={canvasW}
              height={canvasH}
              style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
            >
              {edges.map((edge, idx) => {
                const from = nodes.find(n => n.id === edge.source);
                const to   = nodes.find(n => n.id === edge.target);
                if (!from || !to) return null;

                const dx = to.x - from.x, dy = to.y - from.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const ux = dx / dist, uy = dy / dist;
                const isRelated = edge.relationship === 'related';

                return (
                  <line
                    key={idx}
                    x1={from.x + ux * NODE_RADIUS}
                    y1={from.y + uy * NODE_RADIUS}
                    x2={to.x   - ux * NODE_RADIUS}
                    y2={to.y   - uy * NODE_RADIUS}
                    stroke={isRelated ? '#6b7280' : '#39ff14'}
                    strokeWidth="1.5"
                    opacity={isRelated ? 0.2 : 0.35}
                    strokeDasharray={isRelated ? '4 3' : undefined}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {nodes.map(node => {
              const isHovered = hoveredNode === node.id;
              const statusColor = STATUS_RING[node.status] ?? STATUS_RING.unknown;

              return (
                <div
                  key={node.id}
                  className="graph-node absolute"
                  style={{ left: node.x, top: node.y, transform: 'translate(-50%, -50%)', zIndex: isHovered ? 50 : 10 }}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {isHovered ? (
                    <div
                      className="bg-black border-2 rounded-lg p-4 shadow-2xl"
                      style={{ borderColor: node.color, minWidth: '200px', boxShadow: `0 0 24px ${node.color}30` }}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: node.color }} />
                        <h3 className="font-medium text-sm leading-tight text-white">{node.label}</h3>
                      </div>
                      <p className="text-xs text-gray-400 capitalize mb-1">{node.type} · difficulty {node.difficulty}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{node.tags.join(', ')}</p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
                        <span className="text-xs capitalize" style={{ color: statusColor }}>{node.status}</span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="rounded-full border-2 cursor-pointer hover:scale-110 transition-transform animate-pulse"
                      style={{
                        width:  NODE_RADIUS * 2,
                        height: NODE_RADIUS * 2,
                        borderColor:       node.color,
                        backgroundColor:   'rgba(0,0,0,0.85)',
                        boxShadow:         `0 0 18px ${node.color}50`,
                        animationDuration: '3s',
                        // outer ring reflects status
                        outline:      `2px solid ${statusColor}`,
                        outlineOffset: '3px',
                      }}
                    >
                      <div className="w-full h-full rounded-full opacity-20" style={{ backgroundColor: node.color }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-gray-800">
        <h3 className="font-medium mb-3">Legend</h3>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <div>
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">Node type</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-sm text-gray-400 capitalize">{type}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">Status</p>
            <div className="flex flex-wrap gap-3">
              {Object.entries(STATUS_RING).map(([status, color]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full border" style={{ borderColor: color }} />
                  <span className="text-sm text-gray-400 capitalize">{status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-600 mb-2 uppercase tracking-wide">Edges</p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 border-t" style={{ borderColor: '#39ff14' }} />
                <span className="text-sm text-gray-400">Prerequisite</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 border-t border-dashed border-gray-500" />
                <span className="text-sm text-gray-400">Related</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Label helpers ──────────────────────────────────────────────────────────────

function getTimeLabel(timeLimit: string): string {
  const labels: Record<string, string> = {
    '3months': '3-month intensive track',
    '6months': '6-month moderate pace',
    '1year':   '1-year comfortable pace',
    '2years':  '2-year relaxed pace',
  };
  return labels[timeLimit] ?? timeLimit;
}

function getMotivationLabel(motivation: string): string {
  const labels: Record<string, string> = {
    travel:      'Travel & Tourism focus',
    work:        'Professional/Business focus',
    academic:    'Academic Studies focus',
    cultural:    'Cultural Exploration focus',
    family:      'Family & Relationships focus',
    immigration: 'Immigration/Relocation focus',
  };
  return labels[motivation] ?? motivation;
}
