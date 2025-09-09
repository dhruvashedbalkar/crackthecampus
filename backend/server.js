// server.js

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

// Set up Socket.IO with CORS policy to allow our React app (on port 3000) to connect
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["my-custom-header"]
  },
  transports: ['websocket', 'polling']
});

const PORT = 4001;

// Global system state that we'll modify based on simulations
let currentSystemState = {
  'load-balancer': { status: 'healthy', cpu: 0.2, memory: 0.3, latency: 20, requests: 0 },
  'api-1': { status: 'healthy', cpu: 0.3, memory: 0.4, latency: 50, requests: 0 },
  'api-2': { status: 'healthy', cpu: 0.3, memory: 0.4, latency: 50, requests: 0 },
  'db-primary': { status: 'healthy', cpu: 0.4, memory: 0.5, latency: 30, requests: 0 },
  'db-replica': { status: 'healthy', cpu: 0.2, memory: 0.3, latency: 35, requests: 0 }
};

// Historical data for analytics
let systemHistory = [];

// Store the last 30 minutes of data (at 2-second intervals)
const MAX_HISTORY_LENGTH = 900;

// Function to record current state in history
function recordSystemState() {
  // Add timestamp to current state
  const stateWithTimestamp = {
    timestamp: new Date(),
    state: JSON.parse(JSON.stringify(currentSystemState))
  };
  
  systemHistory.push(stateWithTimestamp);
  
  // Keep history at a reasonable size
  if (systemHistory.length > MAX_HISTORY_LENGTH) {
    systemHistory.shift();
  }
}

// Flag to track if we're in a simulated failure state
let simulationActive = false;

// Track active incidents for the incident timeline
let incidents = [];
let incidentId = 1;

// Function to create a new incident
function createIncident(type, description, affectedServices) {
  const incident = {
    id: incidentId++,
    type,
    description,
    affectedServices,
    startTime: new Date(),
    endTime: null,
    status: 'active'
  };
  
  incidents.push(incident);
  return incident;
}

// Function to resolve an incident
function resolveIncident(type) {
  const activeIncident = incidents.find(inc => inc.type === type && inc.status === 'active');
  
  if (activeIncident) {
    activeIncident.endTime = new Date();
    activeIncident.status = 'resolved';
    
    // Calculate duration in seconds
    const duration = (activeIncident.endTime - activeIncident.startTime) / 1000;
    activeIncident.duration = duration;
    
    return activeIncident;
  }
  
  return null;
}

