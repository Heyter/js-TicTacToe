const TicTacToe = {
	games: [], // stored games
	freePlayers: [],
	players: [], // room players
	timers: {},

	findGame: function (client) {
		// TODO: Promise?
		if (this.freePlayers.length > 0) {
			let opponent, freeIdx;

			for (const idx in this.freePlayers) {
				if (client !== this.freePlayers[idx]) {
					opponent = this.freePlayers[idx];
					freeIdx = idx;
					break;
				}
			}

			if (opponent && opponent.token) {
				const clientGameId = this.players[opponent.token];
				const opponentGameId = this.players[client.token];

				const clientGame = this.games[clientGameId];
				const opponentGame = this.games[opponentGameId];

				if (!clientGame && !opponentGame) {
					if (freeIdx) this.freePlayers.splice(freeIdx, 1);

					const game = new Game(client, opponent);
					this.games[game.id] = game;

					this.players[client.token] = game.id;
					this.players[opponent.token] = game.id;

					const index = this.freePlayers.indexOf(client);
					if (index > -1) this.freePlayers.splice(index, 1);

					game.start(true);
				} else {
					if (clientGame) {
						const index = this.freePlayers.indexOf(client);
						if (index > -1) this.freePlayers.splice(index, 1);
					}

					if (opponentGame) if (freeIdx) this.freePlayers.splice(freeIdx, 1);
				}
			}
		} else {
			client.emit('game:find');
			this.freePlayers.push(client);
		}
	},

	freeGame: function (gameId, clearTimer, savedToken) {
		if (clearTimer) this.clearGameTimer(gameId);

		if (gameId) {
			delete this.games[gameId];

			const clients = global.socket_io.sockets.adapter.rooms.get(gameId);
			const numClients = clients ? clients.size : 0;
			const rooms = global.socket_io.sockets.sockets;

			if (numClients > 0) {
				for (const clientId of clients) {
					const client = rooms.get(clientId);
					if (!client) continue;

					client.emit('game:disconnect', savedToken ?? -1);
					client.leave(gameId);

					if (client.token) this.players[client.token] = null;
				}
			}

			for (const token of this.players)
				if (this.players[token] === gameId) this.players[token] = null;
		}
	},

	clearGameTimer: function (gameId) {
		if (gameId && this.timers[gameId]) {
			clearTimeout(this.timers[gameId]);
			delete this.timers[gameId];
		}
	},

	freeGameTimer: function (token) {
		const gameId = this.players[token];
		if (!gameId) return;

		const clients = global.socket_io.sockets.adapter.rooms.get(gameId);
		const numClients = clients ? clients.size : 0;

		if (numClients > 0) {
			this.timers[gameId] = setTimeout(() => {
				this.freeGame(gameId, true, token);
			}, 10000);
		} else this.freeGame(gameId, true, token);
	},

	reconnectToGame: function (client) {
		const token = client.token;
		const gameId = this.players[token];

		if (gameId) {
			const game = this.games[gameId];

			if (game) {
				const player = game.players[token];

				if (player) {
					this.clearGameTimer(gameId);

					client.join(gameId);
					client.emit(
						'game:reconnect',
						{
							sizeOfBoard: game.sizeOfBoard,
							hasWinner: game.hasWinner,
							turn: game.turn,
							slots: [...game.slots],
						},
						player.turn
					);
				}
			}
		}
	},

	playerHasGame: function (token) {
		const gameId = this.players[token];
		return gameId && this.games[gameId] ? true : false;
	},

	makeMove: function (client, id) {
		const gameId = this.players[client.token];

		if (gameId) {
			const game = this.games[gameId];
			if (game) game.makeMove(client, id);
		}
	},
};

class Game {
	constructor(user, opponent, sizeOfBoard = 3) {
		this.sizeOfBoard = sizeOfBoard;
		this.slots = [];
		this.hasWinner = false;
		this.turn = 'X';
		this.id = Date.now();

		this.user = user;
		this.opponent = opponent;
	}

