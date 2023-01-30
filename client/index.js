const socket = io();

// const API_URL = 'http://localhost:3000/';
// const fetchApi = (path, options) => fetch(API_URL + path, options);

const Game = {
	turn: 'X',
	slots: [],
	hasWinner: false,
	sizeOfBoard: 3,
	myTurn: 'X',
	founded: false,
	search: false,
};

function drawWinner(winId, id) {
	Game.hasWinner = true;
	if (winId === -1) return;

	const sizeOfBoard = Game.sizeOfBoard;
	const itemList = [...document.querySelectorAll('.item-box')];
	const column = Math.floor(id % sizeOfBoard);
	const row = Math.floor(id / sizeOfBoard);
	let step = 0;

	for (const key in itemList) {
		if (step >= sizeOfBoard) break;

		const element = itemList[key];
		const id2 = element.dataset.id;
		const column2 = Math.floor(id2 % sizeOfBoard);
		const row2 = Math.floor(id2 / sizeOfBoard);

		let found = false;

		if (winId === 1) {
			if (column2 === column) found = true;
		} else if (winId === 2) {
			if (row2 === row) found = true;
		} else if (winId === 3) {
			if (row2 === column2) found = true;
		} else if (winId === 4) {
			if (row2 + column2 + 1 === sizeOfBoard) found = true;
		}

		if (found) {
			element.classList.add('item-box-selected');
			step += 1;
		}
	}
}

function resetGame() {
	const parentNode = document.querySelector('.tic-tac-toe');
	while (parentNode.hasChildNodes()) parentNode.removeChild(parentNode.firstChild);

	parentNode.style.setProperty('--sizeOfBoard', Game.sizeOfBoard);

	Game.slots = [];

	for (let i = 0; i < Game.sizeOfBoard * Game.sizeOfBoard; i++) {
		Game.slots[i] = 0;

		const element = document.createElement('button');
		element.setAttribute('class', 'item-box');
		element.setAttribute('type', 'button');
		element.setAttribute('data-id', i);
		element.setAttribute('id', 'item-id-' + i);
		element.onclick = function (e) {
			if (Game.hasWinner) return;
			if (Game.moveTimer && Game.moveTimer > Date.now()) return;
			if (Game.turn !== Game.myTurn) return;

			const target = e.target;
			const id = target.dataset.id;

			if (Game.slots[id] === 0) {
				Game.moveTimer = Date.now() + 5000;
				socket.emit('game:move', id);
			}
		};

		parentNode.appendChild(element);
	}

	Game.hasWinner = false;
	parentNode.style = '';
}

