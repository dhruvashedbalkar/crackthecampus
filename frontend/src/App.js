// frontend/src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { MiniMap, Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';
import io from 'socket.io-client';
import './App.css';
import { Sun, Moon, Zap, Cpu, Database, ServerCrash, RotateCcw, Wrench } from 'lucide-react';

const socket = io('http://localhost:4001');

// --- Initial Architecture Definition ---
const initialNodes = [
  { id: 'load-balancer', type: 'input', position: { x: 0, y: 150 }, data: { label: 'Load Balancer' } },
  { id: 'api-1', position: { x: 250, y: 75 }, data: { label: 'API Service 1' } },
  { id: 'api-2', position: { x: 250, y: 225 }, data: { label: 'API Service 2' } },
  { id: 'db-primary', type: 'output', position: { x: 500, y: 75 }, data: { label: 'Primary DB' } },
  { id: 'db-replica', type: 'output', position: { x: 500, y: 225 }, data: { label: 'Replica DB' } },
];

const initialEdges = [
  { id: 'e-lb-a1', source: 'load-balancer', target: 'api-1', animated: true },
  { id: 'e-lb-a2', source: 'load-balancer', target: 'api-2', animated: true },
  { id: 'e-a1-db', source: 'api-1', target: 'db-primary', animated: true },
  { id: 'e-a2-db', source: 'api-2', target: 'db-primary', animated: true },
  { id: 'e-db-sync', source: 'db-primary', target: 'db-replica', label: 'sync' },
];

const statusStyles = {
  healthy: { background: 'var(--color-bg-healthy)', label: 'Healthy' },
  anomaly: { background: 'var(--color-bg-anomaly)', label: 'High CPU' },
  degraded: { background: 'var(--color-bg-degraded)', label: 'Degraded' },
  down: { background: 'var(--color-bg-down)', label: 'Down' },
};

function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [edges, setEdges] = useState(initialEdges);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [suggestedAction, setSuggestedAction] = useState(null);

  const handleSystemUpdate = useCallback((systemState) => {
    setLatestUpdate(systemState);

    // 1. Determine the suggested remediation action based on the failure
    let action = null;
    if (systemState['api-1']?.status === 'anomaly') {
      action = { type: 'SCALE_API', label: 'Scale Up API-1 Instance' };
    } else if (systemState['api-2']?.status === 'down') {
      action = { type: 'RESTART_API', label: 'Restart API-2 Service' };
    } else if (systemState['db-primary']?.status === 'down' && !systemState.hasFailedOver) {
      action = { type: 'FAILOVER_DB', label: 'Failover to Replica DB' };
    }
    setSuggestedAction(action);
    
    // 2. Visually update the nodes based on their status
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const serviceState = systemState[node.id];
        if (serviceState) {
          const style = statusStyles[serviceState.status] || {};
          let label = node.data.initialLabel || node.data.label;
          if (serviceState.cpu) {
            label += `\nCPU: ${(serviceState.cpu * 100).toFixed(0)}%`;
          }
          return {
            ...node,
            data: { ...node.data, label, initialLabel: node.data.initialLabel || node.data.label },
            style: {
              ...node.style,
              background: style.background,
              color: 'var(--color-text-node)',
              border: serviceState.status === 'down' ? '2px dashed var(--color-dot-anomaly)' : '1px solid var(--color-border)',
            },
          };
        }
        return node;
      })
    );

    // 3. Visually update the EDGES to show the DB failover
    if (systemState.hasFailedOver) {
      setEdges(currentEdges => currentEdges.map(edge => {
        if (edge.id === 'e-a1-db' || edge.id === 'e-a2-db') {
          return { ...edge, target: 'db-replica', style: { stroke: '#4ade80' } }; // Point to replica with green color
        }
        return edge;
      }));
    } else {
      setEdges(initialEdges); // Reset edges if system is reset
    }

  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    socket.on('system-update', handleSystemUpdate);
    return () => socket.off('system-update', handleSystemUpdate);
  }, [isDarkMode, handleSystemUpdate]);

  const triggerSimulation = (type) => socket.emit('trigger-simulation', { type });
  const triggerRemediation = () => {
    if (suggestedAction) {
      socket.emit('trigger-remediation', suggestedAction);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1><Zap size={24} style={{ marginRight: '10px' }}/>Resilio</h1>
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle">
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>
      <main className="main-content">
        <div className="graph-container">
          <ReactFlow nodes={nodes} edges={edges} fitView>
            <Background />
            <Controls />
          </ReactFlow>
        </div>
        <div className="controls-container">
          <h2><ServerCrash size={18} /> Simulation Controls</h2>
          <div className="controls-grid">
            {/* ... simulation buttons ... */}
            <button onClick={() => triggerSimulation('CPU_OVERLOAD')}> <Cpu size={16} /> Trigger High CPU </button>
            <button onClick={() => triggerSimulation('API_FAILURE')}> <ServerCrash size={16} /> Kill API-2 </button>
            <button onClick={() => triggerSimulation('DB_FAILURE')}> <Database size={16} /> Kill Primary DB </button>
            <button className="reset-button" onClick={() => triggerSimulation('RESET')}> <RotateCcw size={16} /> Reset System </button>
          </div>
          
          {/* 4. The new Suggested Actions panel */}
          {suggestedAction && (
            <div className="remediation-panel">
              <h3><Wrench size={16}/> Suggested Action</h3>
              <p>An anomaly has been detected. The following action is recommended to restore system health.</p>
              <button className="remediation-button" onClick={triggerRemediation}>
                {suggestedAction.label}
              </button>
            </div>
          )}

          <div className="status-panel">
             {/* ... status panel ... */}
             <h3>System Status</h3>
             {latestUpdate && Object.entries(latestUpdate).map(([key, value]) => {
              if (typeof value === 'object' && value !== null) {
                const style = statusStyles[value.status] || {};
                return ( <div key={key} className="status-item"> <span>{key}</span> <span className="status-badge" style={{ backgroundColor: style.background }}> {style.label} </span> </div>);
              }
              return null;
            })}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;