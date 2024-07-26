"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MyRoomState = void 0;
const schema_1 = require("@colyseus/schema");
const Player_1 = require("./Player");
const MainBall_1 = require("./MainBall");
// import { Arrow } from "./Arrow";
class MyRoomState extends schema_1.Schema {
    constructor() {
        super(...arguments);
        this.waitingForServer = false;
        this.players = new schema_1.MapSchema();
        this.timeCounter = 0;
        this.mainBalls = new schema_1.MapSchema();
        // createArrow(id: string, posX: number, posY: number, angle: number){
        //   const arrow = new Arrow();
        //   arrow.id = id;
        //   arrow.posX = posX;
        //   arrow.posY = posY;
        //   arrow.angle = angle;
        //   this.arrows.set(id,arrow);
        //   return arrow;
        // }
    }
    // @type({ map: Arrow }) arrows = new MapSchema<Arrow>();
    createPlayer(sessionId, props, number, userId, state, walletId, ticket, passCred, playerNumber) {
        console.log('createPlayer sessionId :', sessionId, '    playerNumber: ', playerNumber);
        //console.log('props :', props);
        const player = new Player_1.Player().assign(props?.data || props);
        player.posx = -9999;
        player.posy = -9999;
        player.life = 100;
        player.rank = "0";
        player.reserveSeat = false;
        player.userId = userId;
        player.state = state;
        player.walletId = walletId;
        player.ticket = ticket;
        player.passCred = passCred;
        player.sessionId = sessionId;
        player.playerNumber = playerNumber ? playerNumber : -1;
        this.players.set(sessionId, player);
        return player;
    }
    createBall() {
        const ball = new MainBall_1.MainBall();
        ball.angle = 0;
        ball.skin = 0;
        ball.side = 0;
        ball.countArrow = 0;
        this.mainBalls.set("ball", ball);
        return ball;
    }
}
exports.MyRoomState = MyRoomState;
__decorate([
    (0, schema_1.type)("boolean")
], MyRoomState.prototype, "waitingForServer", void 0);
__decorate([
    (0, schema_1.type)({ map: Player_1.Player })
], MyRoomState.prototype, "players", void 0);
__decorate([
    (0, schema_1.type)("number")
], MyRoomState.prototype, "timeCounter", void 0);
__decorate([
    (0, schema_1.type)({ map: MainBall_1.MainBall })
], MyRoomState.prototype, "mainBalls", void 0);
