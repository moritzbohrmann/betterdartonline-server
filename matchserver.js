const express = require("express");
const app = express();
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
   cors: {
      origin: "http://localhost:3000",
      methods: ["GET", "POST"],
   },
});

const connectedPlayers = new Array();
const playerSockets = new Map();
const matches = new Map();
const currentLegs = new Map();

io.on("connection", (socket) => {
   socket.on("match-create", (match) => {
      matches.set(match.id, match);

      console.log(`Match created: ${match.id} [${match.players.host.username} vs ${match.players.guest.username}]`);

      currentLegs.set(match, match.legs[0]);
   });

   socket.on("join", (player) => {
      let match = getMatchByPlayerId(player.id);

      if (match === null) {
         socket.emit("error", { type: "no-match-found" });
         socket.disconnect();

         log(`Error: No match found for ${player.username}`);

         return;
      }

      let legs = match.legs;
      legs.splice(legs.length - 1, 1, currentLegs.get(match));

      match = { ...match, legs: legs };

      if (match.players.host.id !== player.id) {
         match = {
            ...match,
            legs: legs,
            players: {
               host: match.players.guest,
               guest: match.players.host,
            },
            state: {
               host: match.state.guest,
               guest: match.state.host,
            },
         };
      }

      socket.emit("passed", match);

      log(`${player.username} joined the match #${match.id}!`);

      if (connectedPlayers.includes(player)) {
         connectedPlayers.splice(connectedPlayers.indexOf(player), 1);
         playerSockets.delete(player.id);
      }

      connectedPlayers.push(player);
      playerSockets.set(player.id, socket);
   });

   socket.on("score", (score) => {
      let match = getMatchByPlayerId(score.player.id);
      let currentLeg = currentLegs.get(match);

      //* Calculate the score left by the player

      let left = currentLeg.scores.length <= 1 ? match.settings.scoremode - score.value : currentLeg.scores.at(-2).left - score.value;
      let next = score.player.id === match.players.host.id ? match.players.guest : match.players.host;
      let round = Math.floor(currentLegs.get(match).scores.length / 2);
      let avg = getLegAverage(currentLegs.get(match), score.value, score.player);

      let updtScore = { ...score, left, next, round, avg };

      //* Emitting the score-data to both players of the match

      emitScore(updtScore, [match.players.host, match.players.guest]);

      //* Adding the score the the whole leg-data

      currentLegs.get(match).scores.push(updtScore);

      if (score.value >= 162) {
         const achievement = { type: "HIGHSCORE", player: score.player, value: score.value };
         match.achievements.push(achievement);
         sendData([match.players.host, match.players.guest], "achievement", achievement);
      }

      //* Checking if the player has checked

      if (updtScore.left === 0) {
         //* Updating the score of the player who checked

         if (updtScore.player.id === match.players.host.id) {
            match.state.host++;
         } else match.state.guest++;

         match.legs.splice(match.legs.length - 1, 1, currentLegs.get(match));

         //* Round must be zero because of the new leg

         const legPreview = {
            index: match.legs.length,
            throw: match.legs.at(-1).throw === match.players.host.id ? match.players.guest.id : match.players.host.id,
            scores: [],
         };

         if (score.value >= 99) {
            const achievement = { type: "HIGHFINISH", player: score.player, value: score.value };
            match.achievements.push(achievement);
            sendData([match.players.host, match.players.guest], "achievement", achievement);
         }

         if (updtScore.round + 1 <= 6) {
            const achievement = { type: "SHORTLEG", player: score.player, value: updtScore.round + 1 };
            match.achievements.push(achievement);
            sendData([match.players.host, match.players.guest], "achievement", achievement);
         }

         match.legs.push(legPreview);
         currentLegs.set(match, legPreview);

         //* Emitting the checkout

         sendData([match.players.host, match.players.guest], "legshot", { player: updtScore.player, legPreview: legPreview, currentLeg });

         matches.set(match.id, match);

         return;
      }
   });
   socket.on("score-edit", (score) => {
      let player = getPlayer(socket);
      let match = getMatchByPlayerId(player.id);
      let leg = currentLegs.get(match);
      let lastScore = leg.scores.filter((s) => s.player.id === player.id).at(-1);

      let updatedScore = { ...lastScore, value: score, left: lastScore.left + lastScore.value - score };

      leg.scores.splice(leg.scores.indexOf(lastScore), 1, updatedScore);

      match.legs.splice(match.legs.length - 1, 1, leg);

      sendData([match.players.host, match.players.guest], "score-edit", updatedScore);

      if (score >= 91) {
         const a = { type: "HIGHSCORE", player: player, value: score };
         const achievements = match.achievements;

         const lastAc = achievements.filter((ac) => ac.player.id === player.id && ac.type === "HIGHSCORE").at(-1);

         if (lastAc) {
            match.achievements.splice(
               achievements.indexOf(achievements.filter((ac) => ac.player.id === player.id && ac.type === "HIGHSCORE").at(-1)),
               1,
               a
            );
            sendData([match.players.host, match.players.guest], "achievement-edit", a);
         } else {
            match.achievements.push(a);
            sendData([match.players.host, match.players.guest], "achievement", a);
         }
      } else if (lastScore.value >= 91) {
         const lastAc = match.achievements.filter((ac) => ac.player.id === player.id && ac.type === "HIGHSCORE").at(-1);

         match.achievements.splice(match.achievements.indexOf(lastAc), 1);

         sendData([match.players.host, match.players.guest], "achievement-remove", lastAc);
      }
      matches.set(match.id, match);
   });

   socket.on("disconnect", (e) => {
      let player = getPlayer(socket);

      if (player != null) {
         playerSockets.delete(player.id);
         connectedPlayers.splice(connectedPlayers.indexOf(player), 1);

         io.emit("quit", player);
         log(`${player.username} left the match #${getMatchByPlayerId(player.id).id}!`);
      }
   });

   socket.on("match-request", (player) => {
      const match = getMatchByPlayerId(player.id);
      match !== null && socket.emit("match-continue", { player: player, match: match });
   });
});

const emitScore = (score, players) => {
   sendData(players, "score", score);
};

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
            if (player.id === key) p = player;
         });
      }
   }

   return p;
};

const getMatchByPlayerId = (id) => {
   let m = null;

   for (const [key, value] of matches) {
      if (value.players.host.id === id || value.players.guest.id === id) {
         m = value;
      }
   }

   return m;
};

const getLegAverage = (leg, points, player) => {
   let rounds = 1;

   const filteredList = leg.scores.filter((score) => score.player.id === player.id);

   if (filteredList.length === 0) {
      return points;
   }

   filteredList.forEach((score) => {
      points += score.value;
      rounds++;
   });

   return (points / rounds).toFixed(1).toString().replace(".", ",");
};

const sendData = (players, event, data) => players.forEach((p) => playerSockets.get(p.id).emit(event, data));

server.listen(8457, () => log("Server started successfully!"));
