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
      this.size = size;
      this.name = name;
      this.endOfRegistrationDate = endOfRegistrationDate;
      this.startDate = startDate;
      this.endDate = endDate;
      this.groupStage = groupStage;
      this.doubleKO = doubleKO;
      this.players = [];
   }

   size() {
      return this.size;
   }
   name() {
      return this.name;
   }
   endOfRegistrationDate() {
      return this.endOfRegistrationDate;
   }
   startDate() {
      return this.startDate;
   }
   endDate() {
      return this.endDate;
   }
   groupStage() {
      return this.groupStage;
   }
   doubleKO() {
      return this.doubleKO;
   }
   players() {
      return this.players;
   }

   addPlayer(player) {
      this.players.push(player);
   }

   removePlayer(player) {
      this.players.splice(this.players.indexOf(player), 1);
   }
}

module.exports = { TournamentManager, Tournament };
