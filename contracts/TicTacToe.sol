// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OnchainTicTacToe {
    enum Status {
        WaitingForO,
        InProgress,
        Finished
    }

    struct Game {
        address playerX;
        address playerO;
        uint8[9] board; // 0 = empty, 1 = X, 2 = O
        uint8 turn; // 1 = X, 2 = O
        uint8 moveCount;
        uint8 winner; // 0 = none/draw, 1 = X, 2 = O
        uint8 stakeIndex; // 0, 1, 2 into STAKE_OPTIONS
        Status status;
    }

    uint256[3] public STAKE_OPTIONS;

    // All games
    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    // Balances for withdrawing ETH
    mapping(address => uint256) public balances;

    event GameCreated(
        uint256 indexed gameId,
        address indexed playerX,
        uint8 stakeIndex,
        uint256 stakeAmount
    );
    event GameJoined(uint256 indexed gameId, address indexed playerO);
    event MoveMade(
        uint256 indexed gameId,
        address indexed player,
        uint8 position,
        uint8 symbol
    );
    event GameWon(
        uint256 indexed gameId,
        address indexed winner,
        uint256 prize
    );
    event GameDraw(uint256 indexed gameId, uint256 refundEach);

    constructor(uint256 stake0, uint256 stake1, uint256 stake2) {
        STAKE_OPTIONS[0] = stake0;
        STAKE_OPTIONS[1] = stake1;
        STAKE_OPTIONS[2] = stake2;
    }

    // --- Game creation / joining ---

    function createGame(
        uint8 stakeIndex
    ) external payable returns (uint256 gameId) {
        require(stakeIndex < 3, "Invalid stake index");
        uint256 requiredStake = STAKE_OPTIONS[stakeIndex];
        require(requiredStake > 0, "Stake not configured");
        require(msg.value == requiredStake, "Incorrect stake amount");

        gameId = nextGameId++;
        Game storage g = games[gameId];

        g.playerX = msg.sender;
        g.stakeIndex = stakeIndex;
        g.turn = 1; // X starts
        g.status = Status.WaitingForO;
        g.moveCount = 0;
        g.winner = 0;

        emit GameCreated(gameId, msg.sender, stakeIndex, requiredStake);
    }

    function joinGame(uint256 gameId) external payable {
        Game storage g = games[gameId];

        require(g.playerX != address(0), "Game does not exist");
        require(g.status == Status.WaitingForO, "Game not waiting for O");
        require(msg.sender != g.playerX, "Creator cannot join own game");

        uint256 requiredStake = STAKE_OPTIONS[g.stakeIndex];
        require(msg.value == requiredStake, "Incorrect stake amount");

        g.playerO = msg.sender;
        g.status = Status.InProgress;

        emit GameJoined(gameId, msg.sender);
    }

    function makeMove(uint256 gameId, uint8 position) external {
        Game storage g = games[gameId];

        require(g.status == Status.InProgress, "Game not in progress");
        require(position < 9, "Position out of range");

        if (g.turn == 1) {
            require(msg.sender == g.playerX, "Not X's turn");
        } else {
            require(msg.sender == g.playerO, "Not O's turn");
        }

        require(g.board[position] == 0, "Cell already taken");

        g.board[position] = g.turn;
        g.moveCount++;

        emit MoveMade(gameId, msg.sender, position, g.turn);

        if (_checkWin(g.board, g.turn)) {
            g.status = Status.Finished;
            g.winner = g.turn;

            address winnerAddr = (g.turn == 1) ? g.playerX : g.playerO;
            uint256 pot = 2 * STAKE_OPTIONS[g.stakeIndex];
            balances[winnerAddr] += pot;

            emit GameWon(gameId, winnerAddr, pot);
            return;
        }

        if (g.moveCount == 9) {
            g.status = Status.Finished;
            g.winner = 0; // draw

            uint256 stake = STAKE_OPTIONS[g.stakeIndex];
            balances[g.playerX] += stake;
            balances[g.playerO] += stake;

            emit GameDraw(gameId, stake);
            return;
        }

        g.turn = (g.turn == 1) ? 2 : 1;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        balances[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "ETH transfer failed");
    }

    function getBoard(uint256 gameId) external view returns (uint8[9] memory) {
        return games[gameId].board;
    }

    function getGameInfo(
        uint256 gameId
    )
        external
        view
        returns (
            address playerX,
            address playerO,
            uint8 turn,
            uint8 moveCount,
            uint8 winner,
            uint8 stakeIndex,
            Status status
        )
    {
        Game storage g = games[gameId];
        return (
            g.playerX,
            g.playerO,
            g.turn,
            g.moveCount,
            g.winner,
            g.stakeIndex,
            g.status
        );
    }

    function _checkWin(
        uint8[9] storage b,
        uint8 s
    ) internal view returns (bool) {
        // Rows
        if (b[0] == s && b[1] == s && b[2] == s) return true;
        if (b[3] == s && b[4] == s && b[5] == s) return true;
        if (b[6] == s && b[7] == s && b[8] == s) return true;

        // Columns
        if (b[0] == s && b[3] == s && b[6] == s) return true;
        if (b[1] == s && b[4] == s && b[7] == s) return true;
        if (b[2] == s && b[5] == s && b[8] == s) return true;

        // Diagonals
        if (b[0] == s && b[4] == s && b[8] == s) return true;
        if (b[2] == s && b[4] == s && b[6] == s) return true;

        return false;
    }

    function _checkWinBitwise(
        uint8[9] storage b,
        uint8 s
    ) internal view returns (bool) {
        // TODO: bitwise check for win using bitwise operations
        return false;
    }
}
