const express = require('express');
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const http = require('http');
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server);

const PORT = process.env.PORT || 8080;
const PUBLIC_FOLDER = "public";
let GLOBAL_NUMBER = 0;

class Player {
    constructor(name, bg_color) {
        this.bg_color = bg_color;
        this.socket_id = "/" + name.toLowerCase();
        this.amount = 10_000;
        this.available = true;
    }

    add(adding_amount) {
        this.amount += Math.max(0, adding_amount)
    }

    remove(removing_amount) {
        const amount = Math.max(0, removing_amount)
        if (amount > this.amount) {
            throw Error("Player " + this.name + " does not have enough money")
        }
        this.amount -= amount;
    }
}
class Bank {
    constructor() {
        this.players = {
            "blue": new Player("blue", "#4187b0"),
            "red": new Player("red", "#c22b13"),
            "orange": new Player("orange", "#d16711"),
            "purple": new Player("purple", "#6e11d1"),
            "green": new Player("green", "#149c1b"),
            "pink": new Player("pink", "#e01dc0")
        };
    }

    get_available() {
        const player_array = Object.entries(this.players)
        const AVAILABLE_PLAYERS = player_array.filter(([_, player]) => player.available).map(([player_name, _]) => player_name)

        if (AVAILABLE_PLAYERS.length == 0) {
            return null;
        } else {
            const player_name = AVAILABLE_PLAYERS[0];
            const player = this.players[player_name];
            player.available = false;
            return {
                name: player_name,
                bg_color: player.bg_color,
                socket_id: player.socket_id
            };
        }
    }

    get_playing() {
        return Object.entries(this.players).filter(([_, player]) => !player.available).map(([player_name, player]) => {
            return {
                name: player_name,
                bg_color: player.bg_color,
                socket_id: player.socket_id
            };
        });
    }

    free(player_id) {
        let change = false
        const freeing_players = Object.entries(this.players).filter(([_, player]) => player.socket_id == player_id).map(([player_name, _]) => player_name);
        freeing_players.forEach(player_name => {
            this.players[player_name].available = true
            change = true;
        });
        return change
    }

    pay(payer_name, receiver_name, amount) {
        const payer = this.players[payer_name.toLowerCase()];
        const receiver = this.players[receiver_name.toLowerCase()]

        if (payer == null || payer.available) {
            throw Error(payer_name + " is not playing");
        }
        if (receiver == null || receiver.available) {
            throw Error(receiver_name + " is not playing");
        }
        const payer_amount = payer.amount;
        const receiver_amount = receiver.amount;
        try {
            payer.remove(amount);
            receiver.add(amount);
        } catch (err) {
            payer.amount = payer_amount;
            receiver.amount = receiver_amount
            throw Error(err.message);
        }

        io.sockets.in(payer.socket_id).emit("new_number", payer.amount);
        io.sockets.in(receiver.socket_id).emit("new_number", receiver.amount);
    }
    pay_bank(payer_name, amount) {
        const payer = this.players[payer_name.toLowerCase()];

        if (payer == null || payer.available) {
            throw Error(payer_name + " is not playing");
        }
        const payer_amount = payer.amount;
        try {
            payer.remove(amount);
        } catch (err) {
            payer.amount = payer_amount;
            throw Error(err.message);
        }

        io.sockets.in(payer.socket_id).emit("new_number", payer.amount);
    }

    receive(receiver_name, amount) {
        const receiver = this.players[receiver_name.toLowerCase()]

        if (receiver == null || receiver.available) {
            throw Error(receiver_name + " is not playing");
        }
        const receiver_amount = receiver.amount;
        try {
            receiver.add(amount);
        } catch (err) {
            receiver.amount = receiver_amount
            throw Error(err.message);
        }
        io.sockets.in(receiver.socket_id).emit("new_number", receiver.amount);
    }
}

app.use(express.static(PUBLIC_FOLDER));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const bank = new Bank();

io.on('connection', (socket) => {
    socket.on("team", (player_name) => {
        const player = bank.players[player_name];
        socket.join(player.socket_id);
        io.emit("players_change");
        io.sockets.in(player.socket_id).emit("new_number", player.amount);
    })

    socket.on('disconnecting', () => {
        socket.rooms.forEach(room => {
            if (bank.free(room)) {
                io.emit("players_change");
            };

        });
    });
});

app.get("/team", async (req, res) => {
    const player = bank.get_available();
    if (player == null) {
        res.status(500).json({ message: "No player available" });
    } else {
        res.status(200).json(player);
    }
});

app.post("/pay", async (req, res) => {
    try {
        const payer_name = req.body.payer
        const receiver_name = req.body.receiver
        const amount = req.body.amount

        if (receiver_name.toLowerCase() == "bank") {
            bank.pay_bank(payer_name, amount);
        } else {
            bank.pay(payer_name, receiver_name, amount);
        }
    } catch (err) {
        res.status(500).json({ message: "SERVER : Invalid input : " + err.message });
    }
});

app.post("/receive", async (req, res) => {
    try {
        const receiver_name = req.body.receiver
        const amount = req.body.amount

        bank.receive(receiver_name, amount);

    } catch (err) {
        res.status(500).json({ message: "SERVER : Invalid input : " + err.message });
    }
});
app.get("/players", async (req, res) => {
    const playing_players = bank.get_playing();
    res.status(200).json(playing_players);
});

server.listen(PORT, () => {
    console.log('listening on : ' + PORT);
});

