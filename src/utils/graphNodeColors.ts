import type { GraphNode, GraphNodeType } from '../types';
import { getMoodGradient } from './moodPalette';

// Static per-type colors for nodes with no mood data of their own. `session`
// and `mood_moment` nodes that DO carry a mood snapshot are colored from the
// same mood palette the background uses (see getNodeColor below), so the
// graph and the app's atmosphere read as one coherent color language.
const NODE_TYPE_COLORS: Record<GraphNodeType, string> = {
  session: '#8E8A9F',
  memory: '#6E9BD1',
  like: '#FF6B9D',
  dislike: '#5C5C7A',
  aspiration: '#FFC24B',
  person: '#4FD1C5',
  activity: '#9B7EDE',
  mood_moment: '#FF6B4A',
};

const NODE_TYPE_SIZE: Record<GraphNodeType, number> = {
  session: 3,
  memory: 3,
  like: 4,
  dislike: 4,
  aspiration: 5,
  person: 5,
  activity: 4,
  mood_moment: 3,
};

export function getNodeColor(node: GraphNode | GraphNodeType): string {
  if (typeof node === 'string') {
    return NODE_TYPE_COLORS[node] || '#8E8A9F';
  }
  if ((node.type === 'session' || node.type === 'mood_moment') && node.mood) {
    return getMoodGradient(node.mood).accent;
  }
  return NODE_TYPE_COLORS[node.type] || '#8E8A9F';
}

export function getNodeBaseSize(type: GraphNodeType): number {
  return NODE_TYPE_SIZE[type] || 3;
}

export const NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  session: 'Session',
  memory: 'Memory',
  like: 'Something they love',
  dislike: 'Something they dislike',
  aspiration: 'Who they’re becoming',
  person: 'Person',
  activity: 'Activity',
  mood_moment: 'Mood moment',
};