	start(isNewGame, sizeOfBoard = 3) {
		if (this.timerHandle) {
			clearTimeout(this.timerHandle);
			this.timerHandle = null;
		}

		this.sizeOfBoard = sizeOfBoard;
		this.players = {
			[this.user.token]: {
				rowsContainer: 0,
				columnsContainer: 0,
				diagonalContainer: 0,
				oppositeDiagonalContainer: 0,
			},

			[this.opponent.token]: {
				rowsContainer: 0,
				columnsContainer: 0,
				diagonalContainer: 0,
				oppositeDiagonalContainer: 0,
			},
		};

		for (const key in this.players) {
			const player = this.players[key];

			for (const key2 in player) player[key2] = Array(this.sizeOfBoard).fill(0);
		}

		Math.random();
		this.turn = Math.random() <= 0.5 ? 'O' : 'X';
		this.slots = Array(this.sizeOfBoard * this.sizeOfBoard).fill(0);
		this.hasWinner = false;

		this.players[this.user.token].turn = this.turn;
		this.players[this.opponent.token].turn = this.turn === 'X' ? 'O' : 'X';

		if (isNewGame) {
			this.user.join(this.id);
			this.opponent.join(this.id);
		}

		global.socket_io.to(this.id).emit(
			'game:start',
			{
				sizeOfBoard: this.sizeOfBoard,
				hasWinner: this.hasWinner,
				turn: this.turn,
			},
			{
				[this.user.token]: this.turn,
				[this.opponent.token]: this.turn === 'X' ? 'O' : 'X',
			}
		);
	}

	// Fast algorithm https://jayeshkawli.ghost.io/tic-tac-toe/
	makeMove(client, id) {
		if (this.hasWinner) return false;
		if (this.slots[id] !== 0) return false;

		const player = this.players[client.token];
		if (!player) return false;

		const turn = this.turn;
		if (player.turn !== turn) return false;

		this.slots[id] = turn;

		const sizeOfBoard = this.sizeOfBoard;
		const row = Math.floor(id % sizeOfBoard);
		const column = Math.floor(id / sizeOfBoard);

		player.rowsContainer[row] += 1;
		player.columnsContainer[column] += 1;

		// Win across row
		if (player.rowsContainer[row] === sizeOfBoard) {
			this.makeWin(turn, 1, id);
			return false;
		}

		// Win across column
		if (player.columnsContainer[column] === sizeOfBoard) {
			this.makeWin(turn, 2, id);
			return false;
		}

		if (row === column) player.diagonalContainer[row] += 1;
		if (row + column + 1 === sizeOfBoard) player.oppositeDiagonalContainer[row] += 1;

		const sumForRegularDiagonalElements = player.diagonalContainer.reduce((a, b) => a + b, 0);
		const sumForOppositeDiagonalElements = player.oppositeDiagonalContainer.reduce(
			(a, b) => a + b,
			0
		);

		// Win across regular diagonal
		if (sumForRegularDiagonalElements === sizeOfBoard) {
			this.makeWin(turn, 3, id);
			return false;
		}

		// Win across opposite diagonal
		if (sumForOppositeDiagonalElements === sizeOfBoard) {
			this.makeWin(turn, 4, id);
			return false;
		}

		const sumForDraw = this.slots.reduce(
			(counter, value) => counter + (value !== 0 ? 1 : 0),
			0
		);

		// No winner
		if (sumForDraw >= sizeOfBoard * sizeOfBoard) {
			this.makeWin(turn, -1, id);
			return false;
		}

		this.turn = turn === 'X' ? 'O' : 'X';
		global.socket_io.to(this.id).emit('game:turn', turn, this.turn, id);

		return true;
	}

	makeWin(turn, winId, id) {
		this.hasWinner = true;
		global.socket_io.to(this.id).emit('game:win', turn, winId, id);

		this.timerHandle = setTimeout(() => {
			this.timerHandle = null;

			if (TicTacToe.games[this.id]) this.start();
		}, 2000);
	}
}

export default TicTacToe;
