import { createRef, Component } from 'react';
import io from 'socket.io-client';
import './App.css';

class App extends Component {
	constructor() {
		super();

		this.ticTacToeRef = createRef();

		this.state = {
			turn: 'X',
			slots: [],
			hasWinner: false,
			winnerSlot: null,
			sizeOfBoard: 3,
			myTurn: 'X',
			founded: false,
			search: false,
			moveTimer: null,
			token: localStorage.getItem('game_token'),
			socket: io(null, {
				autoConnect: false,
				reconnectionAttempts: 3,
			}),
		};

		this.handleStartButton = this.handleStartButton.bind(this);
		this.handleSlotClick = this.handleSlotClick.bind(this);

		const socket = this.state.socket;
		socket.open();

		socket.on('connect', () => {
			const state = this.state;

			if (!(state.token?.length > 9)) {
				const token =
					Date.now().toString(36) +
					Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(
						36
					) +
					state.socket.id;

				localStorage.setItem('game_token', token);
				state.token = token;
			}

			state.socket.emit('game:auth', state.token);

			// TODO: reconnect
			this.setState({
				turn: 'X',
				slots: [],
				hasWinner: false,
				winnerSlot: null,
				sizeOfBoard: 3,
				myTurn: 'X',
				founded: false,
				search: false,
				moveTimer: null,
			});
		});

		socket.on('game:token', (newToken) => {
			localStorage.setItem('game_token', newToken);
			this.state.token = newToken;
		});

		socket.on('game:start', (settings, info) => {
			this.state.moveTimer = 0;
			this.ticTacToeRef.current.style.setProperty('--sizeOfBoard', settings.sizeOfBoard);

			this.setState({
				sizeOfBoard: settings.sizeOfBoard,
				turn: settings.turn,
				hasWinner: settings.hasWinner,
				winnerSlot: null,
				founded: true,
				search: false,
				myTurn: info[this.state.token] || 'X',
				slots: new Array(settings.sizeOfBoard * settings.sizeOfBoard).fill(0),
			});
		});

		socket.on('game:win', (turn, winId, id) => {
			this.state.slots[id] = turn;
			this.setState({
				hasWinner: winId,
				winnerSlot: id,
				slots: this.state.slots,
			});

			if (winId !== -1) console.log('Win', turn);
			else console.log('Draw');
		});

		socket.on('game:turn', (oldTurn, curTurn, id) => {
			this.state.slots[id] = oldTurn;
			this.state.moveTimer = 0;

			this.setState({
				turn: curTurn,
				slots: this.state.slots,
			});
		});

		socket.on('game:disconnect', (token) => {
			if (this.state.token !== token) console.log('Opponent left the game');

			this.setState({
				founded: false,
				search: false,
				hasWinner: false,
				winnerSlot: null,
				slots: [],
			});
		});

		socket.on('game:reconnect', (settings, myTurn) => {
			this.state.moveTimer = 0;
			this.ticTacToeRef.current.style.setProperty('--sizeOfBoard', settings.sizeOfBoard);

			this.setState({
				sizeOfBoard: settings.sizeOfBoard,
				turn: settings.turn,
				hasWinner: settings.hasWinner,
				winnerSlot: null,
				founded: true,
				search: false,
				myTurn: myTurn,
				slots: settings.slots,
			});
		});

		socket.on('game:find', () => {
			this.setState({
				search: true,
				founded: false,
				hasWinner: false,
				winnerSlot: null,
				slots: [],
			});
		});
	}

	handleStartButton() {
		const socket = this.state.socket;

		if (this.state.search || this.state.founded) {
			socket.emit('game:exit');

			this.setState({
				founded: false,
				search: false,
				hasWinner: false,
				winnerSlot: null,
				slots: [],
			});
		} else if (!this.state.founded) socket.emit('game:find');
	}

	handleSlotClick(idx) {
		const state = this.state;

		if (state.hasWinner === false) {
			if (state.moveTimer && state.moveTimer > Date.now()) return;
			if (state.turn !== state.myTurn) return;

			if (state.slots[idx] === 0) {
				state.moveTimer = Date.now() + 5000;
				state.socket.emit('game:move', idx);
			}
		}
	}

	componentWillUnmount() {
		const socket = this.state.socket;

		socket.off('connect');
		socket.off('game:token');
		socket.off('game:start');
		socket.off('game:win');
		socket.off('game:turn');
		socket.off('game:disconnect');
		socket.off('game:reconnect');
		socket.off('game:find');

		socket.close();
	}

	render() {
		const state = this.state;
		const updateSlots = [];

		if (state.hasWinner !== false && state.hasWinner !== -1 && state.winnerSlot !== null) {
			const sizeOfBoard = state.sizeOfBoard;
			const column = Math.floor(state.winnerSlot % sizeOfBoard);
			const row = Math.floor(state.winnerSlot / sizeOfBoard);
			let step = 0;

			for (const id in state.slots) {
				if (step >= sizeOfBoard) break;

				const column2 = Math.floor(id % sizeOfBoard);
				const row2 = Math.floor(id / sizeOfBoard);

				let found = false;

				if (state.hasWinner === 1) {
					if (column2 === column) found = true;
				} else if (state.hasWinner === 2) {
					if (row2 === row) found = true;
				} else if (state.hasWinner === 3) {
					if (row2 === column2) found = true;
				} else if (state.hasWinner === 4) {
					if (row2 + column2 + 1 === sizeOfBoard) found = true;
				}

				if (found) {
					updateSlots[id] = true;
					step++;
				}
			}
		}

		return (
			<div className="container">
				<header className="header">
					<div>
						<div id="game-you">{state.founded && `You play: ${state.myTurn}`}</div>
						<div id="game-you-turn">
							{state.founded &&
								!state.search &&
								state.myTurn === state.turn &&
								'Your turn'}
						</div>
					</div>

					<div>
						<button
							type="button"
							id="game-start-button"
							onClick={() => this.handleStartButton()}
						>
							{state.search
								? 'Stop finding a game'
								: state.founded
								? 'Leave the game'
								: 'Find a game'}
						</button>
					</div>
				</header>
				<section
					ref={this.ticTacToeRef}
					className="tic-tac-toe"
					style={state.slots.length === 0 ? { display: 'none' } : { display: 'grid' }}
				>
					{state.slots.map((value, idx) => (
						<button
							index={`ttt-${value}-${idx}`}
							className={updateSlots[idx] ? 'item-box item-box-selected' : 'item-box'}
							type="button"
							onClick={() => this.handleSlotClick(idx)}
						>
							{value !== 0 && value}
						</button>
					))}
				</section>
			</div>
		);
	}
}

export default App;
