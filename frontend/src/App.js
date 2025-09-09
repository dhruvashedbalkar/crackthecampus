// src/App.js

import React, { useState, useEffect } from 'react';
import ReactFlow, { MiniMap, Controls } from 'reactflow';
import 'reactflow/dist/style.css';
import io from 'socket.io-client';
import './App.css';

// Establish connection to the backend server
const socket = io('http://localhost:4001');

// Define the initial nodes for our graph
const initialNodes = [
  { id: 'frontend', position: { x: 50, y: 150 }, data: { label: 'Frontend' }, style: { background: '#90EE90', padding: '10px', borderRadius: '5px', border: '1px solid #333' } },
  { id: 'api', position: { x: 300, y: 150 }, data: { label: 'API Service' }, style: { background: '#90EE90', padding: '10px', borderRadius: '5px', border: '1px solid #333' } },
  { id: 'db', position: { x: 550, y: 150 }, data: { label: 'Database' }, style: { background: '#90EE90', padding: '10px', borderRadius: '5px', border: '1px solid #333' } },
];

// Define the initial edges (the lines connecting the nodes)
const initialEdges = [
  { id: 'e1-2', source: 'frontend', target: 'api', animated: true },
  { id: 'e2-3', source: 'api', target: 'db', animated: true },
];

function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [recommendation, setRecommendation] = useState('');

  useEffect(() => {
    // Listen for 'new-log' events from the server
    socket.on('new-log', (log) => {
      if (log.serviceName === 'API') {
        // Update the nodes state immutably
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === 'api') {
              // Create a new node object to trigger a re-render
              const isAnomaly = log.status === 'anomaly';

              // Update recommendation text based on status
              setRecommendation(isAnomaly ? `CPU > 80% Detected. Suggested Action: Scale API Service by +1 instance.` : '');

              return {
                ...node,
                data: { label: `API Service\nCPU: ${(log.cpu_usage * 100).toFixed(0)}%` },
                style: { ...node.style, background: isAnomaly ? '#FF7F7F' : '#90EE90' }, // Red for anomaly, Green for healthy
              };
            }
            return node;
          })
        );
      }
    });

    // Clean up the socket connection when the component unmounts
    return () => {
      socket.off('new-log');
    };
  }, []);

  return (
    <div className="App">
      <h1>Resilio: IT Outage Simulator</h1>
      {recommendation && (
        <div className="recommendation-popup">
          <strong>Recommendation:</strong>
          <p>{recommendation}</p>
        </div>
      )}
      <div style={{ height: '70vh', border: '1px solid #ddd' }}>
        <ReactFlow nodes={nodes} edges={initialEdges} fitView>
          <MiniMap />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default App;