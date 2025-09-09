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
  'load-balancer': { status: 'healthy', cpu: 0.2 },
  'api-1': { status: 'healthy', cpu: 0.3 },
  'api-2': { status: 'healthy', cpu: 0.3 },
  'db-primary': { status: 'healthy', cpu: 0.4 },
  'db-replica': { status: 'healthy', cpu: 0.2 }
};

// Flag to track if we're in a simulated failure state
let simulationActive = false;

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
        simulationActive = true;
        console.log('Simulating CPU overload on API-1');
        break;
        
      case 'API_FAILURE':
        // Simulate API-2 failure
        currentSystemState['api-2'].status = 'down';
        currentSystemState['api-2'].cpu = 0;
        simulationActive = true;
        console.log('Simulating API-2 failure');
        break;
        
      case 'DB_FAILURE':
        // Simulate Primary DB failure
        currentSystemState['db-primary'].status = 'down';
        currentSystemState['db-primary'].cpu = 0;
        // When primary DB fails, services that depend on it degrade
        currentSystemState['api-1'].status = 'degraded';
        currentSystemState['api-2'].status = 'degraded';
        simulationActive = true;
        console.log('Simulating Primary DB failure');
        break;
        
      case 'RESET':
        // Reset all services to healthy
        Object.keys(currentSystemState).forEach(key => {
          currentSystemState[key].status = 'healthy';
          currentSystemState[key].cpu = 0.2 + (Math.random() * 0.3); // 20-50% CPU
        });
        simulationActive = false;
        console.log('System reset to healthy state');
        break;
        
      default:
        console.log('Unknown simulation type:', data.type);
    }
    
    // Immediately emit the updated state after simulation
    io.emit('system-update', currentSystemState);
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
    }
  }
  
  // Update CPU values with small random fluctuations for healthy services
  Object.keys(currentSystemState).forEach(service => {
    if (currentSystemState[service].status === 'healthy') {
      // Add small random fluctuations to CPU for healthy services
      let baseCpu = 0;
      switch(service) {
        case 'load-balancer': baseCpu = 0.2; break; // Base 20%
        case 'api-1': baseCpu = 0.3; break; // Base 30%
        case 'api-2': baseCpu = 0.3; break; // Base 30%
        case 'db-primary': baseCpu = 0.4; break; // Base 40%
        case 'db-replica': baseCpu = 0.2; break; // Base 20%
        default: baseCpu = 0.3;
      }
      
      // Add fluctuation of ±10%
      currentSystemState[service].cpu = baseCpu + (Math.random() * 0.2 - 0.1);
      // Ensure CPU stays between 0 and 1
      currentSystemState[service].cpu = Math.max(0, Math.min(1, currentSystemState[service].cpu));
    }
  });

  // Emit the system state to all connected clients
  io.emit('system-update', currentSystemState);
  console.log('Emitting system update:', currentSystemState);

}, 2000); // Runs every 2000ms (2 seconds)


server.listen(PORT, () => {
  console.log(`🚀 Backend server listening on http://localhost:${PORT}`);
});