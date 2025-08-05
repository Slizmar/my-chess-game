const game = new Chess();
let myColor = null;
let myGameId = null;
let opponentJoined = false;
let isMultiplayer = false;
let isHardcore = false;
let socket = null;

// === UI Elements ===
const gameModeMenu = document.getElementById('game-mode-menu');
const singleplayerBtn = document.getElementById('singleplayerBtn');
const multiplayerBtn = document.getElementById('multiplayerBtn');
const hardcoreBtn = document.getElementById('hardcoreBtn');
const hardcoreMenu = document.getElementById('hardcore-menu');
const hardcoreSingleplayerBtn = document.getElementById('hardcoreSingleplayerBtn');
const hardcoreMultiplayerBtn = document.getElementById('hardcoreMultiplayerBtn');
const multiplayerUi = document.getElementById('multiplayer-ui');
const boardContainer = document.getElementById('board-container');
const winMessageOverlay = document.getElementById('win-message-overlay');
const winMessageText = document.getElementById('win-message-text');
const hardcoreOverlay = document.getElementById('hardcore-overlay');
const hardcoreStatus = document.getElementById('hardcore-status');

const config = {
    draggable: true,
    position: 'start',
    onDrop: onDrop,
    pieceTheme: 'img/chesspieces/wikipedia/{piece}.png'
};

const board = Chessboard('board', config);

const lobbyUi = document.getElementById('lobby-ui');
const gameInfo = document.getElementById('game-info');
const createGameBtn = document.getElementById('createGameBtn');
const joinGameBtn = document.getElementById('joinGameBtn');
const gameIdInput = document.getElementById('gameIdInput');
const displayGameId = document.getElementById('displayGameId');
const displayPlayerColor = document.getElementById('displayPlayerColor');
const gameStatus = document.getElementById('gameStatus');
const statusElement = document.getElementById('status');

createGameBtn.disabled = true;
joinGameBtn.disabled = true;

const HARDCORE_FEN = 'rnbrkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBRKBNR w KQkq - 0 1';

function setHardcoreUi(isHardcoreMode) {
    if (isHardcoreMode) {
        hardcoreStatus.textContent = "Hardcore";
        hardcoreStatus.style.display = 'inline';
        hardcoreOverlay.style.display = 'block';
    } else {
        hardcoreStatus.textContent = "";
        hardcoreStatus.style.display = 'none';
        hardcoreOverlay.style.display = 'none';
    }
}

// === Game Mode Handlers ===
singleplayerBtn.addEventListener('click', () => {
    isMultiplayer = false;
    isHardcore = false;
    gameModeMenu.style.display = 'none';
    multiplayerUi.style.display = 'none';
    boardContainer.style.display = 'block';
    winMessageOverlay.classList.add('hidden');
    game.reset();
    board.position('start');
    board.orientation('white');
    setHardcoreUi(false);
    updateStatus();
});

multiplayerBtn.addEventListener('click', () => {
    console.log("Multiplayer button clicked. Initializing multiplayer...");
    isMultiplayer = true;
    isHardcore = false;
    gameModeMenu.style.display = 'none';
    multiplayerUi.style.display = 'block';
    boardContainer.style.display = 'block';
    winMessageOverlay.classList.add('hidden');
    game.reset();
    board.position('start');
    updateStatus();
    setHardcoreUi(false);
    initMultiplayer();
});

hardcoreBtn.addEventListener('click', () => {
    gameModeMenu.style.display = 'none';
    hardcoreMenu.style.display = 'block';
});

hardcoreSingleplayerBtn.addEventListener('click', () => {
    isMultiplayer = false;
    isHardcore = true;
    hardcoreMenu.style.display = 'none';
    boardContainer.style.display = 'block';
    winMessageOverlay.classList.add('hidden');
    game.load(HARDCORE_FEN);
    board.position(HARDCORE_FEN);
    board.orientation('white');
    setHardcoreUi(true);
    updateStatus();
});

hardcoreMultiplayerBtn.addEventListener('click', () => {
    console.log("Hardcore Multiplayer button clicked. Initializing multiplayer...");
    isMultiplayer = true;
    isHardcore = true;
    hardcoreMenu.style.display = 'none';
    multiplayerUi.style.display = 'block';
    boardContainer.style.display = 'block';
    winMessageOverlay.classList.add('hidden');
    game.reset();
    board.position('start');
    updateStatus();
    setHardcoreUi(true);
    createGameBtn.disabled = false;
    joinGameBtn.disabled = true;
    initMultiplayer();
});

