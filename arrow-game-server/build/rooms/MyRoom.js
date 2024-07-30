"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyRoom = void 0;
const core_1 = require("@colyseus/core");
const MyRoomState_1 = require("./schema/MyRoomState");
class MyRoom extends core_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 4;
        // autoDispose = false;  
        this.privateMode = false;
        this.waitingPlayerTime = 15;
    }
    onCreate(options) {
        this.setState(new MyRoomState_1.MyRoomState());
        if (options.password) {
            console.log("queue room password: ", options.password);
            this.setPrivate();
        }
        console.log("onCreate queue room");
        this.onMessage("*", (client, type, message) => {
            switch (type) {
                case "game-start":
                    console.log("MyRoom game-start");
                    break;
            }
        });
    }
    CountingTime() {
        // Create an interval to update the time counter
        this.timeInterval = this.clock.setInterval(() => {
            const currentTime = Date.now();
            const elapsedTime = Math.floor((currentTime - this.roomStartTime) / 1000); // Convert to seconds
            this.state.timeCounter = elapsedTime;
            // console.log("My Room CountingTime: ",this.state.timeCounter);
            // Optionally, broadcast the time to all clients
            this.broadcast("waiting-time-update", { timeCounter: elapsedTime });
            // Check if 2 minutes have passed
            if (this.state.timeCounter >= this.waitingPlayerTime && !this.state.waitingForServer && this.state.players.size >= 2) {
                this.lock();
                this.startBattleRoomSearch(true);
                this.timeInterval.clear();
            }
        }, 1000); // Update every second
    }
    startBattleRoomSearch(canStartGame) {
        // When room is full
        if (canStartGame) {
            // this.lock();
            //For private mode, select the correct private room
            if (this.privateMode) {
            }
            else {
                this.delayedInterval = this.clock.setInterval(async () => {
                    const battleRoom = this.privateMode ? this.privateRoom : await core_1.matchMaker.findOneRoomAvailable("battleRoom", { mode: 'autogame' });
                    console.log("have battleRoom: ", battleRoom);
                    if (battleRoom) {
                        this.lock();
                        this.battleRoom = battleRoom;
                        let players = [];
                        // @ts-ignore
                        this.state.players.forEach(async (player) => {
                            players[players?.length] = { ...player, player: player };
                            const client = this.clients.getById(player.sessionId);
                            console.log("player.playerNumber: ", player.playerNumber);
                            const options = { accessToken: player?.accessToken, sessionId: player?.sessionId, walletid: player?.walletid, userId: player?.uid, name: player?.name, ticket: player?.ticket, passCred: player?.passCred, playerNumber: player.playerNumber };
                            if (client) {
                                // client.send("get-my-sessionId", { data: player?.sessionId });
                                const matchData = await core_1.matchMaker.reserveSeatFor(this.battleRoom, options);
                                client.send("reserveSeatFor", { data: matchData });
                                player.reserveSeat = true;
                            }
                        });
                        console.log("battle-room-id");
                        this.broadcast("battle-room-id", {});
                        const payload = await core_1.matchMaker.remoteRoomCall(battleRoom.roomId, "setPlayer", [{ roomId: this.roomId, player: players }]);
                        if (payload) {
                            console.log("send game-join");
                            this.broadcast("game-event", {
                                event: "game-join",
                                message: "Connecting to server"
                            });
                        }
                        this.timeInterval.clear();
                        console.log("My Room this.timeInterval.clear()");
                        this.delayedInterval.clear();
                    }
                }, 2000);
                this.state.waitingForServer = true;
            }
        }
    }
    onJoin(client, options) {
        console.log("queue room on join reconnect token:", this.roomId + ":" + client?._reconnectionToken);
        if (options.password && options.password == this.listing.password) {
            client.send("privateRoomId", { data: this.roomId });
            this.privateMode = true;
        }
        console.log("options: ", options);
        const player = this.state.createPlayer(client.sessionId, options?.player, this.state.players.size, "N/A", "queue", options?.walletId, "N/A", "N/A");
        player.playerNumber = this.state.players.size;
        console.log("this.state.players.size: ", this.state.players.size);
        let canStartGame = this.state.players.size == this.maxClients;
        let players = [];
        this.state.players.forEach(player => {
            let data = {
                id: player.sessionId,
                playerNumber: player.playerNumber,
                walletId: player.walletId
            };
            players.push(data);
        });
        this.broadcast("game-event", {
            event: `set-player`, data: {
                players: players,
                canStartGame: canStartGame
            }
        });
        this.startBattleRoomSearch(canStartGame);
        if (this.state.players.size > 1) {
            if (!this.isCountingTime)
                this.roomStartTime = Date.now();
            this.isCountingTime = true;
            this.CountingTime();
        }
    }
    onLeave(client, consented) {
        console.log(client.sessionId, "left!");
        this.state.players.delete(client.sessionId);
        let playes = [];
        this.state.players.forEach(player => {
            let data = {
                id: player.sessionId,
                playerNumber: player.playerNumber,
            };
            playes.push(data);
        });
        this.broadcast("game-event", {
            event: `leave-player`, data: {
                players: playes
            }
        });
        // if(this.state.players.size == 1)
        //   this.isCountingTime = false;
    }
    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }
    closeRoom() {
        this.broadcast("game-event", {
            state: "game-joined",
            message: "Connecting to server"
        });
        setTimeout(() => {
            this.disconnect();
        }, 5000);
    }
}
exports.MyRoom = MyRoom;
