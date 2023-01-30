import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import TicTacToe from '../server/controller/game.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

global.socket_io = io;

app.use(express.static('client'));

const powValue = Math.pow(10, 12);

io.on('connection', (client) => {
	console.log(client.id, 'connection');

	client.on('game:auth', function (token) {
		if (!(token?.length > 9)) {
			token = Date.now().toString(36) + Math.floor(powValue + Math.random() * 9 * powValue).toString(36) + client.id;
			client.emit('game:token', token);
		}

		if (!client.token) {
			client.token = token;

			TicTacToe.reconnectToGame(client);
		}
	});

	client.on('game:find', function () {
		if (client.token) {
			if (!TicTacToe.playerHasGame(client.token)) TicTacToe.findGame(client);
		} else console.warn(client.id + ' token is invalid');
	});

	client.on('game:exit', function () {
		const token = client.token;
		TicTacToe.freeGame(TicTacToe.players[token], true, token);

		const index = TicTacToe.freePlayers.indexOf(client);
		if (index > -1) TicTacToe.freePlayers.splice(index, 1);

		client.emit('game:disconnect', token);
		TicTacToe.players[token] = null;
	});

	client.on('game:move', function (id) {
		TicTacToe.makeMove(client, id);
	});

	client.once('disconnect', function () {
		console.log(client.id, 'disconnect');

		TicTacToe.freeGameTimer(client.token);

		const index = TicTacToe.freePlayers.indexOf(client);
		if (index > -1) TicTacToe.freePlayers.splice(index, 1);
	});
});

server.listen(3000, () => {
	console.log('listening on localhost:3000');
});