function initMultiplayer() {
    if (socket) {
        console.log("WebSocket object already exists. Closing old connection...");
        socket.close();
    }
    console.log("Attempting to connect to WebSocket...");
    socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
        console.log('Connected to WebSocket server!');
        createGameBtn.disabled = false;
        if (!isHardcore) {
            joinGameBtn.disabled = false;
        }
        console.log("Multiplayer buttons enabled.");
    };

    socket.onmessage = event => {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        console.log('Received message from server:', data);

        if (type === 'gameCreated') {
            myGameId = payload.gameId;
            myColor = payload.playerColor;
            game.load(payload.fen);
            board.position(game.fen());
            
            board.orientation('white');

            lobbyUi.style.display = 'none';
            gameInfo.style.display = 'block';
            displayGameId.textContent = myGameId;
            displayPlayerColor.textContent = myColor === 'w' ? 'White' : 'Black';
            gameStatus.textContent = 'Waiting for opponent...';
            
        } else if (type === 'gameJoined') {
            myGameId = payload.gameId;
            myColor = payload.playerColor;
            game.load(payload.fen);
            board.position(game.fen());
            
            board.orientation('black');

            lobbyUi.style.display = 'none';
            gameInfo.style.display = 'block';
            displayGameId.textContent = myGameId;
            displayPlayerColor.textContent = myColor === 'w' ? 'White' : 'Black';
            gameStatus.textContent = 'Game started!';
            opponentJoined = true;
            updateStatus();

            if (game.fen() === HARDCORE_FEN) {
                isHardcore = true;
                setHardcoreUi(true);
            } else {
                isHardcore = false;
                setHardcoreUi(false);
            }
            
        } else if (type === 'gameMove') {
            game.load(payload.fen);
            board.position(game.fen());
            updateStatus();

        } else if (type === 'opponentJoined') {
            gameStatus.textContent = 'Opponent joined! Game started.';
            opponentJoined = true;
            updateStatus();
            
        } else if (type === 'opponentLeft') {
            gameStatus.textContent = 'Opponent has left the game.';
            
        } else if (type === 'error') {
            alert(`Error: ${payload}`);
        }
    };

    socket.onerror = error => {
        console.error('WebSocket error:', error);
        alert('Connection to multiplayer server failed. Make sure the server is running.');
    };

    socket.onclose = () => {
        console.log('Disconnected from WebSocket server.');
        createGameBtn.disabled = true;
        joinGameBtn.disabled = true;
    };
}

// === Multiplayer Button Handlers ===
createGameBtn.addEventListener('click', () => {
    console.log("Create New Game button clicked.");
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log("Sending 'createGame' message to server.");
        socket.send(JSON.stringify({ type: 'createGame', payload: { hardcore: isHardcore } }));
    } else {
        console.error("Socket not open. Current state:", socket.readyState);
    }
});

joinGameBtn.addEventListener('click', () => {
    console.log("Join Game button clicked.");
    if (socket && socket.readyState === WebSocket.OPEN) {
        const gameId = gameIdInput.value;
        if (gameId) {
            console.log(`Sending 'joinGame' for ID: ${gameId}`);
            socket.send(JSON.stringify({ type: 'joinGame', payload: { gameId: parseInt(gameId) } }));
        } else {
            alert('Please enter a Game ID.');
        }
    } else {
        console.error("Socket not open. Current state:", socket.readyState);
    }
});

// === onDrop Function (now handles both modes) ===
function onDrop(source, target) {
    if (isMultiplayer) {
        if (!opponentJoined || myColor !== game.turn()) {
            return 'snapback';
        }

        const move = {
            from: source,
            to: target,
            promotion: 'q'
        };

        const tempMove = game.move(move);
        if (tempMove) {
            game.undo();
            socket.send(JSON.stringify({ type: 'move', payload: { move } }));
        } else {
            return 'snapback';
        }
    } else { // Singleplayer mode
        const move = game.move({
            from: source,
            to: target,
            promotion: 'q'
        });
        if (move === null) {
            return 'snapback';
        }
        board.position(game.fen());
        updateStatus();
    }
}

function updateStatus() {
    let message = '';
    if (game.in_checkmate()) {
        message = `Game over, ${game.turn() === 'w' ? 'Black' : 'White'} won!`;
    } else if (game.in_draw()) {
        message = 'Game over, a draw!';
    } else {
        statusElement.textContent = game.turn() === 'w' ? 'White to move' : 'Black to move';
        if (game.in_check()) {
            statusElement.textContent += ' - Check!';
        }
        return;
    }
    
    winMessageText.textContent = message;
    winMessageOverlay.classList.remove('hidden');

    statusElement.textContent = '';
}

