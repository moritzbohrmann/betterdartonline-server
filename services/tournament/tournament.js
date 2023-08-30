class TournamentManager {
   constructor(_tournaments = []) {
      this.tournaments = _tournaments;
   }

   tournaments() {
      return this.tournaments;
   }

   addTournament(...tournaments) {
      tournaments.forEach((tournament) => this.tournaments.push(tournament));
   }

   removeTournament(tournament) {
      this.tournaments.splice(this.tournaments.index, 1);
   }
}

class Tournament {
   constructor(size, name, endOfRegistrationDate, startDate, endDate, groupStage, doubleKO) {
      this.id = Date.now();
      this.size = size;
      this.name = name;
      this.endOfRegistrationDate = endOfRegistrationDate;
      this.startDate = startDate;
      this.endDate = endDate;
      this.groupStage = groupStage;
      this.doubleKO = doubleKO;
      this.players = [];
   }
   addPlayer(player) {
      this.players.push(player);
   }

   removePlayer(player) {
      this.players.splice(this.players.indexOf(player), 1);
   }
}

class TournamentApi {
   constructor(app, tournamentManager) {
      this.app = app;
      this.tournamentManager = tournamentManager;
   }

   listen() {
      this.app.get("/tournaments", ({}, res) => {
         res.json({ tournaments: this.tournamentManager.tournaments });
      });

      this.app.get("/tournament/info/:id", (req, res) => {
         const tournament = this.tournamentManager.tournaments.find((t) => t.id === req.params.id);

         res.json({ error: tournament === null ? "Tournament not found." : null, tournament });
      });

      this.app.post("/tournament/create", ({ body }, res) => {
         const tournament = new Tournament(
            body.size,
            body.name,
            body.endOfRegistrationDate,
            body.startDate,
            body.endDate,
            body.groupStage,
            body.doubleKO
         );

         this.tournamentManager.addTournament(tournament);

         res.json({ error: null, tournament });
      });
   }
}

module.exports = { TournamentApi, TournamentManager, Tournament };
