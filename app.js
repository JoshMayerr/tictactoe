// Game Registry - Structure for multiple games
const GAME_REGISTRY = {
  tictactoe: {
    id: "tictactoe",
    name: "TIC TAC TOE",
    icon: "⭕",
    description: "Classic 3x3 grid game. Get three in a row to win!",
    contractAddress: "0x2dA8Edf5D07628A0FB9224fef70c56ec691cefa9",
    abi: [
      "function createGame(uint8 stakeIndex) payable returns (uint256)",
      "function joinGame(uint256 gameId) payable",
      "function makeMove(uint256 gameId, uint8 position)",
      "function withdraw()",
      "function getGameInfo(uint256 gameId) view returns (address playerX, address playerO, uint8 turn, uint8 moveCount, uint8 winner, uint8 stakeIndex, uint8 status)",
      "function getBoard(uint256 gameId) view returns (uint8[9])",
      "function STAKE_OPTIONS(uint256) view returns (uint256)",
      "function nextGameId() view returns (uint256)",
      "function balances(address) view returns (uint256)",
      "event GameCreated(uint256 indexed gameId, address indexed playerX, uint8 stakeIndex, uint256 stakeAmount)",
      "event GameJoined(uint256 indexed gameId, address indexed playerO)",
      "event MoveMade(uint256 indexed gameId, address indexed player, uint8 position, uint8 symbol)",
      "event GameWon(uint256 indexed gameId, address indexed winner, uint256 prize)",
      "event GameDraw(uint256 indexed gameId, uint256 refundEach)",
    ],
    init: initTicTacToe,
    renderGame: renderTicTacToe,
  },
  connect4: {
    id: "connect4",
    name: "CONNECT 4",
    icon: "🔴",
    description: "Drop pieces into columns. Get four in a row to win!",
    contractAddress: "0xC21bA6f79E41C9501C013Cf4C17D107682a86fd3",
    abi: [
      "function createGame(uint8 stakeIndex) payable returns (uint256)",
      "function joinGame(uint256 gameId) payable",
      "function makeMove(uint256 gameId, uint8 column)",
      "function withdraw()",
      "function getGameInfo(uint256 gameId) view returns (address playerX, address playerO, uint8 turn, uint8 moveCount, uint8 winner, uint8 stakeIndex, uint8 status)",
      "function getBoard(uint256 gameId) view returns (uint8[42])",
      "function STAKE_OPTIONS(uint256) view returns (uint256)",
      "function nextGameId() view returns (uint256)",
      "function balances(address) view returns (uint256)",
      "event GameCreated(uint256 indexed gameId, address indexed playerX, uint8 stakeIndex, uint256 stakeAmount)",
      "event GameJoined(uint256 indexed gameId, address indexed playerO)",
      "event MoveMade(uint256 indexed gameId, address indexed player, uint8 column, uint8 row, uint8 symbol)",
      "event GameWon(uint256 indexed gameId, address indexed winner, uint256 prize)",
      "event GameDraw(uint256 indexed gameId, uint256 refundEach)",
    ],
    init: initConnect4,
    renderGame: renderConnect4,
  },
};

// Global state
let provider, signer, contract;
let currentGame = null;
let gameEvents = [];
let currentGameId = null;
let selectedCell = null;
let selectedColumn = null;
let debugPanelVisible = false;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  initializeGameSelection();
  setupEventListeners();
});

// Game Selection Screen
function initializeGameSelection() {
  const gamesGrid = document.getElementById("games_grid");
  gamesGrid.innerHTML = "";

  Object.values(GAME_REGISTRY).forEach((game) => {
    const card = document.createElement("div");
    card.className = "game-card";
    card.innerHTML = `
      <div class="game-card-icon">${game.icon}</div>
      <div class="game-card-title">${game.name}</div>
      <div class="game-card-desc">${game.description}</div>
      <button class="arcade-button" onclick="selectGame('${game.id}')">PLAY</button>
    `;
    gamesGrid.appendChild(card);
  });
}

