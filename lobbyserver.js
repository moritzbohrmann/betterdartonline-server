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

const EventType = {
   JOIN: "join",
   QUIT: "quit",
   DISCONNECT: "disconnect",
   REQUEST: "request",
   REQUEST_REVOKE: "request-revoke",
   REQUEST_DECLINE: "request-decline",
   REQUEST_ACCEPT: "request-accept",
   MATCH_START: "match-start",
   ERROR: "error",
   FETCH_MATCH: "match-request",
   MATCH_CONTINUE: "match-continue",
};

const players = new Array();
const sockets = new Map();
const room = {
   X01: new Array(),
   Cricket: new Array(),
   Split: new Array(),
};

const quit = (socket) => {
   const player = getPlayer(socket);

   if (player) {
      const roomMates = getRoom(player.selected);

      sockets.delete(player.id);
      players.splice(players.indexOf(player), 1);

      room[player.selected].splice(roomMates.indexOf(player), 1);

      for (const all of room[player.selected]) all.emit(EventType.QUIT, player);
      socket.emit(EventType.QUIT, getRoom(player.selected));

      log(player.username + " left room " + player.selected + "!");
   }
};

io.on("connection", (socket) => {
   socket.on(EventType.JOIN, (player) => {
      if (players.filter((p) => p.id === player.id || p.username === player.username).length > 0) {
         socket.emit(EventType.ERROR, { type: "alreadyConnected" });
         return;
      }

      matchserver.emit(EventType.FETCH_MATCH, player);

      players.push(player);
      sockets.set(player.id, socket);

      for (const all of room[player.selected]) all.emit(EventType.JOIN, player);

      room[player.selected].push(socket);

      socket.emit(EventType.JOIN, getRoom(player.selected));

      log(player.username + " joined room " + player.selected + "!");
   });

   socket.onAny((event) => {
      if ([EventType.DISCONNECT, EventType.QUIT].includes(event)) quit(socket);
   });

   socket.on(EventType.REQUEST, (requested) => {
      let requester = getPlayer(socket);

      getSocket(requested).emit(EventType.REQUEST, requester);

      log(`${requester.username} requests ${requested.username} for a match!`);
   });

   socket.on(EventType.REQUEST_ACCEPT, (requester) => {
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

      getSocket(requested).emit(EventType.MATCH_START, match);

      match.players.host = requester;
      match.players.guest = requested;

      sockets.get(requester.id).emit(EventType.MATCH_START, match);

      log(`${requested.username} accepted request from ${requester.username}!`);
   });

   socket.on(EventType.REQUEST_DECLINE, (requester) => {
      let requested = getPlayer(socket);

      log(`${requested.username} declined request from ${requester.username}!`);

      getSocket(requester).emit(EventType.REQUEST_DECLINE, requested);
   });

   socket.on(EventType.REQUEST_REVOKE, (requested) => {
      let requester = getPlayer(socket);

      log(`${requester.username} revoked request for ${requested.username}!`);

      getSocket(requested).emit(EventType.REQUEST_REVOKE, getPlayer(socket));
   });
});

matchserver.on(EventType.MATCH_CONTINUE, ({ player, match }) => {
   sockets.get(player.id).emit(EventType.MATCH_CONTINUE, match);
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

function getRoom(roomName) {
   const roomPlayers = [];

   for (const socket of room[roomName]) roomPlayers.push(getPlayer(socket));

   return roomPlayers;
}

const getPlayer = (socket) => {
   let p = null;

   for (let [key, value] of sockets.entries()) {
      if (value == socket) {
         players.forEach((player) => {
            if (player.id === key) {
               p = player;
            }
         });
      }
   }

   return p;
};

const getSocket = (player) => {
   return sockets.get(player.id);
};

const createMatch = (match) => {
   matchserver.emit("match-create", match);
};

server.listen(3001, () => {
   log("Server started successfully!");
});
