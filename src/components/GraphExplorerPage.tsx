import React, { useState, useRef, useEffect, useMemo } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { ForceGraphMethods } from 'react-force-graph-3d';
import { ArrowLeft, Sparkles } from 'lucide-react';
import type { GraphNode, GraphEdge, JournalInteraction } from '../types';
import { getNodeColor, getNodeBaseSize } from '../utils/graphNodeColors';
import { GraphNodeInspector } from './GraphNodeInspector';

interface GraphExplorerPageProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  interactions: JournalInteraction[];
  onClose: () => void;
  onRevisitSession: (interactionId: string) => void;
}

export const GraphExplorerPage: React.FC<GraphExplorerPageProps> = ({
  nodes,
  edges,
  interactions,
  onClose,
  onRevisitSession,
}) => {
  const fgRef = useRef<ForceGraphMethods<any, any> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const graphData = useMemo(() => ({ nodes, links: edges }), [nodes, edges]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleNodeClick = (node: any) => {
    setSelectedNodeId(node.id);
    if (fgRef.current && typeof node.x === 'number') {
      const distance = 120;
      const dist = Math.hypot(node.x, node.y, node.z || 0.001) || 1;
      const distRatio = 1 + distance / dist;
      fgRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: (node.z || 0) * distRatio },
        node,
        1000
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#06060A] text-[#F3F0EB]">
      {/* Header bar */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-[#06060A] to-transparent pointer-events-none">
        <button
          onClick={onClose}
          className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#12121D]/80 backdrop-blur border border-[#26263A] text-xs font-mono text-[#A09CB2] hover:text-[#F3F0EB] hover:border-[#FF6B4A]/60 transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>back</span>
        </button>
        <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#12121D]/80 backdrop-blur border border-[#26263A] text-xs font-mono text-[#A09CB2]">
          <Sparkles className="w-3.5 h-3.5 text-[#FF6B4A]" />
          <span>{nodes.length} reflections &bull; {edges.length} connections</span>
        </div>
      </div>

      {/* 3D Graph */}
      <div ref={containerRef} className="w-full h-full">
        {nodes.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-center px-6">
            <span className="text-4xl mb-3">🕸️</span>
            <p className="font-serif text-lg text-[#F3F0EB] mb-1">Your reflections are still forming.</p>
            <p className="text-xs text-[#8E8A9F] font-mono max-w-xs">
              Keep talking to Chronicle — every vent session adds new stars to this map.
            </p>
          </div>
        ) : (
          <ForceGraph3D
            ref={fgRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#06060A"
            nodeId="id"
            nodeLabel={(node: any) => node.label}
            nodeColor={(node: any) => (node.id === selectedNodeId ? '#FFFFFF' : getNodeColor(node))}
            nodeVal={(node: any) => getNodeBaseSize(node.type) * (node.id === selectedNodeId ? 2.2 : 1)}
            nodeOpacity={0.9}
            linkColor={() => 'rgba(255,138,110,0.35)'}
            linkWidth={(link: any) => Math.max(1, (link.weight || 0.5) * 2)}
            linkDirectionalParticles={1}
            linkDirectionalParticleWidth={1.4}
            linkDirectionalParticleColor={() => 'rgba(255,138,110,0.7)'}
            linkDirectionalParticleSpeed={0.004}
            onNodeClick={handleNodeClick}
            onBackgroundClick={() => setSelectedNodeId(null)}
            showNavInfo={false}
          />
        )}
      </div>

      <GraphNodeInspector
        node={selectedNode}
        interactions={interactions}
        onClose={() => setSelectedNodeId(null)}
        onRevisitSession={onRevisitSession}
      />
    </div>
  );
};
