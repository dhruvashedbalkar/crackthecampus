// frontend/src/App.js

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { Controls, Background } from 'reactflow';
import 'reactflow/dist/style.css';
import io from 'socket.io-client';
import './App.css';
import { Sun, Moon, Zap, Cpu, Database, ServerCrash, RotateCcw, Activity, AlertTriangle, Clock, BarChart2, Users, Layers, RefreshCw, DollarSign, AlertCircle } from 'lucide-react';

const socket = io('http://localhost:4001', {
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  transports: ['websocket', 'polling']
});

// 1. Define the new, more complex architecture
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

// 2. Map service statuses to UI styles
const statusStyles = {
  healthy: { background: 'var(--color-bg-healthy)', label: 'Healthy' },
  anomaly: { background: 'var(--color-bg-anomaly)', label: 'High Load' },
  degraded: { background: 'var(--color-bg-degraded)', label: 'Degraded' },
  down: { background: 'var(--color-bg-down)', label: 'Down' },
};

// Format timestamp for display
const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString();
};

// Format duration in seconds to readable format
const formatDuration = (seconds) => {
  if (!seconds) return '';
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
};

function App() {
  const [nodes, setNodes] = useState(initialNodes);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [latestUpdate, setLatestUpdate] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [systemHistory, setSystemHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, incidents, analytics
  const [businessMetrics, setBusinessMetrics] = useState({
    activeUsers: 10000,
    revenuePerMinute: 5000,
    errorRate: 0.01,
    lastUpdated: new Date()
  });

  const handleSystemUpdate = useCallback((systemState) => {
    setLatestUpdate(systemState); // Store the latest full state
    
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const serviceState = systemState[node.id];
        if (serviceState) {
          const style = statusStyles[serviceState.status] || {};
          let label = node.data.initialLabel || node.data.label;

          // Add more detailed metrics to the node label
          if (serviceState.cpu) {
            label += `\nCPU: ${(serviceState.cpu * 100).toFixed(0)}%`;
          }
          if (serviceState.memory) {
            label += `\nMEM: ${(serviceState.memory * 100).toFixed(0)}%`;
          }
          if (serviceState.latency) {
            label += `\nLAT: ${serviceState.latency.toFixed(0)}ms`;
          }
          if (serviceState.requests && serviceState.requests > 0) {
            label += `\nREQ: ${serviceState.requests}/s`;
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
  }, []);
  
  // Handle incidents updates from the server
  const handleIncidentsUpdate = useCallback((incidentsList) => {
    setIncidents(incidentsList);
  }, []);
  
  // Handle historical data updates
  const handleHistoryUpdate = useCallback((historyData) => {
    setSystemHistory(historyData);
  }, []);
  
  // Handle business metrics updates
  const handleBusinessMetricsUpdate = useCallback((metrics) => {
    setBusinessMetrics(metrics);
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    
    // Add socket connection event listeners for debugging
    socket.on('connect', () => {
      console.log('Connected to server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
    
    socket.on('system-update', handleSystemUpdate);
    socket.on('incidents-update', handleIncidentsUpdate);
    socket.on('history-update', handleHistoryUpdate);
    socket.on('business-metrics', handleBusinessMetricsUpdate);
    
    return () => {
      socket.off('connect');
      socket.off('connect_error');
      socket.off('system-update', handleSystemUpdate);
      socket.off('incidents-update', handleIncidentsUpdate);
      socket.off('history-update', handleHistoryUpdate);
      socket.off('business-metrics', handleBusinessMetricsUpdate);
    };
  }, [isDarkMode, handleSystemUpdate, handleIncidentsUpdate, handleHistoryUpdate, handleBusinessMetricsUpdate]);

  const triggerSimulation = (type) => {
    socket.emit('trigger-simulation', { type });
  };

  // Render the business impact dashboard
  const renderBusinessImpactDashboard = () => (
    <div className="business-impact-dashboard">
      <h2><DollarSign size={18} /> Business Impact Dashboard</h2>
      <div className="business-metrics-grid">
        <div className="metric-card">
          <h3><Users size={16} /> Active Users</h3>
          <div className="metric-value">{businessMetrics.activeUsers.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <h3><DollarSign size={16} /> Revenue / minute</h3>
          <div className="metric-value">${businessMetrics.revenuePerMinute.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <h3><AlertCircle size={16} /> Error Rate</h3>
          <div className="metric-value">{(businessMetrics.errorRate * 100).toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );

  // Render the dashboard tab content
  const renderDashboard = () => (
    <>
      {renderBusinessImpactDashboard()}
      
      <div className="graph-container">
        <ReactFlow nodes={nodes} edges={initialEdges} fitView>
          <Background />
          <Controls />
        </ReactFlow>
      </div>

      <div className="controls-container">
        <h2><ServerCrash size={18} /> Simulation Controls</h2>
        <div className="controls-grid">
          <button onClick={() => triggerSimulation('CPU_OVERLOAD')}>
            <Cpu size={16} /> Trigger High CPU on API-1
          </button>
          <button onClick={() => triggerSimulation('API_FAILURE')}>
            <ServerCrash size={16} /> Kill API-2
          </button>
          <button onClick={() => triggerSimulation('DB_FAILURE')}>
            <Database size={16} /> Kill Primary DB
          </button>
          <button onClick={() => triggerSimulation('TRAFFIC_SPIKE')}>
            <Users size={16} /> Traffic Spike
          </button>
          <button onClick={() => triggerSimulation('MEMORY_LEAK')}>
            <Layers size={16} /> Memory Leak
          </button>
          <button onClick={() => triggerSimulation('CASCADING_FAILURE')}>
            <AlertTriangle size={16} /> Cascading Failure
          </button>
          <button className="reset-button" onClick={() => triggerSimulation('RESET')}>
            <RotateCcw size={16} /> Reset System
          </button>
        </div>
        
        <div className="status-panel">
          <h3>System Status</h3>
          {latestUpdate && Object.entries(latestUpdate).map(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              const style = statusStyles[value.status] || {};
              return (
                <div key={key} className="status-item">
                  <span>{key}</span>
                  <div className="metrics-container">
                    <span className="status-badge" style={{ backgroundColor: style.background }}>
                      {style.label}
                    </span>
                    {value.cpu !== undefined && (
                      <span className="metric-badge">
                        CPU: {(value.cpu * 100).toFixed(0)}%
                      </span>
                    )}
                    {value.memory !== undefined && (
                      <span className="metric-badge">
                        MEM: {(value.memory * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    </>
  );

  // Render the incidents tab content
  const renderIncidents = () => (
    <div className="incidents-container">
      <h2><AlertTriangle size={18} /> Incident Timeline</h2>
      
      {incidents.length === 0 ? (
        <div className="empty-state">
          <p>No incidents recorded yet. Trigger a simulation to create incidents.</p>
        </div>
      ) : (
        <div className="timeline">
          {incidents.map(incident => (
            <div key={incident.id} className={`timeline-item ${incident.status}`}>
              <div className="timeline-header">
                <h3>{incident.description}</h3>
                <span className={`incident-status ${incident.status}`}>
                  {incident.status === 'active' ? 'ACTIVE' : 'RESOLVED'}
                </span>
              </div>
              <div className="timeline-meta">
                <span><Clock size={14} /> Started: {formatTime(incident.startTime)}</span>
                {incident.endTime && (
                  <span><RefreshCw size={14} /> Duration: {formatDuration(incident.duration)}</span>
                )}
              </div>
              <div className="affected-services">
                <h4>Affected Services:</h4>
                <div className="service-tags">
                  {incident.affectedServices.map(service => (
                    <span key={service} className="service-tag">{service}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Render the analytics tab content
  const renderAnalytics = () => {
    // Simple analytics visualization
    const hasHistory = systemHistory && systemHistory.length > 0;
    
    return (
      <div className="analytics-container">
        <h2><BarChart2 size={18} /> System Analytics</h2>
        
        {!hasHistory ? (
          <div className="empty-state">
            <p>Collecting system metrics... Check back soon for analytics.</p>
          </div>
        ) : (
          <div className="analytics-content">
            <div className="metrics-summary">
              <div className="metric-card">
                <h3>System Health Score</h3>
                <div className="metric-value">
                  {calculateHealthScore(latestUpdate)}%
                </div>
                <p>Based on current service status</p>
              </div>
              
              <div className="metric-card">
                <h3>Avg Response Time</h3>
                <div className="metric-value">
                  {calculateAvgLatency(latestUpdate)}ms
                </div>
                <p>Across all services</p>
              </div>
              
              <div className="metric-card">
                <h3>Incident Count</h3>
                <div className="metric-value">
                  {incidents.length}
                </div>
                <p>Total incidents recorded</p>
              </div>
            </div>
            
            <div className="history-preview">
              <h3>Recent Activity</h3>
              <div className="history-timeline">
                {systemHistory.slice(-5).map((entry, index) => {
                  const timestamp = new Date(entry.timestamp);
                  return (
                    <div key={index} className="history-item">
                      <span className="history-time">{formatTime(timestamp)}</span>
                      <div className="history-services">
                        {Object.entries(entry.state).map(([service, data]) => (
                          <span 
                            key={service} 
                            className={`history-service-status ${data.status}`}
                            title={`${service}: ${statusStyles[data.status]?.label || data.status}`}
                          >
                            {service}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };
  
  // Helper function to calculate health score
  const calculateHealthScore = (systemState) => {
    if (!systemState) return 100;
    
    const services = Object.values(systemState);
    const totalServices = services.length;
    let healthyCount = 0;
    
    services.forEach(service => {
      if (service.status === 'healthy') healthyCount += 1;
      else if (service.status === 'anomaly') healthyCount += 0.7;
      else if (service.status === 'degraded') healthyCount += 0.4;
      // Down services contribute 0
    });
    
    return Math.round((healthyCount / totalServices) * 100);
  };
  
  // Helper function to calculate average latency
  const calculateAvgLatency = (systemState) => {
    if (!systemState) return 0;
    
    const services = Object.values(systemState);
    let totalLatency = 0;
    let count = 0;
    
    services.forEach(service => {
      if (service.latency && service.latency < 5000) { // Exclude timeout values
        totalLatency += service.latency;
        count += 1;
      }
    });
    
    return count > 0 ? Math.round(totalLatency / count) : 0;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1><Zap size={24} style={{ marginRight: '10px' }}/>Resilio</h1>
        <div className="header-controls">
          <nav className="main-nav">
            <button 
              className={activeTab === 'dashboard' ? 'active' : ''}
              onClick={() => setActiveTab('dashboard')}
            >
              <Activity size={16} /> Dashboard
            </button>
            <button 
              className={activeTab === 'incidents' ? 'active' : ''}
              onClick={() => setActiveTab('incidents')}
            >
              <AlertTriangle size={16} /> Incidents
              {incidents.filter(i => i.status === 'active').length > 0 && (
                <span className="badge">{incidents.filter(i => i.status === 'active').length}</span>
              )}
            </button>
            <button 
              className={activeTab === 'analytics' ? 'active' : ''}
              onClick={() => setActiveTab('analytics')}
            >
              <BarChart2 size={16} /> Analytics
            </button>
          </nav>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="theme-toggle">
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'incidents' && renderIncidents()}
        {activeTab === 'analytics' && renderAnalytics()}
      </main>
    </div>
  );
}

export default App;