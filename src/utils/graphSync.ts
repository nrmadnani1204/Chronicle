import type { GraphNode, GraphEdge, GraphNodeType, GraphEdgeRelation, MoodState } from '../types';

const VALID_NODE_TYPES: GraphNodeType[] = [
  'session',
  'memory',
  'like',
  'dislike',
  'aspiration',
  'person',
  'activity',
  'mood_moment',
];

const VALID_RELATIONS: GraphEdgeRelation[] = [
  'mentions',
  'relates_to',
  'causes',
  'contradicts',
  'progresses_toward',
  'about_person',
  'evokes_mood',
  'similar_to',
];

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

interface ExtractedNode {
  label?: string;
  type?: string;
  description?: string;
  importance?: number;
}

interface ExtractedEdge {
  sourceLabel?: string;
  targetLabel?: string;
  relation?: string;
  weight?: number;
}

interface ApplyExtractionParams {
  userId: string;
  existingNodes: GraphNode[];
  existingEdges: GraphEdge[];
  extractedNodes: ExtractedNode[];
  extractedEdges: ExtractedEdge[];
  sourceSessionId?: string;
}

interface ApplyExtractionResult {
  updatedNodes: GraphNode[];
  newEdges: GraphEdge[];
}

// Resolves LLM/fallback-extracted node & edge labels against the existing
// graph: reuses a matching node (bumping its reference count) instead of
// minting a near-duplicate, mints new nodes for unmatched labels, and dedupes
// edges that already exist between the same pair + relation.
export function applyExtractionToGraph(params: ApplyExtractionParams): ApplyExtractionResult {
  const { userId, existingNodes, existingEdges, extractedNodes, extractedEdges, sourceSessionId } = params;
  const now = Date.now();

  const labelToNode = new Map<string, GraphNode>();
  for (const n of existingNodes) {
    labelToNode.set(normalizeLabel(n.label), n);
  }

  const updatedNodes: GraphNode[] = [];

  for (const en of extractedNodes) {
    const label = en?.label?.trim();
    if (!label) continue;
    const norm = normalizeLabel(label);
    const existing = labelToNode.get(norm);

    if (existing) {
      const touched: GraphNode = {
        ...existing,
        lastReferencedAt: now,
        referenceCount: (existing.referenceCount || 0) + 1,
      };
      labelToNode.set(norm, touched);
      updatedNodes.push(touched);
      continue;
    }

    const type = VALID_NODE_TYPES.includes(en.type as GraphNodeType) ? (en.type as GraphNodeType) : 'memory';
    const node: GraphNode = {
      id: `node_${now}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      type,
      label,
      description: en.description,
      importance: typeof en.importance === 'number' ? en.importance : 0.6,
      sourceSessionId,
      createdAt: now,
      lastReferencedAt: now,
      referenceCount: 1,
    };
    labelToNode.set(norm, node);
    updatedNodes.push(node);
  }

  const existingEdgeKeys = new Set(existingEdges.map((e) => `${e.source}|${e.target}|${e.relation}`));
  const newEdges: GraphEdge[] = [];

  for (const ee of extractedEdges) {
    if (!ee?.sourceLabel || !ee?.targetLabel) continue;
    const sourceNode = labelToNode.get(normalizeLabel(ee.sourceLabel));
    const targetNode = labelToNode.get(normalizeLabel(ee.targetLabel));
    if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) continue;

    const relation = VALID_RELATIONS.includes(ee.relation as GraphEdgeRelation)
      ? (ee.relation as GraphEdgeRelation)
      : 'relates_to';
    const key = `${sourceNode.id}|${targetNode.id}|${relation}`;
    if (existingEdgeKeys.has(key)) continue;
    existingEdgeKeys.add(key);

    newEdges.push({
      id: `edge_${now}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      source: sourceNode.id,
      target: targetNode.id,
      relation,
      weight: typeof ee.weight === 'number' ? ee.weight : 0.5,
      createdAt: now,
    });
  }

  return { updatedNodes, newEdges };
}

// Deterministic, always-on: creates/updates one session-type node the moment
// an interaction is saved, independent of any LLM call — guarantees the
// graph is populated even when Gemini extraction is degraded/offline.
export function buildSessionNode(
  userId: string,
  interaction: { id: string; title: string; mood?: MoodState },
  existingNode?: GraphNode
): GraphNode {
  const now = Date.now();
  return {
    id: `node_session_${interaction.id}`,
    userId,
    type: 'session',
    label: interaction.title || 'Vent Session',
    mood: interaction.mood,
    sourceSessionId: interaction.id,
    importance: existingNode?.importance ?? 0.5,
    createdAt: existingNode?.createdAt ?? now,
    lastReferencedAt: now,
    referenceCount: (existingNode?.referenceCount ?? 0) + 1,
  };
}
