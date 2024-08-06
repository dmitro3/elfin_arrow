"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BattleRoom = void 0;
const core_1 = require("@colyseus/core");
const MyRoomState_1 = require("./schema/MyRoomState");
const DynamodbAPI_1 = require("../thirdparties/DynamodbAPI");
class BattleRoom extends core_1.Room {
    constructor() {
        super(...arguments);
        this.maxClients = 5;
        this.remoteRoomId = "";
        this.readyPlayer = 0;
        // maxMatchTime = 45;
        // private roomStartTime: number;
        // private timeInterval: Delayed;
        // private isCountingTime: boolean;
        this.isGameover = false;
        this.startedAt = 0;
    }
    onCreate(options) {
        this.lock();
        this.setPatchRate(25);
        this.setState(new MyRoomState_1.MyRoomState());
        console.log("onCreate BattleRoom id: ", this.roomId);
        if (options.password) {
            console.log("password:", options.password);
            this.setPrivate();
        }
        this.onMessage("*", async (client, type, message) => {
            switch (type) {
                case "game-input":
                    this.broadcast("game-input-response", { data: message });
                    break;
                case "get-players":
                    let players = [];
                    this.state.players.forEach((player, sessionId) => {
                        let data = {
                            id: player.sessionId,
                            playerNumber: player.playerNumber,
                        };
                        players.push(data);
                    });
                    // console.log("get-players: ",players);
                    this.broadcast('get-players', { data: players });
                    break;
                // case "game-start":
                //   this.readyPlayer++;
                //   console.log("game-start readyPlayer: ", this.readyPlayer, "   remoteRoomId: ", this.remoteRoomId);
                //   if (this.readyPlayer == this.state.players.size) {
                //     this.startedAt = Date.now();
                //     let players: any = [];
                //     this.state.players.forEach((player) => {
                //       let data = {
                //         walletId: player.walletId.substring(0, 10)
                //       }
                //       players.push(data);
                //     })
                //     this.broadcast('game-start', { data: { players: players, playerCount: this.state.players.size } });
                //     // if(!this.isCountingTime){
                //     //   this.isCountingTime = true;
                //     //   this.roomStartTime = Date.now();
                //     //   this.CountingTime();
                //     // }
                //     try {
                //       await matchMaker.remoteRoomCall(this.remoteRoomId, "closeRoom", [{ roomId: this.roomId }]);
                //     } catch (error) {
                //       console.error("Error calling remote room:", error);
                //     }
                //   }
                //   break;
                case "game-started":
                    this.startedAt = Date.now();
                    this.broadcast('gameScene', { result: 1, data: message });
                    try {
                        await core_1.matchMaker.remoteRoomCall(this.remoteRoomId, "closeRoom", [{ roomId: this.roomId }]);
                    }
                    catch (error) {
                        console.error("Error calling remote room:", error);
                    }
                    break;
                case "game-over":
                    console.log("gameover:", message);
                    // this.broadcast('game-over', { data: message });
                    this.gameOver(options, message?.userId);
                    break;
                case "update-score":
                    this.broadcast('game-event', { event: 'update-score', data: message.data });
                    break;
                case "battle-time-update":
                    this.broadcast('game-event', { event: 'battle-time-update', data: message.data });
                    break;
                case "update-mainball":
                    // console.log("update-mainball message: ",message);
                    let angle = message.angle;
                    let skin = message.skin;
                    this.state.mainBalls.forEach((ball) => {
                        ball.angle = message.angle;
                        ball.skin = message.skin;
                        ball.side = message.side;
                        ball.countArrow = message.countArrow;
                        // console.log("this.state.mainBall.angle: ",ball.angle);
                    });
                    break;
                case "spawn-arrow":
                    // this.state.createArrow(message.data.id, message.data.posX, message.data.posY, message.data.angle);
                    this.broadcast('game-event', { event: 'spawn-arrow', data: message.data });
                    break;
                // case "updated-arrow":
                //   this.state.arrows.forEach((arrow)=>{
                //     if(arrow.id == message.id){
                //       arrow.posX = message.posX;
                //       arrow.posY = message.posY;
                //       arrow.angle = message.angle;
                //     }
                //   })
                // break;
                case "remove-arrow":
                    // if(this.state.arrows.has(message.data.id))
                    //   this.state.arrows.delete(message.data.id);
                    this.broadcast('game-event', { event: 'remove-arrow', data: message.data });
                    break;
                case "hit-main-ball":
                    this.broadcast('game-event', { event: 'hit-main-ball', data: message.data });
                    break;
                case "hit-another-arrow":
                    this.broadcast('game-event', { event: 'hit-another-arrow', data: message.data });
                    break;
            }
        });
    }
    async gameOver(options, winnerId) {
        if (this.isGameover)
            return;
        this.isGameover = true;
        const gameOverRoom = await core_1.matchMaker.createRoom("gameOver", {});
        console.log("Battle room:", this.roomId + " , GameOver Room:" + gameOverRoom?.roomId);
        const endedAt = Date.now();
        let _ret = { gameid: this.roomId, players: [] };
        let gameMessage = [];
        let tokens = [];
        console.log("winnerId: ", winnerId);
        this.state.players.forEach(async (player, sessionId) => {
            _ret.players[_ret.players.length] = {
                "userId": player?.player?.userId,
                "gameSessionId": player?.player?.ticket,
                "passCred": player?.player?.passCred,
                "startedAt": this.startedAt,
                "endedAt": endedAt,
                "result": player?.playerNumber == winnerId ? "win" : "lose",
                "score": player?.playerNumber == winnerId ? 100 : 1,
                "serviceFee": 0.1,
                "extra": options.password ? { message: "this is private room. It is event data." } : {},
                // "rewardTokenAmount": player?.playerNumber == winnerId ? 0.1 * this.state.players.size : 0,
            };
            console.log("player?.playerNumber: ", player?.playerNumber);
            gameMessage[_ret.players.length] = {
                "userId": player?.player?.userId,
                "walletid": player?.player?.walletId,
                "playerId": player?.player?.playerNumber,
                "result": player?.playerNumber == winnerId ? "win" : "lose"
            };
            tokens[tokens.length] = player?.accessToken;
        });
        this.broadcast('game-over', { data: gameMessage });
        const payload = await core_1.matchMaker.remoteRoomCall(gameOverRoom.roomId, "StartUploadGameReport", [{ data: _ret, tokens: tokens, roomId: this.roomId }]);
        if (!payload) {
            console.log(`Battle ${this.roomId} => Gameover room ${gameOverRoom.roomId} upload report error`);
        }
        setTimeout(() => {
            this.disconnect();
        }, 5000);
        return true;
    }
    // private CountingTime(){// Set the room start time
    //   // Create an interval to update the time counter
    //   this.timeInterval = this.clock.setInterval(() => {
    //     const currentTime = Date.now();
    //     const elapsedTime = Math.floor((currentTime - this.roomStartTime) / 1000); // Convert to seconds
    //     let matchTimer = this.maxMatchTime - elapsedTime;
    //     // console.log("matchTimer: ",matchTimer);
    //     // Optionally, broadcast the time to all clients
    //     if (matchTimer <= 0)
    //       matchTimer = 0;
    //     this.broadcast("battle-time-update", { timeCounter: matchTimer });
    //     if (matchTimer <= 0) {
    //       this.timeInterval.clear();
    //     }
    //   }, 1000); // Update every second
    // }
    async onJoin(client, options) {
        // this.unlock();
        // if (this.state.players.size === this.maxClients - 1) {
        //   this.lock();
        // }
        if (!options?.passCred) {
            this.unlock();
            console.log(`${this.roomId} battle room unlocked`);
            //console.log(`Battle ${this.roomId} connected.`);
        }
        else {
            console.log("Battle room reconnect token:", this.roomId + ":" + client?._reconnectionToken);
        }
        client.options = options;
        if (options?.ticket) {
            let _player = this.state.players.get(options?.sessionId);
            //_player.accessToken = options?.accessToken;
            //sync-ticket state
            const syncTicketData = {
                "userId": options?.userId,
                "ticket_id": options?.ticket,
                "state": "battle",
                "game_id": "ElfinGolf",
                "reconnectToken": this.roomId + ":" + client?._reconnectionToken
            };
            //console.log(syncTicketData);
            const syncTicketPayload = await (0, DynamodbAPI_1.syncTicket)(options.accessToken, JSON.stringify(syncTicketData));
            console.log("battle syncTicketPayload:", syncTicketPayload?.data);
            client.send("updateMessage", { message: "Player Ready" });
            let _this = this;
            setTimeout(function () {
                _this.broadcast("setPlayerReady", { data: { playerNumber: _player?.playerNumber, playerWalletId: _player?.walletId.substring(0, 10), allPlayerCount: _this.state.players.size } });
            }, 1000);
            //console.log('battle room payload :',syncTicketPayload.data , options.accessToken , syncTicketData);
            //if(syncTicketPayload.data.result !== 1)
            //throw new Error("Sync Ticket Error.");
        }
    }
    async onLeave(client, consented) {
        console.log("onLeave client.id: ", client.id, "   consented: ", consented);
        //this.disconnect();    
        this.state.players.get(client.options?.userId).connected = false;
        try {
            if (consented) {
                throw new Error("consented leave");
            }
            const reconnection = this.allowReconnection(client, "manual");
            // now it's time to `await` for the reconnection
            await reconnection;
            // client returned! let's re-activate it.
            this.state.players.get(client.options.userId).connected = true;
            const promise = await reconnection.promise;
            console.log("battle room reconnection token:", promise._reconnectionToken);
        }
        catch (e) {
            console.log("onLeave catch error: ", e);
            // reconnection has been rejected. let's remove the client.
            //this.state.players.delete((client as any).options.userId);
        }
    }
    async setPlayer(playerstate) {
        // @ts-ignore
        console.log(`Battle ${this.roomId} Set Player- received ${playerstate?.roomId} : true`);
        // @ts-ignore
        this.remoteRoomId = playerstate?.roomId;
        // @ts-ignore
        Object.entries(playerstate?.player).forEach(([sessionId, options], index) => {
            const _player = this.state.createPlayer(options?.sessionId, options, index, options?.uid, "battle", options?.walletId, options?.ticket, options?.passCred, options?.playerNumber);
        });
        this.state.createBall();
        // this.broadcast('game-start', { data: {isStart:true} });
        // await matchMaker.remoteRoomCall(this.remoteRoomId, "closeRoom", [{ roomId: this.roomId }]);
        return true;
    }
    async lockTheRoom() {
        if (!this.locked) {
            this.lock();
            return true;
        }
        return false;
    }
    gameStart() {
        this.broadcast("game-event", { event: "game-start" });
        //this.broadcast("server-game-start");
        console.log('game-start sent!');
        return true;
    }
    gameReset() {
        this.broadcast("game-event", {
            state: "game-closed-with-reason",
            message: "Game closed, pay back all fee"
        });
        this.disconnect();
        return true;
    }
    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }
}
exports.BattleRoom = BattleRoom;
