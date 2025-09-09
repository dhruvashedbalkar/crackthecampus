// src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';
import io from 'socket.io-client';
import './App.css';
import { Sun, Moon } from 'lucide-react'; // A nice icon library for the toggle

// Establish connection to the backend server
const socket = io('http://localhost:4001');

// Define the initial nodes for our graph
const initialNodes = [
  { id: 'frontend', position: { x: 50, y: 150 }, data: { label: 'Frontend Service' }, type: 'input' },
  { id: 'api', position: { x: 300, y: 150 }, data: { label: 'API Service' } },
  { id: 'db', position: { x: 550, y: 150 }, data: { label: 'Database' }, type: 'output' },
];

// Define the initial edges (the lines connecting the nodes)
const initialEdges = [
  { id: 'e1-2', source: 'frontend', target: 'api', animated: true, style: { strokeWidth: 2 } },
  { id: 'e2-3', source: 'api', target: 'db', animated: true, style: { strokeWidth: 2 } },
];


function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [logs, setLogs] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(true); // Default to dark mode

  const handleLog = useCallback((log) => {
    // Add the new log to the beginning of the array, keeping only the latest 20
    setLogs(prevLogs => [log, ...prevLogs].slice(0, 20));

    // Update the visual state of the API node
    if (log.serviceName === 'API') {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id === 'api') {
            const isAnomaly = log.status === 'anomaly';
            return {
              ...node,
              data: { label: `API Service\nCPU: ${(log.cpu_usage * 100).toFixed(0)}%` },
              style: { 
                ...node.style, 
                background: isAnomaly ? 'var(--color-bg-anomaly)' : 'var(--color-bg-healthy)',
                color: 'var(--color-text-node)',
              },
            };
          }
          return node;
        })
      );
    }
  }, []);

  useEffect(() => {
    // Set the data-theme attribute on the body for CSS to pick up
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');

    // Listen for 'new-log' events from the server
    socket.on('new-log', handleLog);

    // Clean up the socket connection when the component unmounts
    return () => {
      socket.off('new-log', handleLog);
    };
  }, [isDarkMode, handleLog]);
  
  // Find the latest anomaly to display a persistent recommendation
  const latestAnomaly = logs.find(log => log.status === 'anomaly');

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Resilio: IT Outage Simulator</h1>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle">
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main className="main-content">
        <div className="graph-container">
           <ReactFlow 
            nodes={nodes} 
            edges={initialEdges} 
            fitView
            nodesDraggable={false}
            nodesConnectable={false}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <div className="log-container">
          <h2>Live Logs</h2>
          {latestAnomaly && (
            <div className="recommendation-banner">
              <strong>Active Alert:</strong>
              <p>CPU &gt; 80% Detected. Suggested Action: Scale API Service by +1 instance.</p>
            </div>
          )}
          <div className="log-list">
            {logs.map((log, index) => (
              <div key={index} className={`log-item ${log.status}`}>
                <span className="log-status-dot"></span>
                <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="log-message">
                  {log.serviceName} - CPU at <strong>{(log.cpu_usage * 100).toFixed(0)}%</strong>
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;