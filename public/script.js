const socket = io();
let username = null;

const loginDiv = document.getElementById('login');
const gameDiv = document.getElementById('game');
const joinBtn = document.getElementById('joinBtn');
const usernameInput = document.getElementById('username');
const chatDiv = document.getElementById('chat');
const guessInput = document.getElementById('guessInput');
const guessBtn = document.getElementById('guessBtn');
const sessionInfo = document.getElementById('sessionInfo');
const scoreboardDiv = document.getElementById('scoreboard');

joinBtn.onclick = () => {
  username = usernameInput.value.trim();
  if (!username) return alert("Enter a username!");

  socket.emit('joinGame', { username });
  loginDiv.classList.add('hidden');
  gameDiv.classList.remove('hidden');
};

guessBtn.onclick = () => {
  const guess = guessInput.value.trim();
  if (guess) {
    socket.emit('playerGuess', { username, guess });
    guessInput.value = '';
  }
};

socket.on('chatMessage', msg => {
  const p = document.createElement('p');
  p.textContent = msg;
  chatDiv.appendChild(p);
});

socket.on('sessionUpdate', info => {
  sessionInfo.textContent = `Players: ${info.playerCount} | Master: ${info.master}`;
});

socket.on('scoreboard', scores => {
  scoreboardDiv.innerHTML = '<h3>Scores</h3>';
  scores.forEach(s => {
    const p = document.createElement('p');
    p.textContent = `${s.username}: ${s.score}`;
    scoreboardDiv.appendChild(p);
  });
});