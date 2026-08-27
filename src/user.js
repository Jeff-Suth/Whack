import { getXpForGuesses, getBadgeForXp } from './ranks.js';

export class user {
    constructor(username) {
      this.username = username;
      this.stats = this.loadStats() || {
        totalGuesses: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        currentStreak: 0,
        maxStreak: 0,
        xp: 0,
        badge: 'Iron',
      };
    }

    saveStats() {
      localStorage.setItem(this.username, JSON.stringify(this.stats));
    }

    loadStats() {
      const stats = localStorage.getItem(this.username);
      if (!stats) return null;
      const parsed = JSON.parse(stats);
      // Backfill xp/badge for stats saved before this feature existed.
      if (parsed.xp === undefined) parsed.xp = 0;
      if (parsed.badge === undefined) parsed.badge = 'Iron';
      return parsed;
    }

    replaceStats(stats) {
      this.stats = {
        totalGuesses: stats.totalGuesses || 0,
        gamesPlayed: stats.gamesPlayed || 0,
        gamesWon: stats.gamesWon || 0,
        currentStreak: stats.currentStreak || 0,
        maxStreak: stats.maxStreak || 0,
        xp: stats.xp || 0,
        badge: stats.badge || 'Iron',
      };
      this.saveStats();
    }

    updateStats(isWinner, guessCount) {
      this.stats.gamesPlayed++;
      if (isWinner) {
        this.stats.gamesWon++;
        this.stats.currentStreak++;
        if (this.stats.currentStreak > this.stats.maxStreak) {
          this.stats.maxStreak = this.stats.currentStreak;
        }
        this.stats.xp += getXpForGuesses(guessCount);
        this.stats.badge = getBadgeForXp(this.stats.xp);
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
