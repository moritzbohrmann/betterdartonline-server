const express = require("express");
const app = express();
const http = require("http");
const sio = require("socket.io");
const matchserver = require("socket.io-client").connect("http://localhost:8457");

const cors = require("cors");

app.use(cors());

const server = http.createServer(app);

const io = new sio.Server(server, {
   cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
   },
});

const connectedPlayers = new Array();
const playerSockets = new Map();

const quit = (socket) => {
   let player = getPlayer(socket);

   if (player != null) {
      playerSockets.delete(player.id);
      connectedPlayers.splice(connectedPlayers.indexOf(player), 1);

      io.emit("quit", player);
      log(`${player.username} left the lobby!`);
   }
};

io.on("connection", (socket) => {
   connectedPlayers.map((player) => {
      socket.emit("join", player);
   });

   socket.on("join", (player) => {
      let error = false;

      connectedPlayers.forEach((all) => {
         if (player.id === all.id) {
            socket.emit("error", { type: "alreadyConnected" });
            error = true;
            return;
         } else if (player.username === all.username) {
            socket.emit("error", { type: "invalidUsername" });
            error = true;
            return;
         }
      });

      if (error === true) {
         error = false;
         return;
      }

      matchserver.emit("match-request", player);

      socket.emit("passed");

      log(`${player.username} joined the lobby!`);

      if (connectedPlayers.includes(player)) {
         connectedPlayers.splice(connectedPlayers.indexOf(player), 1);
         playerSockets.delete(player.id);
      }

      connectedPlayers.push(player);
      playerSockets.set(player.id, socket);

      io.emit("join", player);
   });

   socket.on("disconnect", (e) => {
      console.log("-");
      quit(socket);
   });

   socket.on("quit", (e) => {
      quit(socket);
   });

   socket.on("request", (requested) => {
      let requester = getPlayer(socket);

      playerSockets.get(requested.id).emit("request", requester);

      log(`${requester.username} requests ${requested.username} for a match!`);
   });

   socket.on("request-accept", (requester) => {
      let requested = getPlayer(socket);

      let match = {
         id: Date.now(),
         players: {
            host: requested,
            guest: requester,
         },
         settings: requested,
         state: {
            host: 0,
            guest: 0,
         },
         legs: [
            {
               index: 0,
               throw: requested.id,
               scores: [],
            },
         ],
         achievements: [],
      };

      createMatch(match);

      playerSockets.get(requested.id).emit("match-start", match);

      match.players.host = requester;
      match.players.guest = requested;

      playerSockets.get(requester.id).emit("match-start", match);

      log(`${requested.username} accepted request from ${requester.username}!`);
   });

   socket.on("request-decline", (requester) => {
      let requested = getPlayer(socket);

      log(`${requested.username} declined request from ${requester.username}!`);

      playerSockets.get(requester.id).emit("request-decline", requested);
   });

   socket.on("request-revoke", (requested) => {
      let requester = getPlayer(socket);

      log(`${requester.username} revoked request for ${requested.username}!`);

      playerSockets.get(requested.id).emit("request-revoke", getPlayer(socket));
   });
});

matchserver.on("match-continue", ({ player, match }) => {
   playerSockets.get(player.id).emit("match-continue", match);
});

const log = (message) => {
   let date = new Date();
   let format = {
      hours: date.getHours() >= 10 ? date.getHours() : `0${date.getHours()}`,
      minutes: date.getMinutes() >= 10 ? date.getMinutes() : `0${date.getMinutes()}`,
      seconds: date.getSeconds() >= 10 ? date.getSeconds() : `0${date.getSeconds()}`,
   };
   let timeFormat = `[${format.hours}:${format.minutes}:${format.seconds}]`;

   console.log(`${timeFormat} » ${message}`);
};

const getPlayer = (socket) => {
   let p = null;

   for (let [key, value] of playerSockets.entries()) {
      if (value === socket) {
         connectedPlayers.forEach((player) => {
            if (player.id === key) {
               p = player;
            }
         });
      }
   }

   return p;
};

const createMatch = (match) => {
   matchserver.emit("match-create", match);
};

server.listen(3001, () => {
   log("Server started successfully!");
});
