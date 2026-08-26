import { user } from './user.js';
import { wordList } from './dictionary.js';
import { answerList } from './answers.js';

const dictionary = wordList;
const state = {
  secret: answerList[Math.floor(Math.random() * answerList.length)],
  grid: Array(6)
    .fill()
    .map(() => Array(5).fill('')),
  currentRow: 0,
  currentCol: 0,
  selectedCol: null, // Column of the letter box the player clicked to overwrite
  guessedWords: [], // Array to store guessed words
  isGameOver: false
};

let currentUser;

function showToast(message, duration = 3000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('visible');

  clearTimeout(toast.hideTimeout);
  toast.hideTimeout = setTimeout(() => {
    toast.classList.remove('visible');
  }, duration);
}

function showPlayAgainButton() {
  let button = document.getElementById('play-again-button');
  if (!button) {
    button = document.createElement('button');
    button.id = 'play-again-button';
    button.className = 'play-again-button';
    button.textContent = 'Play Again';
    button.onclick = resetGame;
    document.body.appendChild(button);
  }
  button.classList.add('visible');
}

function resetGame() {
  state.secret = answerList[Math.floor(Math.random() * answerList.length)];
  state.grid = Array(6)
    .fill()
    .map(() => Array(5).fill(''));
  state.currentRow = 0;
  state.currentCol = 0;
  state.selectedCol = null;
  state.guessedWords = [];
  state.isGameOver = false;

  document.querySelectorAll('.box').forEach((box) => {
    box.className = 'box';
  });
  document.querySelectorAll('.key').forEach((key) => {
    key.classList.remove('empty', 'wrong', 'right');
  });

  document.getElementById('play-again-button')?.classList.remove('visible');
  document.getElementById('toast')?.classList.remove('visible');

  updateGrid();
}

function startup() {
  let username = localStorage.getItem('lastUsername');
  if (!username) {
    username = prompt("Enter your username:");
    if (username) {
      localStorage.setItem('lastUsername', username);
    } else {
      alert('Username is required to play the game.');
      return;
    }
  }

  currentUser = new user(username);
  const game = document.getElementById('game');
  drawGrid(game);

  const keyboardContainer = document.getElementById('keyboard-container');
  drawKeyboard(keyboardContainer);

  registerKeyboardEvents();
  displayStats(); // Display initial stats

  const statsButton = document.getElementById('stats-button');
  const statsMenu = document.getElementById('stats-menu');
  const closeStatsButton = document.getElementById('close-stats-button');

  statsButton.onclick = () => {
    statsMenu.classList.add('visible');
  };

  closeStatsButton.onclick = () => {
    statsMenu.classList.remove('visible');
  };
}

function drawGrid(container) {
  const grid = document.createElement('div');
  grid.className = 'grid';

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 5; j++) {
      drawBox(grid, i, j);
    }
  }

  container.appendChild(grid);
}

function updateGrid() {
  for (let i = 0; i < state.grid.length; i++) {
    for (let j = 0; j < state.grid[i].length; j++) {
      const box = document.getElementById(`box${i}${j}`);
      box.textContent = state.grid[i][j];
      box.classList.toggle(
        'selected',
        i === state.currentRow && j === state.selectedCol
      );
    }
  }
}

function drawBox(container, row, col, letter = '') {
  const box = document.createElement('div');
  box.className = 'box';
  box.textContent = letter;
  box.id = `box${row}${col}`;
  box.onclick = () => handleBoxClick(row, col);

  container.appendChild(box);
  return box;
}

function handleBoxClick(row, col) {
  // Only letters already typed in the row currently being guessed can be selected
  if (row !== state.currentRow || col >= state.currentCol) return;

  state.selectedCol = state.selectedCol === col ? null : col;
  updateGrid();
}

function drawKeyboard(container) {
  const keyboardLayout = [
    'QWERTYUIOP',
    'ASDFGHJKL',
    'ZXCVBNM'
  ];

  const keyboard = document.createElement('div');
  keyboard.className = 'keyboard';

  keyboardLayout.forEach((row, rowIndex) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'keyboard-row';
    if (rowIndex === 2) {
      // Add Enter key to the beginning of the last row
      const enterKey = document.createElement('button');
      enterKey.className = 'key special-key';
      enterKey.textContent = 'Enter';
      enterKey.onclick = () => handleKeyClick('Enter');
      rowDiv.appendChild(enterKey);
    }
    row.split('').forEach(key => {
      const keyDiv = document.createElement('button');
      keyDiv.className = 'key';
      keyDiv.textContent = key;
      keyDiv.id = `key-${key}`; // Add id to key for later reference
      keyDiv.onclick = () => handleKeyClick(key);
      rowDiv.appendChild(keyDiv);
    });
    if (rowIndex === 2) {
      // Add Backspace key to the end of the last row
      const backspaceKey = document.createElement('button');
      backspaceKey.className = 'key special-key';
      backspaceKey.textContent = '<-';
      backspaceKey.onclick = () => handleKeyClick('Backspace');
      rowDiv.appendChild(backspaceKey);
    }
    keyboard.appendChild(rowDiv);
  });

  container.appendChild(keyboard);
}