// This block runs whenever a new user connects to our server
io.on('connection', (socket) => {
  console.log('✅ A user connected');

  // Handle simulation triggers from frontend
  socket.on('trigger-simulation', (data) => {
    console.log('Received simulation trigger:', data.type);
    
    switch(data.type) {
      case 'CPU_OVERLOAD':
        // Simulate high CPU on API-1
        currentSystemState['api-1'].status = 'anomaly';
        currentSystemState['api-1'].cpu = 0.95; // 95% CPU
        currentSystemState['api-1'].memory = 0.8; // 80% Memory
        currentSystemState['api-1'].latency = 200; // 200ms latency
        simulationActive = true;
        createIncident('CPU_OVERLOAD', 'High CPU utilization detected on API Service 1', ['api-1']);
        console.log('Simulating CPU overload on API-1');
        break;
        
      case 'API_FAILURE':
        // Simulate API-2 failure
        currentSystemState['api-2'].status = 'down';
        currentSystemState['api-2'].cpu = 0;
        currentSystemState['api-2'].memory = 0;
        currentSystemState['api-2'].latency = 5000; // 5s latency (timeout)
        simulationActive = true;
        createIncident('API_FAILURE', 'API Service 2 is down', ['api-2']);
        console.log('Simulating API-2 failure');
        break;
        
      case 'DB_FAILURE':
        // Simulate Primary DB failure
        currentSystemState['db-primary'].status = 'down';
        currentSystemState['db-primary'].cpu = 0;
        currentSystemState['db-primary'].memory = 0;
        currentSystemState['db-primary'].latency = 5000;
        // When primary DB fails, services that depend on it degrade
        currentSystemState['api-1'].status = 'degraded';
        currentSystemState['api-2'].status = 'degraded';
        currentSystemState['api-1'].latency = 300;
        currentSystemState['api-2'].latency = 300;
        simulationActive = true;
        createIncident('DB_FAILURE', 'Primary Database failure detected', ['db-primary', 'api-1', 'api-2']);
        console.log('Simulating Primary DB failure');
        break;
        
      case 'TRAFFIC_SPIKE':
        // Simulate traffic spike on load balancer and APIs
        currentSystemState['load-balancer'].status = 'anomaly';
        currentSystemState['load-balancer'].cpu = 0.85;
        currentSystemState['load-balancer'].memory = 0.7;
        currentSystemState['load-balancer'].latency = 150;
        currentSystemState['load-balancer'].requests = 2000;
        
        currentSystemState['api-1'].status = 'anomaly';
        currentSystemState['api-1'].cpu = 0.8;
        currentSystemState['api-1'].memory = 0.75;
        currentSystemState['api-1'].latency = 250;
        currentSystemState['api-1'].requests = 1200;
        
        currentSystemState['api-2'].status = 'anomaly';
        currentSystemState['api-2'].cpu = 0.8;
        currentSystemState['api-2'].memory = 0.75;
        currentSystemState['api-2'].latency = 250;
        currentSystemState['api-2'].requests = 800;
        
        simulationActive = true;
        createIncident('TRAFFIC_SPIKE', 'Sudden traffic spike detected', ['load-balancer', 'api-1', 'api-2']);
        console.log('Simulating traffic spike');
        break;
        
      case 'MEMORY_LEAK':
        // Simulate memory leak in API-1
        currentSystemState['api-1'].status = 'anomaly';
        currentSystemState['api-1'].memory = 0.95; // 95% Memory
        simulationActive = true;
        createIncident('MEMORY_LEAK', 'Memory leak detected in API Service 1', ['api-1']);
        console.log('Simulating memory leak in API-1');
        
        // Set up progressive memory increase
        const memoryLeakInterval = setInterval(() => {
          if (!simulationActive) {
            clearInterval(memoryLeakInterval);
            return;
          }
          
          currentSystemState['api-1'].memory = Math.min(0.99, currentSystemState['api-1'].memory + 0.01);
          if (currentSystemState['api-1'].memory >= 0.99) {
            // Service crashes at 99% memory
            currentSystemState['api-1'].status = 'down';
            currentSystemState['api-1'].cpu = 0;
            clearInterval(memoryLeakInterval);
          }
          
          io.emit('system-update', currentSystemState);
        }, 5000); // Increase every 5 seconds
        break;
        
      case 'CASCADING_FAILURE':
        // Simulate cascading failure starting from load balancer
        currentSystemState['load-balancer'].status = 'down';
        currentSystemState['load-balancer'].cpu = 0;
        currentSystemState['load-balancer'].memory = 0;
        simulationActive = true;
        createIncident('CASCADING_FAILURE', 'Cascading failure starting from Load Balancer', ['load-balancer']);
        console.log('Simulating cascading failure');
        
        // After 3 seconds, APIs start failing
        setTimeout(() => {
          if (simulationActive) {
            currentSystemState['api-1'].status = 'down';
            currentSystemState['api-1'].cpu = 0;
            currentSystemState['api-1'].memory = 0;
            io.emit('system-update', currentSystemState);
          }
        }, 3000);
        
        // After 6 seconds, API-2 fails
        setTimeout(() => {
          if (simulationActive) {
            currentSystemState['api-2'].status = 'down';
            currentSystemState['api-2'].cpu = 0;
            currentSystemState['api-2'].memory = 0;
            io.emit('system-update', currentSystemState);
          }
        }, 6000);
        
        // After 10 seconds, databases become inaccessible
        setTimeout(() => {
          if (simulationActive) {
            currentSystemState['db-primary'].status = 'down';
            currentSystemState['db-primary'].cpu = 0;
            currentSystemState['db-primary'].memory = 0;
            currentSystemState['db-replica'].status = 'down';
            currentSystemState['db-replica'].cpu = 0;
            currentSystemState['db-replica'].memory = 0;
            io.emit('system-update', currentSystemState);
          }
        }, 10000);
        break;
        
      case 'RESET':
        // Reset all services to healthy
        Object.keys(currentSystemState).forEach(key => {
          currentSystemState[key].status = 'healthy';
          currentSystemState[key].cpu = 0.2 + (Math.random() * 0.3); // 20-50% CPU
          currentSystemState[key].memory = 0.3 + (Math.random() * 0.2); // 30-50% Memory
          currentSystemState[key].latency = key.includes('db') ? 30 + (Math.random() * 10) : 50 + (Math.random() * 20);
          currentSystemState[key].requests = 0;
        });
        simulationActive = false;
        
        // Resolve all active incidents
        ['CPU_OVERLOAD', 'API_FAILURE', 'DB_FAILURE', 'TRAFFIC_SPIKE', 'MEMORY_LEAK', 'CASCADING_FAILURE'].forEach(type => {
          resolveIncident(type);
        });
        
        console.log('System reset to healthy state');
        break;
        
      default:
        console.log('Unknown simulation type:', data.type);
    }
    
    // Record the state for historical data
    recordSystemState();
    
    // Immediately emit the updated state after simulation
    io.emit('system-update', currentSystemState);
    
    // Also emit the updated incidents list
    io.emit('incidents-update', incidents);
  });

  // Disconnect event
  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// This is our main data generator. It runs every 2 seconds.
setInterval(() => {
  // Only introduce random anomalies if no simulation is active
  if (!simulationActive && Math.random() < 0.1) {
    const services = Object.keys(currentSystemState);
    const randomService = services[Math.floor(Math.random() * services.length)];
    const anomalyType = Math.random() < 0.7 ? 'anomaly' : 'degraded';
    
    currentSystemState[randomService].status = anomalyType;
    if (anomalyType === 'anomaly') {
      currentSystemState[randomService].cpu = 0.8 + (Math.random() * 0.2); // 80-100% CPU
      currentSystemState[randomService].memory = 0.7 + (Math.random() * 0.2); // 70-90% Memory
      currentSystemState[randomService].latency = currentSystemState[randomService].latency * 2; // Double latency
      
      // Create an incident for this random anomaly
      createIncident('RANDOM_ANOMALY', `Anomaly detected in ${randomService}`, [randomService]);
    }
  }
  
  // Update metrics with small random fluctuations for healthy services
  Object.keys(currentSystemState).forEach(service => {
    if (currentSystemState[service].status === 'healthy') {
      // Add small random fluctuations to CPU for healthy services
      let baseCpu = 0;
      let baseMemory = 0;
      let baseLatency = 0;
      
      switch(service) {
        case 'load-balancer': 
          baseCpu = 0.2; 
          baseMemory = 0.3;
          baseLatency = 20;
          break;
        case 'api-1': 
          baseCpu = 0.3; 
          baseMemory = 0.4;
          baseLatency = 50;
          break;
        case 'api-2': 
          baseCpu = 0.3; 
          baseMemory = 0.4;
          baseLatency = 50;
          break;
        case 'db-primary': 
          baseCpu = 0.4; 
          baseMemory = 0.5;
          baseLatency = 30;
          break;
        case 'db-replica': 
          baseCpu = 0.2; 
          baseMemory = 0.3;
          baseLatency = 35;
          break;
        default: 
          baseCpu = 0.3;
          baseMemory = 0.4;
          baseLatency = 40;
      }
      
      // Add fluctuation of ±10% to CPU
      currentSystemState[service].cpu = baseCpu + (Math.random() * 0.2 - 0.1);
      // Ensure CPU stays between 0 and 1
      currentSystemState[service].cpu = Math.max(0, Math.min(1, currentSystemState[service].cpu));
      
      // Add fluctuation to memory
      currentSystemState[service].memory = baseMemory + (Math.random() * 0.2 - 0.1);
      currentSystemState[service].memory = Math.max(0, Math.min(1, currentSystemState[service].memory));
      
      // Add fluctuation to latency (±20%)
      currentSystemState[service].latency = baseLatency + (baseLatency * (Math.random() * 0.4 - 0.2));
      currentSystemState[service].latency = Math.max(5, currentSystemState[service].latency);
      
      // Simulate some request traffic
      if (service === 'load-balancer') {
        currentSystemState[service].requests = Math.floor(Math.random() * 100);
      } else if (service.includes('api')) {
        currentSystemState[service].requests = Math.floor(Math.random() * 50);
      }
    }
  });

  // Record the state for historical data
  recordSystemState();

  // Emit the system state to all connected clients
  io.emit('system-update', currentSystemState);
  
  // Also emit the updated incidents list (every 10 seconds to reduce traffic)
  if (Math.random() < 0.2) {
    io.emit('incidents-update', incidents);
  }
  
  // Emit historical data for analytics (every 30 seconds)
  if (Math.random() < 0.07) {
    io.emit('history-update', systemHistory);
  }
  
  console.log('Emitting system update');

}, 2000); // Runs every 2000ms (2 seconds)


// Add API endpoints for data access
app.get('/api/system/current', (req, res) => {
  res.json(currentSystemState);
});

app.get('/api/system/history', (req, res) => {
  res.json(systemHistory);
});

app.get('/api/incidents', (req, res) => {
  res.json(incidents);
});

// Add health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

server.listen(PORT, () => {
  console.log(`🚀 Backend server listening on http://localhost:${PORT}`);
  console.log(`🔍 Health check available at http://localhost:${PORT}/health`);
  console.log(`📊 API endpoints available at:`);
  console.log(`   - http://localhost:${PORT}/api/system/current`);
  console.log(`   - http://localhost:${PORT}/api/system/history`);
  console.log(`   - http://localhost:${PORT}/api/incidents`);
});