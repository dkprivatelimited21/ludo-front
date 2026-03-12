/**
 * Ludo Online — Main Application
 * Handles UI, Socket.io connection, and game interactions
 */

const App = (() => {
  // ── State ──────────────────────────────────────────────────────────────────
  let socket;
  let playerName = '';
  let myPlayer = null;     // { id, name, color, isHost }
  let currentRoomId = null;
  let roomPlayers = [];
  let gameState = null;
  let validMoves = [];
  let lastChatTime = 0;

  const COLOR_EMOJI = { red: '🔴', blue: '🔵', green: '🟢', yellow: '🟡' };
  const DICE_FACES  = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {

    // Connect socket

    socket = io('https://ludo-backend-ypv6.onrender.com', {
  transports: ['websocket', 'polling'],
  withCredentials: false,
});

    setupSocketListeners();

    // Check URL for room ID (deep link)
    const path = window.location.pathname;
    const match = path.match(/\/room\/([A-Z0-9]+)/i);
    if (match) {
      sessionStorage.setItem('pendingRoom', match[1].toUpperCase());
    }

    // Handle Enter key on inputs
    document.getElementById('nameInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') submitName();
    });
    document.getElementById('joinRoomId').addEventListener('keydown', e => {
      if (e.key === 'Enter') joinRoom();
    });
    document.getElementById('lobbyChatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChat();
    });
    document.getElementById('gameChatInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChat();
    });

    // Init board canvas
    const canvas = document.getElementById('ludoBoard');
    Board.init(canvas, handleTokenClick);

    showModal('nameModal');
  }

  // ── Name Entry ─────────────────────────────────────────────────────────────
  function submitName() {
    const input = document.getElementById('nameInput');
    const name = input.value.trim();
    if (!name || name.length < 1) {
      shakeInput(input);
      return;
    }
    playerName = name;
    sessionStorage.setItem('playerName', name);
    hideModal('nameModal');

    // Check for pending room join
    const pendingRoom = sessionStorage.getItem('pendingRoom');
    if (pendingRoom) {
      sessionStorage.removeItem('pendingRoom');
      showScreen('lobbyScreen');
      // Auto-fill and join
      document.getElementById('joinRoomId').value = pendingRoom;
      setTimeout(() => joinRoom(), 100);
    } else {
      showScreen('lobbyScreen');
    }

    updatePlayerBadge();
  }

  function updatePlayerBadge() {
    const badge = document.getElementById('myBadge');
    if (myPlayer) {
      badge.innerHTML = `${COLOR_EMOJI[myPlayer.color]} ${playerName}`;
      badge.style.color = myPlayer.color === 'yellow' ? '#b8860b' : myPlayer.color;
    } else {
      badge.innerHTML = `👤 ${playerName}`;
    }
  }

  // ── Room: Create ───────────────────────────────────────────────────────────
  function createRoom() {
    if (!playerName) return showToast('Enter your name first');

    socket.emit('createRoom', { playerName }, (res) => {
      if (res.error) return showToast('❌ ' + res.error);
      currentRoomId = res.roomId;
      myPlayer = res.player;
      roomPlayers = res.players;
      enterRoomLobby();
    });
  }

  // ── Room: Join ─────────────────────────────────────────────────────────────
  function joinRoom() {
    if (!playerName) return showToast('Enter your name first');
    const input = document.getElementById('joinRoomId');
    const roomId = input.value.trim().toUpperCase();
    if (!roomId) { shakeInput(input); return; }

    socket.emit('joinRoom', { roomId, playerName }, (res) => {
      if (res.error) return showToast('❌ ' + res.error);

      currentRoomId = res.roomId;
      myPlayer = res.player;
      roomPlayers = res.players;

      // Load existing chat
      if (res.chat) res.chat.forEach(addChatMessage);

      enterRoomLobby();

      // If game already started (reconnect)
      if (res.gameState) {
        gameState = res.gameState;
        enterGameScreen();
      }
    });
  }

  function enterRoomLobby() {
    showScreen('roomLobbyScreen');
    document.getElementById('displayRoomId').textContent = currentRoomId;
    document.getElementById('gameRoomId').textContent = currentRoomId;
    updateRoomLobbyUI();
    updatePlayerBadge();
    // Update URL without reload
    history.pushState({}, '', `/room/${currentRoomId}`);
  }

  function updateRoomLobbyUI() {
    document.getElementById('playerCountDisplay').textContent =
      `${roomPlayers.length}/4`;

    const slotsEl = document.getElementById('playerSlots');
    slotsEl.innerHTML = '';

    [0,1,2,3].forEach(i => {
      const player = roomPlayers[i];
      const slot = document.createElement('div');
      slot.className = 'player-slot' + (player ? ' filled' : '');
      if (player) {
        slot.style.setProperty('--player-color', getColorHex(player.color));
        slot.innerHTML = `
          <div class="slot-icon">${COLOR_EMOJI[player.color]}</div>
          <div class="slot-name">${escHtml(player.name)}</div>
          <div class="slot-label">${player.isHost ? '👑 Host' : 'Player'}</div>
        `;
      } else {
        slot.innerHTML = `<div class="slot-icon">⬜</div><div class="slot-label">Waiting...</div>`;
      }
      slotsEl.appendChild(slot);
    });

    const startBtn = document.getElementById('startBtn');
    const startHint = document.getElementById('startHint');
    const waitingHint = document.getElementById('waitingHint');

    if (myPlayer?.isHost) {
      if (roomPlayers.length >= 2) {
        startBtn.style.display = 'flex';
        startHint.textContent = 'Ready to roll!';
      } else {
        startBtn.style.display = 'none';
        startHint.textContent = 'Need at least 2 players to start';
      }
    } else {
      startBtn.style.display = 'none';
      startHint.textContent = 'Waiting for host to start...';
    }

    waitingHint.textContent = roomPlayers.length < 4
      ? `Waiting for players... (${4 - roomPlayers.length} more can join)`
      : '4 players ready!';
  }

  function copyLink() {
    const link = `${window.location.origin}/room/${currentRoomId}`;
    navigator.clipboard.writeText(link).then(() => {
      showToast('📋 Room link copied!');
    }).catch(() => {
      // Fallback
      const input = document.createElement('input');
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('📋 Room link copied!');
    });
  }

  // ── Game: Start ────────────────────────────────────────────────────────────
  function startGame() {
    socket.emit('startGame', {}, (res) => {
      if (res && res.error) showToast('❌ ' + res.error);
    });
  }

  function enterGameScreen() {
    showScreen('gameScreen');
    updateGameUI();
    Board.draw(gameState, myPlayer?.color, []);
  }

  // ── Game: Roll Dice ────────────────────────────────────────────────────────
  function rollDice() {
    if (!gameState || gameState.phase !== 'playing') return;
    if (gameState.currentColor !== myPlayer?.color) return;
    if (gameState.diceRolled) return;

    socket.emit('rollDice', {}, (res) => {
      if (res && res.error) showToast('❌ ' + res.error);
    });
  }

  // ── Game: Token Click ──────────────────────────────────────────────────────
  function handleTokenClick(tokenId) {
    if (!gameState || gameState.phase !== 'playing') return;
    if (gameState.currentColor !== myPlayer?.color) return;
    if (!gameState.diceRolled) { showToast('Roll the dice first!'); return; }
    if (!validMoves.includes(tokenId)) return;

    socket.emit('makeMove', { tokenId }, (res) => {
      if (res && res.error) showToast('❌ ' + res.error);
    });
  }

  // ── Game: UI Updates ───────────────────────────────────────────────────────
  function updateGameUI() {
    if (!gameState) return;

    // Players list
    const playersEl = document.getElementById('gamePlayers');
    playersEl.innerHTML = '';
    roomPlayers.forEach(player => {
      const isActive = player.color === gameState.currentColor;
      const div = document.createElement('div');
      div.className = 'game-player-item' + (isActive ? ' active-turn' : '');
      div.style.setProperty('--player-color', getColorHex(player.color));

      const homeCnt = gameState.tokens[player.color]?.filter(t => t.state === 'home').length || 0;

      div.innerHTML = `
        <div class="player-color-dot" style="background:${getColorHex(player.color)}"></div>
        <span>${escHtml(player.name)}</span>
        ${player.isHost ? '<span class="player-crown">👑</span>' : ''}
        <span class="player-tokens-status">${homeCnt}/4 🏠</span>
        ${isActive ? '<span style="margin-left:auto;font-size:0.7rem;color:var(--gold)">▶ TURN</span>' : ''}
      `;
      playersEl.appendChild(div);
    });

    // Turn indicator
    const turnText = document.getElementById('turnText');
    if (gameState.phase === 'finished') {
      turnText.textContent = '🏆 Game Over!';
    } else {
      const activePlayer = roomPlayers.find(p => p.color === gameState.currentColor);
      const isMe = gameState.currentColor === myPlayer?.color;
      turnText.innerHTML = isMe
        ? `<span style="color:var(--gold)">🎲 YOUR TURN!</span>`
        : `${COLOR_EMOJI[gameState.currentColor]} ${escHtml(activePlayer?.name || gameState.currentColor)}'s turn`;
    }

    // Dice button
    const diceBtn = document.getElementById('diceBtn');
    const isMyTurn = gameState.currentColor === myPlayer?.color && gameState.phase === 'playing';
    const canRoll = isMyTurn && !gameState.diceRolled;
    diceBtn.disabled = !canRoll;

    const diceFace = document.getElementById('diceFace');
    if (gameState.dice) {
      diceFace.textContent = DICE_FACES[gameState.dice] || gameState.dice;
    } else {
      diceFace.textContent = '?';
    }

    // Status
    const statusEl = document.getElementById('gameStatus');
    if (gameState.phase === 'playing') {
      const isMe = gameState.currentColor === myPlayer?.color;
      statusEl.textContent = isMe
        ? (gameState.diceRolled ? 'Click a highlighted token to move!' : 'Click ROLL to roll the dice!')
        : `Waiting for ${roomPlayers.find(p => p.color === gameState.currentColor)?.name}...`;
    }
  }

  function animateDice(value) {
    const diceBtn = document.getElementById('diceBtn');
    const diceFace = document.getElementById('diceFace');

    diceBtn.classList.add('dice-rolling');
    let count = 0;
    const interval = setInterval(() => {
      diceFace.textContent = DICE_FACES[Math.floor(Math.random() * 6) + 1];
      count++;
      if (count >= 8) {
        clearInterval(interval);
        diceFace.textContent = DICE_FACES[value];
        diceBtn.classList.remove('dice-rolling');
      }
    }, 60);
  }

  function addMoveLog(text) {
    const el = document.getElementById('moveLogEntries');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = text;
    el.prepend(entry);
    // Keep last 20
    while (el.children.length > 20) el.lastChild.remove();
  }

  function showNotification(msg, color) {
    const el = document.getElementById('notification');
    el.textContent = msg;
    el.style.borderColor = getColorHex(color) || 'var(--accent)';
    el.classList.remove('hidden');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.add('hidden'), 2500);
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  function sendChat() {
    const now = Date.now();
    if (now - lastChatTime < 2000) {
      showToast('⏳ Wait a moment before sending again');
      return;
    }

    const isGame = !document.getElementById('gameScreen').classList.contains('hidden');
    const inputEl = document.getElementById(isGame ? 'gameChatInput' : 'lobbyChatInput');
    const msg = inputEl.value.trim();
    if (!msg) return;

    socket.emit('chat', { message: msg }, (res) => {
      if (res && res.error) showToast('❌ ' + res.error);
      else {
        inputEl.value = '';
        lastChatTime = Date.now();
      }
    });
  }

  function addChatMessage(chat) {
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `
      <span class="chat-name" style="color:${getColorHex(chat.color) || '#a990d0'}">${escHtml(chat.name)}:</span>
      <span class="chat-text">${escHtml(chat.message)}</span>
    `;

    // Add to both chat areas
    ['lobbyChatMessages', 'gameChatMessages'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const clone = msgEl.cloneNode(true);
        el.appendChild(clone);
        el.scrollTop = el.scrollHeight;
        // Keep last 50 messages
        while (el.children.length > 50) el.firstChild.remove();
      }
    });
  }

  // ── Win Screen ─────────────────────────────────────────────────────────────
  function showWinner(winnerColor, winnerName, stats) {
    document.getElementById('winnerTitle').textContent =
      winnerColor === myPlayer?.color ? '🎉 YOU WIN!' : 'Game Over!';
    document.getElementById('winnerName').textContent =
      `${COLOR_EMOJI[winnerColor]} ${winnerName}`;

    let statsHtml = '';
    if (stats) {
      statsHtml += `<div class="stat-item"><span class="stat-label">Duration</span><span class="stat-value">${stats.duration}</span></div>`;
      if (stats.moveCounts && stats.playerNames) {
        Object.keys(stats.moveCounts).forEach(color => {
          const name = stats.playerNames[color] || color;
          const moves = stats.moveCounts[color] || 0;
          statsHtml += `
            <div class="stat-item">
              <span class="stat-label">${escHtml(name)}</span>
              <span class="stat-value" style="color:${getColorHex(color)}">${moves} moves</span>
            </div>
          `;
        });
      }
    }

    document.getElementById('gameStats').innerHTML = statsHtml;

    const playAgainBtn = document.getElementById('playAgainBtn');
    playAgainBtn.style.display = myPlayer?.isHost ? 'inline-flex' : 'none';

    showModal('winnerModal');
  }

  function playAgain() {
    socket.emit('playAgain', {}, (res) => {
      if (res && res.error) return showToast('❌ ' + res.error);
    });
  }

  // ── Socket Listeners ───────────────────────────────────────────────────────
  function setupSocketListeners() {

    socket.on('connect', () => {
      console.log('Connected:', socket.id);
    });

    socket.on('disconnect', () => {
      showToast('⚠️ Disconnected from server. Reconnecting...');
    });

    socket.on('reconnect', () => {
      showToast('✅ Reconnected!');
      // Attempt to rejoin room
      if (currentRoomId && playerName) {
        socket.emit('joinRoom', { roomId: currentRoomId, playerName }, (res) => {
          if (!res.error) {
            myPlayer = res.player;
            roomPlayers = res.players;
            if (res.gameState) {
              gameState = res.gameState;
              enterGameScreen();
            }
          }
        });
      }
    });

    socket.on('playerJoined', ({ player, players }) => {
      roomPlayers = players;
      updateRoomLobbyUI();
      showToast(`${COLOR_EMOJI[player.color]} ${player.name} joined!`);
    });

    socket.on('playerDisconnected', ({ name, color, reconnectWindow }) => {
      showToast(`⚠️ ${name} disconnected (${reconnectWindow}s to reconnect)`);
    });

    socket.on('playerReconnected', ({ name, color }) => {
      showToast(`✅ ${COLOR_EMOJI[color]} ${name} reconnected!`);
    });

    socket.on('playerLeft', ({ name, color }) => {
      roomPlayers = roomPlayers.filter(p => p.name !== name);
      updateRoomLobbyUI();
      showToast(`${name} left the game`);
    });

    socket.on('hostChanged', ({ name }) => {
      const p = roomPlayers.find(p => p.name === name);
      if (p) p.isHost = true;
      if (myPlayer?.name === name) {
        myPlayer.isHost = true;
        showToast('👑 You are now the host!');
      }
      updateRoomLobbyUI();
    });

    socket.on('gameStarted', ({ gameState: gs }) => {
      gameState = gs;
      validMoves = [];
      enterGameScreen();
      showToast('🎲 Game started!');
    });

    socket.on('diceRolled', ({ dice, color, validMoves: vm, autoAdvanced, gameState: gs }) => {
      gameState = gs;

      animateDice(dice);

      const player = roomPlayers.find(p => p.color === color);
      addMoveLog(`${COLOR_EMOJI[color]} ${player?.name || color} rolled ${dice}`);

      if (color === myPlayer?.color) {
        validMoves = vm || [];
        if (autoAdvanced) {
          showNotification(`Rolled ${dice} — no valid moves`, color);
          validMoves = [];
        } else if (vm && vm.length > 0) {
          showNotification(`Rolled ${dice}! Click a token to move`, color);
        }
      } else {
        validMoves = [];
        showNotification(`${player?.name || color} rolled ${dice}`, color);
      }

      updateGameUI();
      Board.draw(gameState, myPlayer?.color, validMoves);
    });

    socket.on('moveMade', ({ gameState: gs, captured, extraTurn, winner }) => {
      gameState = gs;
      if (!winner) validMoves = [];

      const activePlayer = roomPlayers.find(p => p.color === gs.currentColor);

      if (captured) {
        showNotification('💥 Token captured! Extra turn!', gs.currentColor);
        addMoveLog(`💥 Token captured!`);
      }
      if (extraTurn && !captured) {
        const prev = roomPlayers.find(p => p.color !== gs.currentColor);
        addMoveLog(`⭐ Extra turn!`);
      }

      updateGameUI();
      Board.draw(gameState, myPlayer?.color, validMoves);
    });

    socket.on('gameOver', ({ winner, winnerName, gameState: gs, stats }) => {
      gameState = gs;
      validMoves = [];
      updateGameUI();
      Board.draw(gameState, myPlayer?.color, []);
      setTimeout(() => showWinner(winner, winnerName, stats), 800);
    });

    socket.on('chatMessage', (chat) => {
      addChatMessage(chat);
    });

    socket.on('gameReset', ({ players }) => {
      gameState = null;
      validMoves = [];
      roomPlayers = players;
      hideModal('winnerModal');

      // Refresh host status
      const me = players.find(p => p.name === playerName);
      if (me) myPlayer = me;

      showScreen('roomLobbyScreen');
      updateRoomLobbyUI();
      showToast('🔄 New game! Waiting to start...');
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function showScreen(id) {
    ['lobbyScreen', 'roomLobbyScreen', 'gameScreen'].forEach(s => {
      document.getElementById(s).classList.add('hidden');
    });
    document.getElementById(id).classList.remove('hidden');
  }

  function showModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.getElementById(id).classList.add('active');
  }

  function hideModal(id) {
    document.getElementById(id).classList.remove('active');
    document.getElementById(id).classList.add('hidden');
  }

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.add('hidden'), 3000);
  }

  function shakeInput(el) {
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'shake 0.3s ease';
    el.focus();
  }

  function escHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function getColorHex(color) {
    const map = { red: '#E53935', blue: '#1E88E5', green: '#43A047', yellow: '#FFB300' };
    return map[color] || '#a990d0';
  }

  // Public API
  return {
    init,
    submitName,
    createRoom,
    joinRoom,
    copyLink,
    startGame,
    rollDice,
    sendChat,
    playAgain,
  };
})();

// Add shake animation to CSS programmatically
const style = document.createElement('style');
style.textContent = `
  @keyframes shake {
    0%,100% { transform: translateX(0); }
    25% { transform: translateX(-8px); }
    75% { transform: translateX(8px); }
  }
`;
document.head.appendChild(style);

// Start the app
window.addEventListener('DOMContentLoaded', App.init);