function handleKeyClick(key) {
  if (state.isGameOver) return;

  if (key === 'Enter') {
    const isRowFilled = state.grid[state.currentRow].every(
      (letter) => letter !== ''
    );
    if (isRowFilled) {
      const word = getCurrentWord();
      if (isWordValid(word)) {
        if (state.guessedWords.includes(word)) {
          showToast('You have already guessed this word.');
        } else {
          state.guessedWords.push(word); // Add the word to the guessed words array
          currentUser.incrementTotalGuesses();
          revealWord(word);
          state.currentRow++;
          state.currentCol = 0;
          state.selectedCol = null;
        }
      } else {
        showToast(`Not a valid word: ${word}`);
      }
    }
  } else if (key === 'Backspace') {
    removeLetter();
  } else if (isLetter(key)) {
    addLetter(key);
  }

  updateGrid();
}

function registerKeyboardEvents() {
  document.body.onkeydown = (e) => {
    handleKeyClick(e.key);
  };
}

function getCurrentWord() {
  return state.grid[state.currentRow].reduce((prev, curr) => prev + curr);
}

function isWordValid(word) {
  return dictionary.includes(word.toLowerCase());
}

function getNumOfOccurrencesInWord(word, letter) {
  let result = 0;
  for (let i = 0; i < word.length; i++) {
    if (word[i] === letter) {
      result++;
    }
  }
  return result;
}

function getPositionOfOccurrence(word, letter, position) {
  let result = 0;
  for (let i = 0; i <= position; i++) {
    if (word[i] === letter) {
      result++;
    }
  }
  return result;
}

function revealWord(guess) {
  const row = state.currentRow;
  const animation_duration = 500; // ms

  for (let i = 0; i < 5; i++) {
    const box = document.getElementById(`box${row}${i}`);
    const letter = box.textContent;
    const numOfOccurrencesSecret = getNumOfOccurrencesInWord(
      state.secret,
      letter
    );
    const numOfOccurrencesGuess = getNumOfOccurrencesInWord(guess, letter);
    const letterPosition = getPositionOfOccurrence(guess, letter, i);

    setTimeout(() => {
      if (
        numOfOccurrencesGuess > numOfOccurrencesSecret &&
        letterPosition > numOfOccurrencesSecret
      ) {
        box.classList.add('empty');
        updateKeyClass(letter, 'empty');
      } else {
        if (letter === state.secret[i]) {
          box.classList.add('right');
          updateKeyClass(letter, 'right');
        } else if (state.secret.includes(letter)) {
          box.classList.add('wrong');
          updateKeyClass(letter, 'wrong');
        } else {
          box.classList.add('empty');
          updateKeyClass(letter, 'empty');
        }
      }
    }, ((i + 1) * animation_duration) / 2);

    box.classList.add('animated');
    box.style.animationDelay = `${(i * animation_duration) / 2}ms`;
  }

  const isWinner = state.secret === guess;
  const isLastRow = state.currentRow === 5;

  setTimeout(() => {
    if (isWinner) {
      state.isGameOver = true;
      currentUser.updateStats(isWinner);
      showToast('Congratulations!');
      showPlayAgainButton();
    } else if (isLastRow) {
      state.isGameOver = true;
      currentUser.updateStats(isWinner);
      showToast(`Better luck next time! The word was ${state.secret}.`);
      showPlayAgainButton();
    }
    displayStats(); // Display the updated stats
  }, 3 * animation_duration);
}

function updateKeyClass(key, className) {
  const keyElement = document.getElementById(`key-${key.toUpperCase()}`);
  if (keyElement && !keyElement.classList.contains('right')) { 
    // Only update if it's not already marked correct
    keyElement.classList.remove('empty', 'wrong', 'right');
    keyElement.classList.add(className);
  }
}

function isLetter(key) {
  return key.length === 1 && key.match(/[a-z]/i);
}

function addLetter(letter) {
  if (state.selectedCol !== null) {
    state.grid[state.currentRow][state.selectedCol] = letter.toLowerCase();
    state.selectedCol = null;
    return;
  }
  if (state.currentCol === 5) return;
  state.grid[state.currentRow][state.currentCol] = letter.toLowerCase();
  state.currentCol++;
}

function removeLetter() {
  if (state.selectedCol !== null) {
    state.grid[state.currentRow][state.selectedCol] = '';
    state.selectedCol = null;
    return;
  }
  if (state.currentCol === 0) return;
  state.grid[state.currentRow][state.currentCol - 1] = '';
  state.currentCol--;
}

function displayStats() {
  const statsContainer = document.getElementById('stats-container');
  statsContainer.innerHTML = `
    <p>Total Guesses: ${currentUser.stats.totalGuesses}</p>
    <p>Games Played: ${currentUser.stats.gamesPlayed}</p>
    <p>Games Won: ${currentUser.stats.gamesWon}</p>
    <p>Current Streak: ${currentUser.stats.currentStreak}</p>
    <p>Max Streak: ${currentUser.stats.maxStreak}</p>
  `;
}

startup();
