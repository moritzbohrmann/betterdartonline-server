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
      this.tournaments.splice(this.tournaments.indexOf(tournament), 1);
   }
}

class Tournament {
   constructor(admin, size, name, registrationDate, startDate, groupStage, elimination) {
      this.id = Date.now();
      this.admin = admin;
      this.size = size;
      this.name = name;
      this.registrationDate = registrationDate;
      this.startDate = startDate;
      this.groupStage = groupStage;
      this.elimination = elimination;
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
         const tournament = this.tournamentManager.tournaments.find((t) => t.id == req.params.id);

         console.log(tournament);

         res.json({ error: tournament === null ? "Tournament not found." : null, tournament });
      });

      this.app.post("/tournament/create", ({ body }, res) => {
         const tournament = new Tournament(
            body.admin,
            body.size,
            body.name,
            body.registrationDate,
            body.startDate,
            body.endDate,
            body.groupStage,
            body.elimination
         );

         if (this.tournamentManager.tournaments.find((t) => t.name === tournament.name)) {
            res.json({ error: "Invalid tournament name. Name already in use." });
            return;
         }

         this.tournamentManager.addTournament(tournament);

         res.json({ error: null, tournament });
      });
   }
}

module.exports = { TournamentApi, TournamentManager, Tournament };
