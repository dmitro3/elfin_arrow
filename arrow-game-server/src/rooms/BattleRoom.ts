import { Room, Client, Delayed, matchMaker } from "@colyseus/core";
import { MyRoomState } from "./schema/MyRoomState";

export class BattleRoom extends Room<MyRoomState> {
  maxClients = 5;
  remoteRoomId: string = "";
  readyPlayer = 0;

  maxMatchTime = 45;
  private roomStartTime: number;
  private timeInterval: Delayed;
  private isCountingTime: boolean;

  onCreate(options: any) {

    this.lock();
    this.setPatchRate(25);
    this.setState(new MyRoomState());
    console.log("onCreate BattleRoom id: ", this.roomId);

    if (options.password) {
      console.log("password:", options.password);
      this.setPrivate();
    }

    this.onMessage("*", async(client, type, message) => {
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
        case "game-start":
          this.readyPlayer++;
          console.log("game-start readyPlayer: ",this.readyPlayer, "   remoteRoomId: ",this.remoteRoomId);
          if(this.readyPlayer == this.state.players.size){
            this.broadcast('game-start', { data: {playerCount:this.state.players.size} });
            
            if(!this.isCountingTime){
              this.isCountingTime = true;
              this.roomStartTime = Date.now();
              this.CountingTime();
            }

            try{
              await matchMaker.remoteRoomCall(this.remoteRoomId, "closeRoom", [{ roomId: this.roomId }]);
            }catch(error){
              console.error("Error calling remote room:", error);
            }
          }

          break;
        case "game-over":
          console.log("gameover:", message);
          this.broadcast('game-over', { data: message });

          setTimeout(() => {
            this.disconnect();
          }, 5000);
          break;
        case "update-score":

          this.broadcast('game-event', { event: 'update-score', data: message.data });

          break;

        case "update-mainball":
          // console.log("update-mainball message: ",message);
          let angle = message.angle;
          let skin = message.skin;

          this.state.mainBalls.forEach((ball)=>{
            ball.angle =  message.angle;
            ball.skin = message.skin;
            ball.side = message.side;
            ball.countArrow = message.countArrow;
            // console.log("this.state.mainBall.angle: ",ball.angle);
          })

        break;
        case "spawn-arrow":
          // this.state.createArrow(message.data.id, message.data.posX, message.data.posY, message.data.angle);
          this.broadcast('game-event', { event: 'spawn-arrow', data: message.data });
        break;
        case "updated-arrow":
          this.state.arrows.forEach((arrow)=>{
            if(arrow.id == message.id){
              arrow.posX = message.posX;
              arrow.posY = message.posY;
              arrow.angle = message.angle;
            }
          })
        break;
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

  
  private CountingTime(){// Set the room start time

    // Create an interval to update the time counter
    this.timeInterval = this.clock.setInterval(() => {
      const currentTime = Date.now();
      const elapsedTime = Math.floor((currentTime - this.roomStartTime) / 1000); // Convert to seconds
      let matchTimer = this.maxMatchTime - elapsedTime;

      // console.log("matchTimer: ",matchTimer);
      // Optionally, broadcast the time to all clients
      this.broadcast("time-update", { timeCounter: matchTimer });

      
      if (matchTimer <= 0) {
        this.timeInterval.clear();
      }

    }, 1000); // Update every second
  }

  onJoin(client: Client, options: any) {
    this.unlock();
    if (this.state.players.size === this.maxClients - 1) {
      this.lock();
    }
  }

  async onLeave(client: Client, consented: boolean) {
    console.log("onLeave client.id: ", client.id, "   consented: ", consented);
    //this.disconnect();    
    this.state.players.get((client as any).options?.userId).connected = false;
    try {
      if (consented) {
        throw new Error("consented leave");
      }
      const reconnection = this.allowReconnection(client, "manual");

      // now it's time to `await` for the reconnection
      await reconnection;


      // client returned! let's re-activate it.
      this.state.players.get((client as any).options.userId).connected = true;

      const promise = await reconnection.promise;
      console.log("battle room reconnection token:", promise._reconnectionToken);
    } catch (e) {
      console.log("onLeave catch error: ", e);
      // reconnection has been rejected. let's remove the client.
      //this.state.players.delete((client as any).options.userId);
    }
  }


  async setPlayer(playerstate: any[]) {
    // @ts-ignore
    console.log(`Battle ${this.roomId} Set Player- received ${playerstate?.roomId} : true`);
    // @ts-ignore
    this.remoteRoomId = playerstate?.roomId;
    // @ts-ignore
    Object.entries(playerstate?.player).forEach(([sessionId, options], index) => {
      const _player = this.state.createPlayer((options as { sessionId: string })?.sessionId, options, index,
        (options as { uid: string })?.uid, "battle",
        (options as { walletid: string })?.walletid,
        (options as { ticket: string })?.ticket,
        (options as { passCred: string })?.passCred,
        (options as { playerNumber: number })?.playerNumber);

        this.state.createBall();
    });

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