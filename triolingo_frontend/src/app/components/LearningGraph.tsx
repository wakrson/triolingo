import { CheckCircle2, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useMemo, useState, useRef, useCallback } from 'react';

interface LearningGraphProps {
  config: {
    timeLimit: string;
    experienceLevel: string;
    motivation: string;
  };
}

interface Node {
  id: string;
  label: string;
  description: string;
  level: number;
  position: number;
  color: string;
}

interface Edge {
  from: string;
  to: string;
}

const LEVEL_SPACING = 220;
const ROW_SPACING = 130;
const OFFSET_X = 80;
const OFFSET_Y = 80;
const NODE_RADIUS = 24;

function getNodeCoords(node: Node) {
  return {
    x: node.level * LEVEL_SPACING + OFFSET_X,
    y: node.position * ROW_SPACING + OFFSET_Y,
  };
}

export function LearningGraph({ config }: LearningGraphProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  // Zoom/pan state
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, edges } = useMemo(() => generateLearningPath(config), [config]);

  // Compute SVG canvas size based on node positions
  const canvasWidth = useMemo(() => {
    const maxLevel = Math.max(...nodes.map(n => n.level));
    return maxLevel * LEVEL_SPACING + OFFSET_X * 2 + 160;
  }, [nodes]);

  const canvasHeight = useMemo(() => {
    const maxPos = Math.max(...nodes.map(n => n.position));
    return maxPos * ROW_SPACING + OFFSET_Y * 2 + 60;
  }, [nodes]);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(s => Math.min(Math.max(s * delta, 0.3), 3));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only pan on the background, not on nodes
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

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return (
    <div className="border border-gray-800 rounded-lg bg-gray-900/30 p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="mb-2">Your Personalized Learning Path</h2>
          <p className="text-gray-400">
            Optimized for {getTimeLabel(config.timeLimit)} • {getMotivationLabel(config.motivation)}
          </p>
        </div>
        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale(s => Math.min(s * 1.2, 3))}
            className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale(s => Math.max(s * 0.8, 0.3))}
            className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={resetView}
            className="p-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            title="Reset view"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <span className="ml-2 text-xs text-gray-500 tabular-nums">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-lg border border-gray-800 overflow-hidden select-none"
        style={{ height: '520px', cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Hint */}
        <div className="absolute bottom-3 left-3 text-xs text-gray-600 pointer-events-none z-10">
          Scroll to zoom · Drag to pan · Hover nodes for details
        </div>

        {/* Transformable layer */}
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: canvasWidth,
            height: canvasHeight,
            position: 'absolute',
          }}
        >
          {/* SVG for edges — same coordinate space as nodes */}
          <svg
            width={canvasWidth}
            height={canvasHeight}
            style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}
          >
            {edges.map((edge, idx) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              const { x: x1, y: y1 } = getNodeCoords(fromNode);
              const { x: x2, y: y2 } = getNodeCoords(toNode);

              // Offset line endpoints to edge of circle
              const dx = x2 - x1;
              const dy = y2 - y1;
              const dist = Math.sqrt(dx * dx + dy * dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;

              const startX = x1 + ux * NODE_RADIUS;
              const startY = y1 + uy * NODE_RADIUS;
              const endX = x2 - ux * (NODE_RADIUS); 
              const endY = y2 - uy * (NODE_RADIUS);

              return (
                <line
                  key={idx}
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke="#39ff14"
                  strokeWidth="1.5"
                  opacity="0.35"
                />
              );
            })}
          </svg>

          {/* Nodes rendered as HTML divs in same coordinate space */}
          {nodes.map((node) => {
            const { x, y } = getNodeCoords(node);
            const isHovered = hoveredNode === node.id;

            return (
              <div
                key={node.id}
                className="graph-node absolute"
                style={{
                  left: x,
                  top: y,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isHovered ? 50 : 10,
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {isHovered ? (
                  <div
                    className="bg-black border-2 rounded-lg p-4 shadow-2xl"
                    style={{
                      borderColor: node.color,
                      minWidth: '190px',
                      boxShadow: `0 0 24px ${node.color}30`,
                    }}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <CheckCircle2
                        className="w-4 h-4 flex-shrink-0 mt-0.5"
                        style={{ color: node.color }}
                      />
                      <h3 className="font-medium text-sm leading-tight text-white">{node.label}</h3>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{node.description}</p>
                  </div>
                ) : (
                  <div
                    className="rounded-full border-2 transition-all duration-200 cursor-pointer hover:scale-110 animate-pulse"
                    style={{
                      width: NODE_RADIUS * 2,
                      height: NODE_RADIUS * 2,
                      borderColor: node.color,
                      backgroundColor: 'rgba(0,0,0,0.85)',
                      boxShadow: `0 0 18px ${node.color}50`,
                      animationDuration: '3s',
                    }}
                  >
                    <div
                      className="w-full h-full rounded-full opacity-20"
                      style={{ backgroundColor: node.color }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-8 pt-6 border-t border-gray-800">
        <h3 className="font-medium mb-3">Legend</h3>
        <div className="flex flex-wrap gap-4">
          {[
            { color: '#39ff14', label: 'Foundation' },
            { color: '#ffffff', label: 'Core Skills' },
            { color: '#2ee010', label: 'Advanced' },
            { color: '#60ff60', label: 'Specialized' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
              <span className="text-sm text-gray-400">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function generateLearningPath(config: {
  timeLimit: string;
  experienceLevel: string;
  motivation: string;
}): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const isIntensive = config.timeLimit === '3months';
  const skipBasics = ['intermediate', 'upper-intermediate'].includes(config.experienceLevel);

  if (!skipBasics) {
    nodes.push({ id: 'alphabet', label: 'Alphabet & Pronunciation', description: 'Master Spanish sounds and letters', level: 0, position: 0, color: '#39ff14' });
    nodes.push({ id: 'basic-grammar', label: 'Basic Grammar', description: 'Present tense, articles, gender', level: 0, position: 1, color: '#39ff14' });
    edges.push({ from: 'alphabet', to: 'basic-grammar' });
  }

  const startNode = skipBasics ? null : 'basic-grammar';

  nodes.push({ id: 'vocabulary-foundation', label: 'Essential Vocabulary', description: 'Common words and phrases', level: skipBasics ? 0 : 1, position: 0, color: '#ffffff' });
  if (startNode) edges.push({ from: startNode, to: 'vocabulary-foundation' });

  const motivationSpecific = getMotivationModule(config.motivation);
  nodes.push({ id: 'motivation-module', label: motivationSpecific.label, description: motivationSpecific.description, level: skipBasics ? 0 : 1, position: 1, color: '#ffffff' });
  if (startNode) edges.push({ from: startNode, to: 'motivation-module' });

  nodes.push({ id: 'conversation', label: 'Conversational Practice', description: 'Speaking and listening skills', level: skipBasics ? 1 : 2, position: 0, color: '#2ee010' });
  edges.push({ from: 'vocabulary-foundation', to: 'conversation' });
  edges.push({ from: 'motivation-module', to: 'conversation' });

  nodes.push({ id: 'grammar-advanced', label: 'Advanced Grammar', description: 'Past tenses, subjunctive mood', level: skipBasics ? 1 : 2, position: 1, color: '#2ee010' });
  edges.push({ from: 'vocabulary-foundation', to: 'grammar-advanced' });

  if (!isIntensive) {
    nodes.push({ id: 'culture', label: 'Cultural Immersion', description: 'Customs, media, and traditions', level: skipBasics ? 1 : 2, position: 2, color: '#2ee010' });
    edges.push({ from: 'motivation-module', to: 'culture' });
  }

  nodes.push({ id: 'fluency', label: 'Fluency Building', description: 'Complex conversations', level: skipBasics ? 2 : 3, position: 0, color: '#60ff60' });
  edges.push({ from: 'conversation', to: 'fluency' });
  edges.push({ from: 'grammar-advanced', to: 'fluency' });

  const specialization = getSpecializationModule(config.motivation);
  nodes.push({ id: 'specialization', label: specialization.label, description: specialization.description, level: skipBasics ? 2 : 3, position: 1, color: '#60ff60' });
  edges.push({ from: 'conversation', to: 'specialization' });
  edges.push({ from: 'motivation-module', to: 'specialization' });

  if (!isIntensive) {
    nodes.push({ id: 'mastery', label: 'Native-Level Mastery', description: 'Idioms, nuance, regional dialects', level: skipBasics ? 3 : 4, position: 0, color: '#39ff14' });
    edges.push({ from: 'fluency', to: 'mastery' });
    edges.push({ from: 'specialization', to: 'mastery' });
  }

  return { nodes, edges };
}

function getMotivationModule(motivation: string) {
  const modules: Record<string, { label: string; description: string }> = {
    travel: { label: 'Travel Phrases', description: 'Hotels, restaurants, directions' },
    work: { label: 'Business Spanish', description: 'Professional vocabulary and emails' },
    academic: { label: 'Academic Spanish', description: 'Research, presentations, writing' },
    cultural: { label: 'Cultural Context', description: 'Literature, art, history' },
    family: { label: 'Daily Conversations', description: 'Family topics and casual talk' },
    immigration: { label: 'Practical Living', description: 'Government, healthcare, shopping' },
  };
  return modules[motivation] ?? modules.travel;
}

function getSpecializationModule(motivation: string) {
  const modules: Record<string, { label: string; description: string }> = {
    travel: { label: 'Regional Variations', description: 'Latin America vs Spain differences' },
    work: { label: 'Industry Terminology', description: 'Field-specific professional language' },
    academic: { label: 'Academic Writing', description: 'Essays, thesis, formal writing' },
    cultural: { label: 'Media Consumption', description: 'Books, films, podcasts in Spanish' },
    family: { label: 'Deep Connections', description: 'Emotional expressions and nuance' },
    immigration: { label: 'Civic Integration', description: 'Legal, cultural, community topics' },
  };
  return modules[motivation] ?? modules.travel;
}

function getTimeLabel(timeLimit: string): string {
  const labels: Record<string, string> = {
    '3months': '3-month intensive track',
    '6months': '6-month moderate pace',
    '1year': '1-year comfortable pace',
    '2years': '2-year relaxed pace',
  };
  return labels[timeLimit] ?? timeLimit;
}

function getMotivationLabel(motivation: string): string {
  const labels: Record<string, string> = {
    travel: 'Travel & Tourism focus',
    work: 'Professional/Business focus',
    academic: 'Academic Studies focus',
    cultural: 'Cultural Exploration focus',
    family: 'Family & Relationships focus',
    immigration: 'Immigration/Relocation focus',
  };
  return labels[motivation] ?? motivation;
}