window.addEventListener('DOMContentLoaded', function () {
	let uniqueId = window.localStorage.getItem('game_token'); // meh

	const turnInfoNode = document.getElementById('game-you-turn');
	const startButtonNode = document.getElementById('game-start-button');
	const turnNode = document.getElementById('game-you');
	const parentNode = document.querySelector('.tic-tac-toe');

	parentNode.style = 'display: none;';

	socket.on('connect', function () {
		if (!(uniqueId?.length > 9)) {
			uniqueId = Date.now().toString(36) + Math.floor(Math.pow(10, 12) + Math.random() * 9 * Math.pow(10, 12)).toString(36) + socket.id;

			window.localStorage.setItem('game_token', uniqueId);
		}

		if (startButtonNode) startButtonNode.dispatchEvent(new Event('update-info'));
		if (turnNode) turnNode.innerHTML = '';
		if (turnInfoNode) turnInfoNode.innerHTML = '';

		while (parentNode.hasChildNodes()) parentNode.removeChild(parentNode.firstChild);

		socket.emit('game:auth', uniqueId);
	});

	socket.on('game:token', (newToken) => {
		window.localStorage.setItem('game_token', newToken);
	});

	if (startButtonNode) {
		startButtonNode.addEventListener('click', (ev) => {
			if (Game.search || Game.founded) {
				socket.emit('game:exit');
				startButtonNode.dispatchEvent(new Event('update-info'));

				if (turnNode) turnNode.innerHTML = '';
				if (turnInfoNode) turnInfoNode.innerHTML = '';
			} else if (!Game.founded) {
				socket.emit('game:find');
			}
		});

		startButtonNode.addEventListener('update-info', (ev) => {
			if (Game.search) ev.target.innerHTML = 'Stop finding a game';
			else ev.target.innerHTML = Game.founded ? 'Leave the game' : 'Find a game';
		});

		startButtonNode.dispatchEvent(new Event('update-info'));
	}

	socket.on('game:start', function (settings, info) {
		Game.sizeOfBoard = settings.sizeOfBoard;
		Game.turn = settings.turn;
		Game.hasWinner = settings.hasWinner;
		Game.moveTimer = 0;
		Game.founded = true;
		Game.search = false;
		Game.myTurn = info[uniqueId] || 'X';

		if (startButtonNode) startButtonNode.dispatchEvent(new Event('update-info'));

		if (turnNode && turnNode !== undefined) turnNode.innerHTML = 'You play: ' + Game.myTurn;

		if (turnInfoNode && turnInfoNode !== undefined)
			turnInfoNode.innerHTML = Game.myTurn === Game.turn ? 'Your turn' : '';

		resetGame();
	});

	socket.on('game:win', function (turn, winId, id) {
		const itemNode = document.getElementById('item-id-' + id);

		if (itemNode && itemNode !== undefined && itemNode.innerHTML.length === 0)
			itemNode.innerHTML = turn;

		drawWinner(winId, id);

		if (winId !== -1) console.log('Win', turn);
		else console.log('Draw');
	});

	socket.on('game:turn', function (oldTurn, curTurn, id) {
		Game.turn = curTurn;
		Game.slots[id] = 1;
		Game.moveTimer = 0;

		if (turnInfoNode && turnInfoNode !== undefined)
			turnInfoNode.innerHTML = Game.myTurn === curTurn ? 'Your turn' : '';

		const itemNode = document.getElementById('item-id-' + id);
		if (itemNode && itemNode !== undefined) itemNode.innerHTML = oldTurn;
	});

	socket.on('game:disconnect', function (token) {
		if (uniqueId !== token) console.log('Opponent left the game');

		Game.founded = false;
		Game.search = false;

		if (startButtonNode) startButtonNode.dispatchEvent(new Event('update-info'));
		if (turnNode) turnNode.innerHTML = '';
		if (turnInfoNode) turnInfoNode.innerHTML = '';

		while (parentNode.hasChildNodes()) parentNode.removeChild(parentNode.firstChild);
		parentNode.style = 'display: none;';
	});

	socket.on('game:reconnect', function (settings, myTurn) {
		Game.sizeOfBoard = settings.sizeOfBoard;
		Game.turn = settings.turn;
		Game.hasWinner = settings.hasWinner;
		Game.moveTimer = 0;
		Game.founded = true;
		Game.myTurn = myTurn;
		Game.search = false;

		if (startButtonNode) startButtonNode.dispatchEvent(new Event('update-info'));

		const turnNode = document.getElementById('game-you');
		if (turnNode && turnNode !== undefined) turnNode.innerHTML = 'You play: ' + Game.myTurn;

		if (turnInfoNode && turnInfoNode !== undefined)
			turnInfoNode.innerHTML = Game.myTurn === Game.turn ? 'Your turn' : '';

		resetGame();

		Game.slots = settings.slots;
		Game.hasWinner = settings.hasWinner;

		const itemList = [...document.querySelectorAll('.item-box')];

		for (const key in itemList) {
			const element = itemList[key];
			const slotId = Game.slots[element.dataset.id];

			if (slotId !== 0) element.innerHTML = slotId;
		}
	});

	socket.on('game:find', function () {
		Game.search = true;

		if (startButtonNode) startButtonNode.dispatchEvent(new Event('update-info'));
	});
});
