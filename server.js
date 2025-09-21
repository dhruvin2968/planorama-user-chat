// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

// HTTP server + socket layer
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: ["http://localhost:3000", "http://localhost:3001"], // Common React dev server ports
    methods: ["GET", "POST"],
  },
});

// Track active users
let users = {};

// Handle socket connections
io.on("connection", (socket) => {
  console.log("⚡ New client connected:", socket.id);

  // Register new user
  socket.on("new user", ({ uid, name }) => {
    if (!uid || !name) {
      console.error("❌ Invalid user data:", { uid, name });
      return;
    }

    users[uid] = { 
      socketId: socket.id, 
      name: name,
      joinedAt: new Date().toISOString()
    };
    
    console.log("🟢 User joined:", name, "UID:", uid);
    console.log("👥 Current users:", Object.keys(users).map(uid => users[uid].name));
    
    // Send updated user list to ALL clients
    io.emit("usersList", users);
  });

  // Handle private message
  socket.on("privateMessage", ({ roomId, from, fromUid, to, text }) => {
    console.log(`📩 Message: ${from} (${fromUid}) → ${to}: ${text} (Room: ${roomId})`);
    
    // Check if recipient exists and is connected
    if (!users[to]) {
      console.error("❌ Recipient not found:", to);
      return;
    }

    // Send to recipient
    io.to(users[to].socketId).emit("receiveMessage", {
      roomId,
      from,
      fromUid,
      text,
      timestamp: new Date().toISOString()
    });
    
    console.log("✅ Message delivered to", users[to].name);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
    
    // Find and remove user
    let disconnectedUser = null;
    for (let uid in users) {
      if (users[uid].socketId === socket.id) {
        disconnectedUser = users[uid];
        delete users[uid];
        break;
      }
    }
    
    if (disconnectedUser) {
      console.log("👋 User left:", disconnectedUser.name);
      console.log("👥 Remaining users:", Object.keys(users).map(uid => users[uid].name));
    }
    
    // Send updated user list to all remaining clients
    io.emit("usersList", users);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error("❌ Socket error:", error);
  });
});

// Add a simple health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    activeUsers: Object.keys(users).length,
    users: Object.keys(users).map(uid => users[uid].name)
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Socket.IO server running on http://localhost:${PORT}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});