// === Settings and Themes ===
const settingsBtn = document.getElementById('settingsBtn');
const settingsMenu = document.getElementById('settingsMenu');
const boardThemeBtn = document.getElementById('boardThemeBtn');
const colorOptions = document.getElementById('colorOptions');
const defaultThemeBtn = document.getElementById('defaultThemeBtn');
const woodenThemeBtn = document.getElementById('woodenThemeBtn');
const blueThemeBtn = document.getElementById('blueThemeBtn');
const greenThemeBtn = document.getElementById('greenThemeBtn');
const glacialThemeBtn = document.getElementById('glacialThemeBtn');
const redThemeBtn = document.getElementById('redThemeBtn');
const magentaThemeBtn = document.getElementById('magentaThemeBtn');
const grapeThemeBtn = document.getElementById('grapeThemeBtn');

settingsBtn.addEventListener('click', () => {
    settingsMenu.classList.toggle('show');
});

boardThemeBtn.addEventListener('click', () => {
    colorOptions.classList.toggle('show');
});

const themeColors = {
    'default': { light: '#f0d9b5', dark: '#b58863' },
    'wooden': { light: '#c08d64', dark: '#6d4321' },
    'blue': { light: '#0065d8', dark: '#002e6b' },
    'green': { light: '#3ABF00', dark: '#30810a' },
    'glacial': { light: '#00a3b8', dark: '#0a5f81' },
    'red': { light: '#a50d0dff', dark: '#690a0aff' },
    'magenta': { light: '#b422a8ff', dark: '#7a1475ff' },
    'grape': { light: '#9867C5', dark: '#522A7F' },
};

let currentTheme = 'default';

function getSquareColor(file, rank) {
    return (file.charCodeAt(0) - 'a'.charCodeAt(0) + rank) % 2 === 0 ? 'dark' : 'light';
}

function applyTheme(themeName) {
    currentTheme = themeName;
    const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const ranks = [1, 2, 3, 4, 5, 6, 7, 8];

    files.forEach(file => {
        ranks.forEach(rank => {
            const squareId = `#board .square-${file}${rank}`;
            const squareElement = document.querySelector(squareId);
            const colorType = getSquareColor(file, rank);
            if (squareElement) {
                if (colorType === 'light') {
                    squareElement.style.backgroundColor = themeColors[currentTheme].light;
                } else {
                    squareElement.style.backgroundColor = themeColors[currentTheme].dark;
                }
            }
        });
    });
}

function updateSelectedButton(selectedButton) {
    const themeButtons = document.querySelectorAll('#colorOptions button');
    themeButtons.forEach(button => button.classList.remove('selected-theme-btn'));
    selectedButton.classList.add('selected-theme-btn');
}

defaultThemeBtn.addEventListener('click', () => {
    applyTheme('default');
    updateSelectedButton(defaultThemeBtn);
    colorOptions.classList.remove('show');
});

woodenThemeBtn.addEventListener('click', () => {
    applyTheme('wooden');
    updateSelectedButton(woodenThemeBtn);
    colorOptions.classList.remove('show');
});

blueThemeBtn.addEventListener('click', () => {
    applyTheme('blue');
    updateSelectedButton(blueThemeBtn);
    colorOptions.classList.remove('show');
});

greenThemeBtn.addEventListener('click', () => {
    applyTheme('green');
    updateSelectedButton(greenThemeBtn);
    colorOptions.classList.remove('show');
});

glacialThemeBtn.addEventListener('click', () => {
    applyTheme('glacial');
    updateSelectedButton(glacialThemeBtn);
    colorOptions.classList.remove('show');
});

redThemeBtn.addEventListener('click', () => {
    applyTheme('red');
    updateSelectedButton(redThemeBtn);
    colorOptions.classList.remove('show');
});
magentaThemeBtn.addEventListener('click', () => {
    applyTheme('magenta');
    updateSelectedButton(magentaThemeBtn);
    colorOptions.classList.remove('show');
});
grapeThemeBtn.addEventListener('click', () => {
    applyTheme('grape');
    updateSelectedButton(grapeThemeBtn);
    colorOptions.classList.remove('show');
});
updateSelectedButton(defaultThemeBtn);
applyTheme('default');