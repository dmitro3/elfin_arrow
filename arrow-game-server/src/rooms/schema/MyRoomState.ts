import { Schema, type, MapSchema } from "@colyseus/schema";

import { Player } from "./Player";
import { MainBall } from "./MainBall";
// import { Arrow } from "./Arrow";

export class MyRoomState extends Schema {

  @type("boolean") waitingForServer = false;
  @type({ map: Player }) players = new MapSchema<Player>();
  @type("number") timeCounter = 0;
  @type({ map: MainBall }) mainBalls = new MapSchema<MainBall>();
  // @type({ map: Arrow }) arrows = new MapSchema<Arrow>();
  

  createPlayer(sessionId: string, props: any, number:any, userId:string, state: string, walletId: string, ticket:string, passCred:string, playerNumber?: number) {
    console.log('createPlayer sessionId :', sessionId, '    playerNumber: ',playerNumber);
    //console.log('props :', props);
    const player = new Player().assign(props?.data || props);
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
    player.playerNumber = playerNumber?playerNumber:-1;
    this.players.set(sessionId, player);
    return player;
  }

  createBall(){
    const ball = new MainBall();

    ball.angle = 0;
    ball.skin = 0;
    ball.side = 0;
    ball.countArrow = 0;

    this.mainBalls.set("ball",ball);

    return ball;
  }

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
