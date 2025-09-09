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
    methods: ["GET", "POST"]
  }
});

const PORT = 4001;

// This block runs whenever a new user connects to our server
io.on('connection', (socket) => {
  console.log('✅ A user connected');

  // Disconnect event
  socket.on('disconnect', () => {
    console.log('❌ User disconnected');
  });
});

// This is our main data generator. It runs every 2 seconds.
setInterval(() => {
  // 1. Create a log object
  const log = {
    serviceName: "API",
    timestamp: new Date().toISOString(),
    // Generate a random CPU usage value between 0.1 and 0.99
    cpu_usage: Math.random() * (0.99 - 0.1) + 0.1,
    status: 'healthy' // Default status
  };

  // 2. Simple Rule Engine (our "Azure ML" replacement)
  if (log.cpu_usage > 0.8) {
    log.status = 'anomaly';
  }

  // 3. Emit the log data to all connected clients
  io.emit('new-log', log);
  console.log('Emitting log:', log);

}, 2000); // Runs every 2000ms (2 seconds)


server.listen(PORT, () => {
  console.log(`🚀 Backend server listening on http://localhost:${PORT}`);
});