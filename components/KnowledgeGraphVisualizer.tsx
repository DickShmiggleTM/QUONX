import React, { useEffect, useRef, useState, useMemo } from 'react';
import { GraphNode, Edge } from '../types.ts';

interface NodePosition {
    id: string;
    x: number;
    y: number;
    fx?: number;
    fy?: number;
    node: GraphNode;
}

const getNodeColor = (type: GraphNode['type']) => {
    switch (type) {
        case 'file': return '#2E8B57'; // SeaGreen
        case 'function-def': return '#4682B4'; // SteelBlue
        case 'class-def': return '#DAA520'; // GoldenRod
        case 'call': return '#6A5ACD'; // SlateBlue
        case 'user-prompt': return '#32CD32'; // LimeGreen
        case 'ai-response': return '#FF6347'; // Tomato
        case 'file-edit': return '#FFD700'; // Gold
        default: return '#A9A9A9'; // DarkGray
    }
};

const KnowledgeGraphVisualizer: React.FC<{ nodes: GraphNode[], edges: Edge[] }> = ({ nodes, edges }) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const [positions, setPositions] = useState<Map<string, NodePosition>>(new Map());
    const [draggedNode, setDraggedNode] = useState<string | null>(null);

    const filteredNodes = useMemo(() => {
        // Simple filter to keep the graph manageable for visualization
        const allNodeIds = new Set(nodes.map(n => n.id));
        const relevantNodeIds = new Set<string>();
        
        edges.forEach(edge => {
            if(allNodeIds.has(edge.sourceId) && allNodeIds.has(edge.targetId)){
                relevantNodeIds.add(edge.sourceId);
                relevantNodeIds.add(edge.targetId);
            }
        });

        // Add some isolated nodes if the graph is small
        if (relevantNodeIds.size < 20) {
            nodes.slice(0, 20 - relevantNodeIds.size).forEach(n => relevantNodeIds.add(n.id));
        }
        
        return nodes.filter(n => relevantNodeIds.has(n.id));

    }, [nodes, edges]);

    useEffect(() => {
        const width = svgRef.current?.clientWidth || 500;
        const height = svgRef.current?.clientHeight || 500;
        
        setPositions(prev => {
            const newPositions = new Map<string, NodePosition>();
            filteredNodes.forEach(node => {
                const existing = prev.get(node.id);
                newPositions.set(node.id, {
                    id: node.id,
                    x: existing?.x || Math.random() * width,
                    y: existing?.y || Math.random() * height,
                    node,
                });
            });
            return newPositions;
        });
    }, [filteredNodes]);

    useEffect(() => {
        const simulation = () => {
            const width = svgRef.current?.clientWidth || 500;
            const height = svgRef.current?.clientHeight || 500;

            setPositions(currentPositions => {
                const newPositions = new Map(currentPositions);
                const posArray = Array.from(newPositions.values());

                posArray.forEach(p => {
                    if (p.id === draggedNode) return;

                    // Repulsion force
                    posArray.forEach(other => {
                        if (p.id === other.id) return;
                        const dx = p.x - other.x;
                        const dy = p.y - other.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        if (distance < 150) {
                            p.x += dx / distance * 2;
                            p.y += dy / distance * 2;
                        }
                    });

                    // Attraction force
                    edges.forEach(edge => {
                        if (edge.sourceId === p.id && newPositions.has(edge.targetId)) {
                            const target = newPositions.get(edge.targetId)!;
                            p.x -= (p.x - target.x) * 0.01;
                            p.y -= (p.y - target.y) * 0.01;
                        }
                        if (edge.targetId === p.id && newPositions.has(edge.sourceId)) {
                            const source = newPositions.get(edge.sourceId)!;
                            p.x -= (p.x - source.x) * 0.01;
                            p.y -= (p.y - source.y) * 0.01;
                        }
                    });
                    
                    // Center gravity
                    p.x -= (p.x - width / 2) * 0.005;
                    p.y -= (p.y - height / 2) * 0.005;

                    // Boundary check
                    p.x = Math.max(10, Math.min(width - 10, p.x));
                    p.y = Math.max(10, Math.min(height - 10, p.y));
                });
                
                return new Map(posArray.map(p => [p.id, p]));
            });
        };

        const interval = setInterval(simulation, 30);
        return () => clearInterval(interval);
    }, [edges, draggedNode]);

    const handleMouseDown = (id: string) => {
        setDraggedNode(id);
        setPositions(prev => {
            const newPos = new Map(prev);
            const node = newPos.get(id);
            if (node) {
                node.fx = node.x;
                node.fy = node.y;
            }
            return newPos;
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggedNode || !svgRef.current) return;
        const rect = svgRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setPositions(prev => {
            const newPos = new Map(prev);
            const node = newPos.get(draggedNode);
            if (node) {
                node.x = x;
                node.y = y;
            }
            return newPos;
        });
    };

    const handleMouseUp = () => {
         setPositions(prev => {
            const newPos = new Map(prev);
            const node = newPos.get(draggedNode!);
            if (node) {
                delete node.fx;
                delete node.fy;
            }
            return newPos;
        });
        setDraggedNode(null);
    };

    if (nodes.length === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">Memory graph is empty.</div>;
    }
    
    const posArray = Array.from(positions.values());

    return (
        <svg ref={svgRef} width="100%" height="100%" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <g>
                {edges.map((edge, i) => {
                    const source = positions.get(edge.sourceId);
                    const target = positions.get(edge.targetId);
                    if (!source || !target) return null;
                    return <line key={i} x1={source.x} y1={source.y} x2={target.x} y2={target.y} stroke="#00ff00" strokeOpacity="0.3" />;
                })}
            </g>
            <g>
                {posArray.map(pos => (
                     <g key={pos.id} transform={`translate(${pos.x}, ${pos.y})`} onMouseDown={() => handleMouseDown(pos.id)} className="cursor-pointer">
                        <circle r="5" fill={getNodeColor(pos.node.type)} />
                        <text x="8" y="3" fontSize="10" fill="#FFFFFF" className="select-none">
                            {pos.node.name}
                        </text>
                    </g>
                ))}
            </g>
        </svg>
    );
};

export default KnowledgeGraphVisualizer;
