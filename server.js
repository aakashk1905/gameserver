// server/server.js
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = socketIO(server, {
  cors: {
    origin: ["http://localhost:5173", "http://10.5.52.113:5173", "*"],
    methods: ["GET", "POST"],
  },
});

// MongoDB connection
mongoose.connect(
  "mongodb+srv://upskillmafia:upskillmafia694@upskillmafia.vdegzfy.mongodb.net/test"
);

// Player Schema
const PlayerSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  position: {
    x: Number,
    y: Number,
  },
  room: String,
  active: Boolean,
  socket: String,
});

const Player = mongoose.model("Player", PlayerSchema);

// Game state
const gameState = {
  rooms: new Map(),
  players: new Map(),
};

// Socket.IO connection handling
io.on("connection", (socket) => {
  // console.log("New client connected");

  // Handle player join
  socket.on("join", async ({ username, room }) => {
    try {
      // Create or update player
      const player = await Player.findOneAndUpdate(
        { username },
        {
          username,
          position: { x: Math.random() * 800, y: Math.random() * 600 },
          room,
          active: true,
          socket: socket.id,
        },
        { upsert: true, new: true }
      );

      //   socket.join(room);
      gameState.players.set(socket.id, player);

      if (!gameState.rooms.has(room)) {
        gameState.rooms.set(room, new Set());
      }
      gameState.rooms.get(room).add(socket.id);

      io.emit(
        "players",
        Array.from(gameState.rooms.get(room)).map((id) =>
          gameState.players.get(id)
        )
      );
    } catch (error) {
      socket.emit("error", "Failed to join game");
    }
  });

  // Handle movement
  socket.on("move", ({ x, y }) => {
    const player = gameState.players.get(socket.id);
    // console.log(x, y);
    if (player) {
      const newX = Math.min(800, x);
      const newY = Math.min(600, y);

      player.position = { x: newX, y: newY };
      io.emit("playerMoved", {
        id: socket.id,
        position: player.position,
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", async () => {
    const player = gameState.players.get(socket.id);
    if (player) {
      await Player.findOneAndUpdate(
        { username: player.username },
        { active: false }
      );

      const room = gameState.rooms.get(player.room);
      if (room) {
        room.delete(socket.id);
        io.emit("playerLeft", socket.id);
      }

      gameState.players.delete(socket.id);
    }
  });
});

app.get("/game", (req, res) => res.send("hey there"));
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
