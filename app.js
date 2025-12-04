const CONTRACT_ADDR = "0x2dA8Edf5D07628A0FB9224fef70c56ec691cefa9";

const ABI = [
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
];

let provider, signer, contract;
let gameEvents = [];
let currentGameId = null;
let selectedCell = null;

async function connect() {
  const injected = await detectEthereumProvider();
  if (!injected) {
    alert("Install MetaMask");
    return;
  }

  provider = new ethers.providers.Web3Provider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = provider.getSigner();
  contract = new ethers.Contract(CONTRACT_ADDR, ABI, signer);

  const net = await provider.getNetwork();
  document.getElementById("net").textContent =
    net.name + " (" + net.chainId + ")";
  document.getElementById("acct").textContent = await signer.getAddress();

  await refresh();

  // Set up event listeners
  contract.on("GameCreated", (gameId, playerX, stakeIndex, stakeAmount, event) => {
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
  });

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
        details = `
          <div class="event-detail"><strong>gameId:</strong> ${event.gameId}</div>
          <div class="event-detail"><strong>player:</strong> <span class="mono">${event.player}</span></div>
          <div class="event-detail"><strong>position:</strong> ${event.position}</div>
          <div class="event-detail"><strong>symbol:</strong> ${event.symbol === "1" ? "X" : "O"}</div>
        `;
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
      signer ? contract.balances(await signer.getAddress()) : Promise.resolve(0),
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
    const stakeSelect = document.getElementById("stake_select");
    stakeSelect.options[0].text = `Option 0 (${ethers.utils.formatEther(stake0)} ETH)`;
    stakeSelect.options[1].text = `Option 1 (${ethers.utils.formatEther(stake1)} ETH)`;
    stakeSelect.options[2].text = `Option 2 (${ethers.utils.formatEther(stake2)} ETH)`;

    // Refresh available games
    await refreshAvailableGames();
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

    const container = document.getElementById("available_games");
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
          <div class="game-item-title">Game #${game.gameId}</div>
          <div class="game-item-detail">Player X: <span class="mono">${game.playerX}</span></div>
          <div class="game-item-detail">Stake: ${game.stakeAmount} ETH</div>
        </div>
        <button onclick="joinGame(${game.gameId}, ${game.stakeIndex})">Join Game</button>
      </div>
    `
      )
      .join("");
  } catch (e) {
    console.error("Refresh available games error:", e);
  }
}

async function createGame() {
  if (!contract) {
    return alert("Connect wallet first");
  }

  const stakeIndex = parseInt(document.getElementById("stake_select").value);
  const status = document.getElementById("create_status");

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
    status.textContent = "Game created! Game ID: " + rcpt.events.find(e => e.event === 'GameCreated').args.gameId.toString() + " - Tx: " + rcpt.transactionHash;
    await refresh();
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
    alert("Transaction sent! Hash: " + tx.hash + " - Waiting for confirmation...");
    const rcpt = await tx.wait();
    alert("Joined game! Tx: " + rcpt.transactionHash);
    await refresh();
    // Load the game after joining
    document.getElementById("game_id_input").value = gameId;
    await loadGame(gameId);
  } catch (e) {
    alert("Error: " + (e?.message || e));
  }
}

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

    // Update game info display
    document.getElementById("game_info").style.display = "grid";
    document.getElementById("game_id_display").textContent = gameId.toString();
    document.getElementById("player_x").textContent = gameInfo.playerX;
    document.getElementById("player_o").textContent =
      gameInfo.playerO || "—";
    document.getElementById("game_status").textContent =
      gameInfo.status === 0
        ? "WaitingForO"
        : gameInfo.status === 1
        ? "InProgress"
        : "Finished";
    document.getElementById("game_turn").textContent =
      gameInfo.turn === 1 ? "X" : "O";
    document.getElementById("move_count").textContent = gameInfo.moveCount.toString();
    document.getElementById("game_winner").textContent =
      gameInfo.winner === 0
        ? "None/Draw"
        : gameInfo.winner === 1
        ? "X"
        : "O";

    const stakeAmount = await contract.STAKE_OPTIONS(gameInfo.stakeIndex);
    document.getElementById("game_stake").textContent =
      ethers.utils.formatEther(stakeAmount) + " ETH";

    // Update board
    const currentAccount = signer ? await signer.getAddress() : null;
    renderBoard(board, gameInfo, currentAccount);

    document.getElementById("game_board_container").style.display = "block";
  } catch (e) {
    alert("Error loading game: " + (e?.message || e));
  }
}

function renderBoard(board, gameInfo, currentAccount) {
  const boardEl = document.getElementById("game_board");
  boardEl.innerHTML = "";

  const isPlayerX = currentAccount && currentAccount.toLowerCase() === gameInfo.playerX.toLowerCase();
  const isPlayerO = currentAccount && gameInfo.playerO && currentAccount.toLowerCase() === gameInfo.playerO.toLowerCase();
  const isMyTurn = (gameInfo.turn === 1 && isPlayerX) || (gameInfo.turn === 2 && isPlayerO);
  const canMakeMove = gameInfo.status === 1 && isMyTurn;

  let statusText = "";
  if (gameInfo.status === 0) {
    statusText = "Waiting for player O to join...";
  } else if (gameInfo.status === 2) {
    if (gameInfo.winner === 0) {
      statusText = "Game ended in a draw!";
    } else {
      statusText = `Game won by ${gameInfo.winner === 1 ? "X" : "O"}!`;
    }
  } else {
    statusText = `Current turn: ${gameInfo.turn === 1 ? "X" : "O"}`;
    if (isMyTurn) {
      statusText += " (Your turn!)";
    }
  }
  document.getElementById("board_status").textContent = statusText;

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
  const makeMoveBtn = document.getElementById("btn_make_move");
  if (canMakeMove && selectedCell !== null) {
    makeMoveBtn.style.display = "block";
    makeMoveBtn.onclick = () => makeMove(currentGameId);
  } else {
    makeMoveBtn.style.display = "none";
  }
}

function selectCell(position) {
  selectedCell = position;
  // Update UI to show selected cell
  const cells = document.querySelectorAll(".cell.empty");
  cells.forEach((cell) => {
    if (parseInt(cell.dataset.position) === position) {
      cell.style.background = "#e3f2fd";
    } else {
      cell.style.background = "white";
    }
  });
  const makeMoveBtn = document.getElementById("btn_make_move");
  makeMoveBtn.style.display = "block";
  makeMoveBtn.onclick = () => makeMove(currentGameId);
}

async function makeMove(gameId) {
  if (!contract) {
    return alert("Connect wallet first");
  }

  if (selectedCell === null) {
    return alert("Select a cell first");
  }

  const status = document.getElementById("move_status");
  try {
    status.textContent = "Sending tx…";
    const tx = await contract.makeMove(gameId, selectedCell, {
      gasLimit: 500000,
    });
    status.textContent =
      "Transaction sent! Hash: " + tx.hash + " - Waiting for confirmation...";
    const rcpt = await tx.wait();
    status.textContent = "Move made! Tx: " + rcpt.transactionHash;
    selectedCell = null;
    await loadGame(gameId);
  } catch (e) {
    status.textContent = "Error: " + (e?.message || e);
  }
}

async function withdraw() {
  if (!contract) {
    return alert("Connect wallet first");
  }

  const status = document.getElementById("withdraw_status");
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

// Event listeners
document.getElementById("connect").onclick = connect;
document.getElementById("refresh").onclick = refresh;
document.getElementById("btn_create").onclick = createGame;
document.getElementById("btn_load_game").onclick = async () => {
  const gameId = document.getElementById("game_id_input").value;
  if (!gameId) {
    alert("Enter a game ID");
    return;
  }
  await loadGame(parseInt(gameId));
};
document.getElementById("btn_withdraw").onclick = withdraw;

// Make joinGame available globally for onclick handlers
window.joinGame = joinGame;
