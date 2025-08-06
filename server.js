const WebSocket = require('ws');
const { Chess } = require('chess.js');

const wss = new WebSocket.Server({ port: 8080 });
const games = {};
let nextGameId = 1;

console.log('WebSocket server is running on port 8080');

const HARDCORE_FEN = 'rnbrkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBRKBNR w KQkq - 0 1';
const CHAOS_BOUNDARY_SQUARES = ['a1', 'a8', 'h1', 'h8', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7'];

wss.on('connection', ws => {
    console.log('A new client has connected.');
    ws.on('message', message => {
        const data = JSON.parse(message);
        const { type, payload } = data;

        console.log(`Received message of type: ${type}`);

        if (type === 'createGame') {
            const gameId = nextGameId++;
            const isHardcore = payload && payload.hardcore;
            const isChaos = payload && payload.chaos;
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
                isHardcore: isHardcore,
                isChaos: isChaos,
            };
            ws.gameId = gameId;
            ws.color = 'w';
            ws.send(JSON.stringify({ type: 'gameCreated', payload: { gameId, playerColor: 'w', fen: newGame.fen(), isHardcore, isChaos } }));
            
        } else if (type === 'joinGame' && payload.gameId) {
            const gameId = payload.gameId;
            const game = games[gameId];
            if (game && game.players.length === 1) { 
                game.players.push(ws);
                ws.gameId = gameId;
                ws.color = 'b';
                ws.send(JSON.stringify({ type: 'gameJoined', payload: { gameId, playerColor: 'b', fen: game.board.fen(), isHardcore: game.isHardcore, isChaos: game.isChaos } }));

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
                        if (game.isChaos) {
                            if (CHAOS_BOUNDARY_SQUARES.includes(move.to)) {
                                const piece = move.piece;
                                if (piece === 'q' || piece === 'n') {
                                    const newPiece = {
                                        type: 'p',
                                        color: move.color
                                    };
                                    game.board.put(newPiece, move.to);
                                }
                            }
                        }
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