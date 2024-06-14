export class user {
    constructor(username) {
      this.username = username;
      this.stats = this.loadStats() || {
        totalGuesses: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
      };
    }
  
    saveStats() {
      localStorage.setItem(this.username, JSON.stringify(this.stats));
    }
  
    loadStats() {
      const stats = localStorage.getItem(this.username);
      return stats ? JSON.parse(stats) : null;
    }
  
    updateStats(isWinner) {
      this.stats.gamesPlayed++;
      if (isWinner) {
        this.stats.gamesWon++;
        this.stats.currentStreak++;
        if (this.stats.currentStreak > this.stats.maxStreak) {
          this.stats.maxStreak = this.stats.currentStreak;
        }
      } else {
        this.stats.currentStreak = 0;
      }
      this.saveStats();
    }

    incrementTotalGuesses(){
        this.stats.totalGuesses++;
        this.saveStats()
    }
  }
  