function selectGame(gameId) {
  if (!provider || !signer) {
    alert("Please connect your wallet first!");
    return;
  }

  currentGame = GAME_REGISTRY[gameId];
  if (!currentGame) {
    console.error("Game not found:", gameId);
    return;
  }

  // Initialize the game
  currentGame.init();

  // Switch to game view
  document.getElementById("game_selection_screen").style.display = "none";
  document.getElementById("main_game_view").style.display = "block";
  document.getElementById("current_game_title").textContent = currentGame.name;

  // Update UI
  updateArcadeUI();
}

// Make selectGame available globally
window.selectGame = selectGame;

// TicTacToe Game Implementation
function initTicTacToe() {
  if (!provider || !signer) {
    return;
  }

  contract = new ethers.Contract(
    currentGame.contractAddress,
    currentGame.abi,
    signer
  );

  // Set up event listeners
  setupTicTacToeEventListeners();

  // Initial refresh
  refresh();
}

function setupTicTacToeEventListeners() {
  if (!contract) return;

  // Remove existing listeners if any
  contract.removeAllListeners();

  contract.on(
    "GameCreated",
    (gameId, playerX, stakeIndex, stakeAmount, event) => {
      addGameEvent({
        type: "GameCreated",
        gameId: gameId.toString(),
        playerX,
        stakeIndex: stakeIndex.toString(),
        stakeAmount: ethers.utils.formatEther(stakeAmount),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: new Date().toLocaleTimeString(),
      });
      refresh();
    }
  );

  contract.on("GameJoined", (gameId, playerO, event) => {
    addGameEvent({
      type: "GameJoined",
      gameId: gameId.toString(),
      playerO,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    refresh();
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });

  contract.on("MoveMade", (gameId, player, position, symbol, event) => {
    addGameEvent({
      type: "MoveMade",
      gameId: gameId.toString(),
      player,
      position: position.toString(),
      symbol: symbol.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });

  contract.on("GameWon", (gameId, winner, prize, event) => {
    addGameEvent({
      type: "GameWon",
      gameId: gameId.toString(),
      winner,
      prize: ethers.utils.formatEther(prize),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    refresh();
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });

  contract.on("GameDraw", (gameId, refundEach, event) => {
    addGameEvent({
      type: "GameDraw",
      gameId: gameId.toString(),
      refundEach: ethers.utils.formatEther(refundEach),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    refresh();
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });
}

function renderTicTacToe(board, gameInfo, currentAccount) {
  const boardEl = document.getElementById("arcade_game_board");
  boardEl.innerHTML = "";

  const isPlayerX =
    currentAccount &&
    currentAccount.toLowerCase() === gameInfo.playerX.toLowerCase();
  const isPlayerO =
    currentAccount &&
    gameInfo.playerO &&
    currentAccount.toLowerCase() === gameInfo.playerO.toLowerCase();
  const isMyTurn =
    (gameInfo.turn === 1 && isPlayerX) || (gameInfo.turn === 2 && isPlayerO);
  const canMakeMove = gameInfo.status === 1 && isMyTurn;

  let statusText = "";
  if (gameInfo.status === 0) {
    statusText = "WAITING FOR PLAYER O TO JOIN...";
  } else if (gameInfo.status === 2) {
    if (gameInfo.winner === 0) {
      statusText = "GAME ENDED IN A DRAW!";
    } else {
      const winnerSymbol = gameInfo.winner === 1 ? "X" : "O";
      statusText = `GAME WON BY ${winnerSymbol}!`;
    }
  } else {
    const turnSymbol = gameInfo.turn === 1 ? "X" : "O";
    statusText = `CURRENT TURN: ${turnSymbol}`;
    if (isMyTurn) {
      statusText += " (YOUR TURN!)";
    }
  }
  document.getElementById("arcade_game_status").textContent = statusText;

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement("button");
    cell.className = "cell";
    cell.dataset.position = i;

    if (board[i] === 1) {
      cell.textContent = "X";
      cell.className += " x";
      cell.disabled = true;
    } else if (board[i] === 2) {
      cell.textContent = "O";
      cell.className += " o";
      cell.disabled = true;
    } else {
      cell.textContent = "";
      cell.className += " empty";
      if (canMakeMove) {
        cell.onclick = () => selectCell(i);
      } else {
        cell.disabled = true;
      }
    }

    boardEl.appendChild(cell);
  }

  // Show/hide make move button
  const makeMoveBtn = document.getElementById("arcade_btn_make_move");
  if (canMakeMove && selectedCell !== null) {
    makeMoveBtn.style.display = "block";
    makeMoveBtn.onclick = () => makeMove(currentGameId);
  } else {
    makeMoveBtn.style.display = "none";
  }
}

// Connect4 Game Implementation
function initConnect4() {
  if (!provider || !signer) {
    return;
  }

  contract = new ethers.Contract(
    currentGame.contractAddress,
    currentGame.abi,
    signer
  );

  // Set up event listeners
  setupConnect4EventListeners();

  // Initial refresh
  refresh();
}

function setupConnect4EventListeners() {
  if (!contract) return;

  // Remove existing listeners if any
  contract.removeAllListeners();

  contract.on(
    "GameCreated",
    (gameId, playerX, stakeIndex, stakeAmount, event) => {
      addGameEvent({
        type: "GameCreated",
        gameId: gameId.toString(),
        playerX,
        stakeIndex: stakeIndex.toString(),
        stakeAmount: ethers.utils.formatEther(stakeAmount),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: new Date().toLocaleTimeString(),
      });
      refresh();
    }
  );

  contract.on("GameJoined", (gameId, playerO, event) => {
    addGameEvent({
      type: "GameJoined",
      gameId: gameId.toString(),
      playerO,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    refresh();
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });

  contract.on("MoveMade", (gameId, player, column, row, symbol, event) => {
    addGameEvent({
      type: "MoveMade",
      gameId: gameId.toString(),
      player,
      column: column.toString(),
      row: row.toString(),
      symbol: symbol.toString(),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });

  contract.on("GameWon", (gameId, winner, prize, event) => {
    addGameEvent({
      type: "GameWon",
      gameId: gameId.toString(),
      winner,
      prize: ethers.utils.formatEther(prize),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    refresh();
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });

  contract.on("GameDraw", (gameId, refundEach, event) => {
    addGameEvent({
      type: "GameDraw",
      gameId: gameId.toString(),
      refundEach: ethers.utils.formatEther(refundEach),
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      timestamp: new Date().toLocaleTimeString(),
    });
    refresh();
    if (currentGameId && currentGameId.toString() === gameId.toString()) {
      loadGame(currentGameId);
    }
  });
}

function renderConnect4(board, gameInfo, currentAccount) {
  const boardEl = document.getElementById("arcade_game_board");
  boardEl.innerHTML = "";
  boardEl.className = "connect4-board-wrapper";

  const isPlayerX =
    currentAccount &&
    currentAccount.toLowerCase() === gameInfo.playerX.toLowerCase();
  const isPlayerO =
    currentAccount &&
    gameInfo.playerO &&
    currentAccount.toLowerCase() === gameInfo.playerO.toLowerCase();
  const isMyTurn =
    (gameInfo.turn === 1 && isPlayerX) || (gameInfo.turn === 2 && isPlayerO);
  const canMakeMove = gameInfo.status === 1 && isMyTurn;

  let statusText = "";
  if (gameInfo.status === 0) {
    statusText = "WAITING FOR PLAYER O TO JOIN...";
  } else if (gameInfo.status === 2) {
    if (gameInfo.winner === 0) {
      statusText = "GAME ENDED IN A DRAW!";
    } else {
      const winnerSymbol = gameInfo.winner === 1 ? "X" : "O";
      statusText = `GAME WON BY ${winnerSymbol}!`;
    }
  } else {
    const turnSymbol = gameInfo.turn === 1 ? "X" : "O";
    statusText = `CURRENT TURN: ${turnSymbol}`;
    if (isMyTurn) {
      statusText += " (YOUR TURN!)";
    }
  }
  document.getElementById("arcade_game_status").textContent = statusText;

  // Helper function to check if a column is full
  // Board is stored as: position = row * 7 + column
  // Top row (row 0) of column col is at position = 0 * 7 + col = col
  const isColumnFull = (col) => {
    return board[col] !== 0; // Check top row (row 0) of the column
  };

  // Create column header buttons
  const headerRow = document.createElement("div");
  headerRow.className = "connect4-header-row";
  for (let col = 0; col < 7; col++) {
    const headerBtn = document.createElement("button");
    headerBtn.className = "connect4-column-header";
    headerBtn.textContent = col + 1;
    headerBtn.dataset.column = col;

    if (canMakeMove && !isColumnFull(col)) {
      headerBtn.onclick = () => selectColumn(col);
      if (selectedColumn === col) {
        headerBtn.classList.add("selected");
      }
    } else {
      headerBtn.disabled = true;
    }

    headerRow.appendChild(headerBtn);
  }
  boardEl.appendChild(headerRow);

  // Create board cells container
  const cellsContainer = document.createElement("div");
  cellsContainer.className = "connect4-board";

  // Create board cells (6 rows × 7 columns)
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 7; col++) {
      const position = row * 7 + col;
      const cell = document.createElement("div");
      cell.className = "connect4-cell";
      cell.dataset.row = row;
      cell.dataset.column = col;
      cell.dataset.position = position;

      if (board[position] === 1) {
        cell.textContent = "X";
        cell.className += " x";
      } else if (board[position] === 2) {
        cell.textContent = "O";
        cell.className += " o";
      } else {
        cell.textContent = "";
        cell.className += " empty";
      }

      cellsContainer.appendChild(cell);
    }
  }
  boardEl.appendChild(cellsContainer);

  // Show/hide make move button
  const makeMoveBtn = document.getElementById("arcade_btn_make_move");
  if (canMakeMove && selectedColumn !== null) {
    makeMoveBtn.style.display = "block";
    makeMoveBtn.onclick = () => makeMove(currentGameId);
  } else {
    makeMoveBtn.style.display = "none";
  }
}

function selectColumn(column) {
  selectedColumn = column;
  // Update UI to show selected column
  const headers = document.querySelectorAll(".connect4-column-header");
  headers.forEach((header) => {
    if (parseInt(header.dataset.column) === column) {
      header.classList.add("selected");
    } else {
      header.classList.remove("selected");
    }
  });
  const makeMoveBtn = document.getElementById("arcade_btn_make_move");
  makeMoveBtn.style.display = "block";
  makeMoveBtn.onclick = () => makeMove(currentGameId);
}

// Event Listeners Setup
function setupEventListeners() {
  // Game selection screen
  document.getElementById("connect_selection").onclick = connect;
  document.getElementById("disconnect_selection").onclick = disconnect;

  // Main game view
  document.getElementById("back_to_selection").onclick = () => {
    document.getElementById("game_selection_screen").style.display = "block";
    document.getElementById("main_game_view").style.display = "none";
    currentGame = null;
    currentGameId = null;
    selectedCell = null;
    selectedColumn = null;
  };

  document.getElementById("debug_toggle").onclick = toggleDebugPanel;
  document.getElementById("refresh").onclick = refresh;

  // Arcade game actions
  document.getElementById("arcade_btn_create").onclick = createGame;
  document.getElementById("arcade_btn_load_game").onclick = async () => {
    const gameId = document.getElementById("arcade_game_id_input").value;
    if (!gameId) {
      alert("Enter a game ID");
      return;
    }
    await loadGame(parseInt(gameId));
  };
  document.getElementById("arcade_btn_make_move").onclick = () =>
    makeMove(currentGameId);
  document.getElementById("arcade_btn_withdraw").onclick = withdraw;
}

// Wallet Connection
async function connect() {
  const injected = await detectEthereumProvider();
  if (!injected) {
    alert("Install MetaMask");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();

  const address = await signer.getAddress();
  const net = await provider.getNetwork();

  // Update UI
  document.getElementById("wallet_prompt").style.display = "none";
  document.getElementById("wallet_connected").style.display = "block";
  document.getElementById("wallet_address_selection").textContent =
    address.substring(0, 6) + "..." + address.substring(address.length - 4);

  // Update debug panel
  document.getElementById("net").textContent =
    net.name + " (" + net.chainId + ")";
  document.getElementById("acct").textContent = address;

  // If a game is selected, initialize it
  if (currentGame) {
    currentGame.init();
  }

  await refresh();
  updateArcadeUI();
}

function disconnect() {
  provider = null;
  signer = null;
  contract = null;

  document.getElementById("wallet_prompt").style.display = "block";
  document.getElementById("wallet_connected").style.display = "none";

  // Clear debug panel
  document.getElementById("net").textContent = "—";
  document.getElementById("acct").textContent = "—";

  updateArcadeUI();
}

// Debug Panel Toggle
function toggleDebugPanel() {
  debugPanelVisible = !debugPanelVisible;
  const panel = document.getElementById("debug_panel");
  panel.style.display = debugPanelVisible ? "block" : "none";

  // Update button text
  document.getElementById("debug_toggle").textContent = debugPanelVisible
    ? "HIDE DEBUG"
    : "DEBUG";
}

// Update Arcade UI
function updateArcadeUI() {
  if (!signer) {
    document.getElementById("arcade_player_address").textContent =
      "NOT CONNECTED";
    document.getElementById("arcade_balance").textContent = "—";
    document.getElementById("arcade_opponent_address").textContent = "—";
    return;
  }

  signer.getAddress().then((address) => {
    document.getElementById("arcade_player_address").textContent =
      address.substring(0, 8) + "..." + address.substring(address.length - 6);
  });

  if (contract) {
    signer.getAddress().then((address) => {
      contract.balances(address).then((balance) => {
        document.getElementById("arcade_balance").textContent =
          ethers.utils.formatEther(balance) + " ETH";
        document.getElementById("balance").textContent =
          ethers.utils.formatEther(balance) + " ETH";
      });
    });
  }
}

// Game Events
function addGameEvent(eventData) {
  gameEvents.unshift(eventData);
  if (gameEvents.length > 20) {
    gameEvents = gameEvents.slice(0, 20);
  }
  updateGameEventsUI();
}

function updateGameEventsUI() {
  const container = document.getElementById("game_events");
  if (gameEvents.length === 0) {
    container.innerHTML =
      '<div class="event-empty">No game events yet. Connect wallet to start listening.</div>';
    return;
  }

  container.innerHTML = gameEvents
    .map((event) => {
      let details = "";
      if (event.type === "GameCreated") {
        details = `
          <div class="event-detail"><strong>gameId:</strong> ${event.gameId}</div>
          <div class="event-detail"><strong>playerX:</strong> <span class="mono">${event.playerX}</span></div>
          <div class="event-detail"><strong>stakeIndex:</strong> ${event.stakeIndex}</div>
          <div class="event-detail"><strong>stakeAmount:</strong> ${event.stakeAmount} ETH</div>
        `;
      } else if (event.type === "GameJoined") {
        details = `
          <div class="event-detail"><strong>gameId:</strong> ${event.gameId}</div>
          <div class="event-detail"><strong>playerO:</strong> <span class="mono">${event.playerO}</span></div>
        `;
      } else if (event.type === "MoveMade") {
        // Handle both TicTacToe (position) and Connect4 (column, row)
        if (event.column !== undefined && event.row !== undefined) {
          details = `
          <div class="event-detail"><strong>gameId:</strong> ${
            event.gameId
          }</div>
          <div class="event-detail"><strong>player:</strong> <span class="mono">${
            event.player
          }</span></div>
          <div class="event-detail"><strong>column:</strong> ${
            event.column
          }</div>
          <div class="event-detail"><strong>row:</strong> ${event.row}</div>
          <div class="event-detail"><strong>symbol:</strong> ${
            event.symbol === "1" ? "X" : "O"
          }</div>
        `;
        } else {
          details = `
          <div class="event-detail"><strong>gameId:</strong> ${
            event.gameId
          }</div>
          <div class="event-detail"><strong>player:</strong> <span class="mono">${
            event.player
          }</span></div>
          <div class="event-detail"><strong>position:</strong> ${
            event.position
          }</div>
          <div class="event-detail"><strong>symbol:</strong> ${
            event.symbol === "1" ? "X" : "O"
          }</div>
        `;
        }
      } else if (event.type === "GameWon") {
        details = `
          <div class="event-detail"><strong>gameId:</strong> ${event.gameId}</div>
          <div class="event-detail"><strong>winner:</strong> <span class="mono">${event.winner}</span></div>
          <div class="event-detail"><strong>prize:</strong> ${event.prize} ETH</div>
        `;
      } else if (event.type === "GameDraw") {
        details = `
          <div class="event-detail"><strong>gameId:</strong> ${event.gameId}</div>
          <div class="event-detail"><strong>refundEach:</strong> ${event.refundEach} ETH</div>
        `;
      }

      return `
        <div class="event-item">
          <div class="event-header">${event.type} - ${event.timestamp}</div>
          ${details}
          <div class="event-detail"><strong>block:</strong> ${event.blockNumber}</div>
          <div class="event-detail"><strong>tx:</strong> <span class="mono">${event.transactionHash}</span></div>
        </div>
      `;
    })
    .join("");
}

// Refresh
async function refresh() {
  if (!contract) {
    return;
  }

  try {
    const [stake0, stake1, stake2, nextId, balance] = await Promise.all([
      contract.STAKE_OPTIONS(0),
      contract.STAKE_OPTIONS(1),
      contract.STAKE_OPTIONS(2),
      contract.nextGameId(),
      signer
        ? contract.balances(await signer.getAddress())
        : Promise.resolve(0),
    ]);

    document.getElementById("stake0").textContent =
      ethers.utils.formatEther(stake0) + " ETH";
    document.getElementById("stake1").textContent =
      ethers.utils.formatEther(stake1) + " ETH";
    document.getElementById("stake2").textContent =
      ethers.utils.formatEther(stake2) + " ETH";
    document.getElementById("nextGameId").textContent = nextId.toString();
    document.getElementById("balance").textContent =
      ethers.utils.formatEther(balance) + " ETH";

    // Update stake select options
    const stakeSelect = document.getElementById("arcade_stake_select");
    stakeSelect.options[0].text = `Option 0 (${ethers.utils.formatEther(
      stake0
    )} ETH)`;
    stakeSelect.options[1].text = `Option 1 (${ethers.utils.formatEther(
      stake1
    )} ETH)`;
    stakeSelect.options[2].text = `Option 2 (${ethers.utils.formatEther(
      stake2
    )} ETH)`;

    // Refresh available games
    await refreshAvailableGames();

    // Update arcade UI
    updateArcadeUI();
  } catch (e) {
    console.error("Refresh error:", e);
  }
}

async function refreshAvailableGames() {
  if (!contract) {
    return;
  }

  try {
    const nextId = await contract.nextGameId();
    const availableGames = [];

    for (let i = 0; i < nextId; i++) {
      try {
        const gameInfo = await contract.getGameInfo(i);
        // status: 0 = WaitingForO, 1 = InProgress, 2 = Finished
        if (gameInfo.status === 0) {
          const stakeAmount = await contract.STAKE_OPTIONS(gameInfo.stakeIndex);
          availableGames.push({
            gameId: i,
            playerX: gameInfo.playerX,
            stakeIndex: gameInfo.stakeIndex.toString(),
            stakeAmount: ethers.utils.formatEther(stakeAmount),
          });
        }
      } catch (e) {
        // Game doesn't exist, skip
      }
    }

    const container = document.getElementById("arcade_available_games");
    if (availableGames.length === 0) {
      container.innerHTML =
        '<div class="event-empty">No available games. Create one above!</div>';
      return;
    }

    container.innerHTML = availableGames
      .map(
        (game) => `
      <div class="game-item">
        <div class="game-item-info">
          <div class="game-item-title">GAME #${game.gameId}</div>
          <div class="game-item-detail">Player X: <span class="mono">${game.playerX.substring(
            0,
            8
          )}...${game.playerX.substring(game.playerX.length - 6)}</span></div>
          <div class="game-item-detail">Stake: ${game.stakeAmount} ETH</div>
        </div>
        <button class="arcade-button" onclick="joinGame(${game.gameId}, ${
          game.stakeIndex
        })">JOIN</button>
      </div>
    `
      )
      .join("");
  } catch (e) {
    console.error("Refresh available games error:", e);
  }
}

// Game Actions
async function createGame() {
  if (!contract) {
    return alert("Connect wallet first");
  }

  const stakeIndex = parseInt(
    document.getElementById("arcade_stake_select").value
  );
  const status = document.getElementById("arcade_create_status");

  try {
    const stakeAmount = await contract.STAKE_OPTIONS(stakeIndex);
    status.textContent = "Sending tx…";

    const tx = await contract.createGame(stakeIndex, {
      value: stakeAmount,
      gasLimit: 500000,
    });

    status.textContent =
      "Transaction sent! Hash: " + tx.hash + " - Waiting for confirmation...";
    const rcpt = await tx.wait();
    const gameId = rcpt.events
      .find((e) => e.event === "GameCreated")
      .args.gameId.toString();
    status.textContent = "Game created! Game ID: " + gameId;
    await refresh();

    // Auto-load the created game
    document.getElementById("arcade_game_id_input").value = gameId;
    await loadGame(parseInt(gameId));
  } catch (e) {
    status.textContent = "Error: " + (e?.message || e);
  }
}

async function joinGame(gameId, stakeIndex) {
  if (!contract) {
    return alert("Connect wallet first");
  }

  try {
    const stakeAmount = await contract.STAKE_OPTIONS(stakeIndex);
    const tx = await contract.joinGame(gameId, {
      value: stakeAmount,
      gasLimit: 500000,
    });
    alert(
      "Transaction sent! Hash: " + tx.hash + " - Waiting for confirmation..."
    );
    const rcpt = await tx.wait();
    alert("Joined game! Tx: " + rcpt.transactionHash);
    await refresh();
    // Load the game after joining
    document.getElementById("arcade_game_id_input").value = gameId;
    await loadGame(gameId);
  } catch (e) {
    alert("Error: " + (e?.message || e));
  }
}

// Make joinGame available globally
window.joinGame = joinGame;

async function loadGame(gameId) {
  if (!contract) {
    return alert("Connect wallet first");
  }

  try {
    const [gameInfo, board] = await Promise.all([
      contract.getGameInfo(gameId),
      contract.getBoard(gameId),
    ]);

    currentGameId = gameId;

    // Update debug game info display
    const gameInfoEl = document.getElementById("game_info");
    gameInfoEl.style.display = "grid";
    document.getElementById("game_id_display").textContent = gameId.toString();
    document.getElementById("player_x").textContent = gameInfo.playerX;
    document.getElementById("player_o").textContent = gameInfo.playerO || "—";
    document.getElementById("game_status").textContent =
      gameInfo.status === 0
        ? "WaitingForO"
        : gameInfo.status === 1
        ? "InProgress"
        : "Finished";
    document.getElementById("game_turn").textContent =
      gameInfo.turn === 1 ? "X" : "O";
    document.getElementById("move_count").textContent =
      gameInfo.moveCount.toString();
    document.getElementById("game_winner").textContent =
      gameInfo.winner === 0 ? "None/Draw" : gameInfo.winner === 1 ? "X" : "O";

    const stakeAmount = await contract.STAKE_OPTIONS(gameInfo.stakeIndex);
    document.getElementById("game_stake").textContent =
      ethers.utils.formatEther(stakeAmount) + " ETH";

    // Update arcade opponent display
    const currentAccount = signer ? await signer.getAddress() : null;
    if (currentAccount) {
      const isPlayerX =
        currentAccount.toLowerCase() === gameInfo.playerX.toLowerCase();
      const opponent = isPlayerX ? gameInfo.playerO : gameInfo.playerX;
      if (opponent) {
        document.getElementById("arcade_opponent_address").textContent =
          opponent.substring(0, 8) +
          "..." +
          opponent.substring(opponent.length - 6);
      } else {
        document.getElementById("arcade_opponent_address").textContent =
          "WAITING...";
      }
    }

    // Update board using game's render function
    if (currentGame && currentGame.renderGame) {
      currentGame.renderGame(board, gameInfo, currentAccount);
    }

    document.getElementById("arcade_game_board_container").style.display =
      "block";
  } catch (e) {
    alert("Error loading game: " + (e?.message || e));
  }
}

function selectCell(position) {
  selectedCell = position;
  // Update UI to show selected cell
  const cells = document.querySelectorAll(".cell.empty");
  cells.forEach((cell) => {
    if (parseInt(cell.dataset.position) === position) {
      cell.classList.add("selected");
    } else {
      cell.classList.remove("selected");
    }
  });
  const makeMoveBtn = document.getElementById("arcade_btn_make_move");
  makeMoveBtn.style.display = "block";
  makeMoveBtn.onclick = () => makeMove(currentGameId);
}

async function makeMove(gameId) {
  if (!contract) {
    return alert("Connect wallet first");
  }

  // Check which game type we're playing
  const isConnect4 = currentGame && currentGame.id === "connect4";

  if (isConnect4) {
    if (selectedColumn === null) {
      return alert("Select a column first");
    }
  } else {
    if (selectedCell === null) {
      return alert("Select a cell first");
    }
  }

  const status = document.getElementById("arcade_move_status");
  try {
    status.textContent = "Sending tx…";
    const moveParam = isConnect4 ? selectedColumn : selectedCell;
    const tx = await contract.makeMove(gameId, moveParam, {
      gasLimit: 500000,
    });
    status.textContent =
      "Transaction sent! Hash: " + tx.hash + " - Waiting for confirmation...";
    const rcpt = await tx.wait();
    status.textContent = "Move made! Tx: " + rcpt.transactionHash;
    selectedCell = null;
    selectedColumn = null;
    await loadGame(gameId);
  } catch (e) {
    status.textContent = "Error: " + (e?.message || e);
  }
}

async function withdraw() {
  if (!contract) {
    return alert("Connect wallet first");
  }

  const status = document.getElementById("arcade_withdraw_status");
  try {
    status.textContent = "Sending tx…";
    const tx = await contract.withdraw({
      gasLimit: 200000,
    });
    status.textContent =
      "Transaction sent! Hash: " + tx.hash + " - Waiting for confirmation...";
    const rcpt = await tx.wait();
    status.textContent = "Withdrawn! Tx: " + rcpt.transactionHash;
    await refresh();
  } catch (e) {
    status.textContent = "Error: " + (e?.message || e);
  }
}
