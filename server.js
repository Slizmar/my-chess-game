const WebSocket = require('ws');
const { Chess } = require('chess.js');

const wss = new WebSocket.Server({ port: 8080 });
const games = {};
let nextGameId = 1;

console.log('WebSocket server is running on port 8080');

const HARDCORE_FEN = 'rnbrkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBRKBNR w KQkq - 0 1';

wss.on('connection', ws => {
    console.log('A new client has connected.');
    ws.on('message', message => {
        const data = JSON.parse(message);
        const { type, payload } = data;

        console.log(`Received message of type: ${type}`);

        if (type === 'createGame') {
            const gameId = nextGameId++;
            const isHardcore = payload && payload.hardcore;
            let newGame;
            
            if (isHardcore) {
                newGame = new Chess(HARDCORE_FEN);
                console.log(`Hardcore game ${gameId} created.`);
            } else {
                newGame = new Chess();
                console.log(`Standard game ${gameId} created.`);
            }

            games[gameId] = {
                board: newGame,
                players: [ws],
                isHardcore: isHardcore, // Still store this for game state
            };
            ws.gameId = gameId;
            ws.color = 'w';
            ws.send(JSON.stringify({ type: 'gameCreated', payload: { gameId, playerColor: 'w', fen: newGame.fen(), isHardcore } }));
            
        } else if (type === 'joinGame' && payload.gameId) {
            const gameId = payload.gameId;
            const game = games[gameId];
            // REMOVED: && game.isHardcore === isHardcore
            if (game && game.players.length === 1) { 
                game.players.push(ws);
                ws.gameId = gameId;
                ws.color = 'b';
                ws.send(JSON.stringify({ type: 'gameJoined', payload: { gameId, playerColor: 'b', fen: game.board.fen(), isHardcore: game.isHardcore } }));

                game.players[0].send(JSON.stringify({ type: 'opponentJoined' }));
                console.log(`Player 2 (Black) joined game ${gameId}.`);
            } else {
                ws.send(JSON.stringify({ type: 'error', payload: 'Game not found or is full.' }));
            }
        } else if (type === 'move' && ws.gameId) {
            const game = games[ws.gameId];
            if (game) {
                if (ws.color === game.board.turn()) {
                    const move = game.board.move(payload.move);
                    if (move) {
                        const moveMessage = JSON.stringify({ type: 'gameMove', payload: { move, fen: game.board.fen() } });
                        game.players.forEach(player => player.send(moveMessage));
                    } else {
                        ws.send(JSON.stringify({ type: 'error', payload: 'Invalid move.' }));
                    }
                } else {
                    ws.send(JSON.stringify({ type: 'error', payload: 'It is not your turn.' }));
                }
            }
        }
    });

    ws.on('close', () => {
        if (ws.gameId && games[ws.gameId]) {
            console.log(`Player from game ${ws.gameId} disconnected.`);
            const otherPlayer = games[ws.gameId].players.find(player => player !== ws);
            if (otherPlayer) {
                otherPlayer.send(JSON.stringify({ type: 'opponentLeft' }));
            }
            delete games[ws.gameId];
        }
        console.log('A client has disconnected.');
    });
});