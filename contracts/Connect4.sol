// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract OnchainConnect4 {
    enum Status {
        WaitingForO,
        InProgress,
        Finished
    }

    struct Game {
        address playerX;
        address playerO;
        uint8[42] board; // 7 columns × 6 rows = 42 cells, 0 = empty, 1 = X, 2 = O
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
        uint8 column,
        uint8 row,
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

    function makeMove(uint256 gameId, uint8 column) external {
        Game storage g = games[gameId];

        require(g.status == Status.InProgress, "Game not in progress");
        require(column < 7, "Column out of range");

        if (g.turn == 1) {
            require(msg.sender == g.playerX, "Not X's turn");
        } else {
            require(msg.sender == g.playerO, "Not O's turn");
        }

        // Find the lowest available row in the column
        uint8 row = _findLowestRow(g.board, column);
        require(row < 6, "Column is full");

        // Calculate position in flattened array: row * 7 + column
        uint8 position = row * 7 + column;
        require(g.board[position] == 0, "Cell already taken");

        g.board[position] = g.turn;
        g.moveCount++;

        emit MoveMade(gameId, msg.sender, column, row, g.turn);

        if (_checkWin(g.board, position, g.turn)) {
            g.status = Status.Finished;
            g.winner = g.turn;

            address winnerAddr = (g.turn == 1) ? g.playerX : g.playerO;
            uint256 pot = 2 * STAKE_OPTIONS[g.stakeIndex];
            balances[winnerAddr] += pot;

            emit GameWon(gameId, winnerAddr, pot);
            return;
        }

        if (g.moveCount == 42) {
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

    function getBoard(uint256 gameId) external view returns (uint8[42] memory) {
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

    // Find the lowest available row in a column (returns 6 if column is full)
    function _findLowestRow(
        uint8[42] storage board,
        uint8 column
    ) internal view returns (uint8) {
        // Check from bottom (row 5) to top (row 0)
        for (uint8 row = 5; row >= 0; row--) {
            uint8 position = row * 7 + column;
            if (board[position] == 0) {
                return row;
            }
            if (row == 0) break; // Prevent underflow
        }
        return 6; // Column is full
    }

    // Check for 4 in a row starting from the given position
    function _checkWin(
        uint8[42] storage board,
        uint8 position,
        uint8 symbol
    ) internal view returns (bool) {
        uint8 row = position / 7;
        uint8 col = position % 7;

        // Check horizontal (left to right)
        if (_checkDirection(board, row, col, 0, 1, symbol)) return true;

        // Check vertical (top to bottom)
        if (_checkDirection(board, row, col, 1, 0, symbol)) return true;

        // Check diagonal (top-left to bottom-right)
        if (_checkDirection(board, row, col, 1, 1, symbol)) return true;

        // Check diagonal (top-right to bottom-left)
        if (_checkDirection(board, row, col, 1, -1, symbol)) return true;

        return false;
    }

    // Check for 4 in a row in a given direction
    function _checkDirection(
        uint8[42] storage board,
        uint8 startRow,
        uint8 startCol,
        int8 deltaRow,
        int8 deltaCol,
        uint8 symbol
    ) internal view returns (bool) {
        uint8 count = 1; // Count the starting position

        // Check in positive direction
        int8 r = int8(startRow) + deltaRow;
        int8 c = int8(startCol) + deltaCol;
        while (
            r >= 0 &&
            r < 6 &&
            c >= 0 &&
            c < 7 &&
            board[uint8(r) * 7 + uint8(c)] == symbol
        ) {
            count++;
            if (count >= 4) return true;
            r += deltaRow;
            c += deltaCol;
        }

        // Check in negative direction
        r = int8(startRow) - deltaRow;
        c = int8(startCol) - deltaCol;
        while (
            r >= 0 &&
            r < 6 &&
            c >= 0 &&
            c < 7 &&
            board[uint8(r) * 7 + uint8(c)] == symbol
        ) {
            count++;
            if (count >= 4) return true;
            r -= deltaRow;
            c -= deltaCol;
        }

        return false;
    }
}
