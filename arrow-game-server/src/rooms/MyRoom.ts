import { Room, Client, Delayed, matchMaker, ServerError } from "@colyseus/core";
import { MyRoomState } from "./schema/MyRoomState";
import { userinfo, transferWallet, getGamePass, payGamePass, gameStart } from "../thirdparties/GGGamersApi";
import { syncTicket, userme } from "../thirdparties/DynamodbAPI";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 4;
  // maxClients = 2; //testing
  public delayedInterval!: Delayed;
  privateRoom: any;
  battleRoom: any;
  // autoDispose = false;  
  privateMode = false;
  private roomStartTime: number;
  private isCountingTime: boolean;
  private timeInterval!: Delayed;
  private waitingPlayerTime: number = 30;

  onCreate(options: any) {
    this.setState(new MyRoomState());
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

  private CountingTime(){// Set the room start time

    // Create an interval to update the time counter
    this.timeInterval = this.clock.setInterval(() => {
      const currentTime = Date.now();
      const elapsedTime = Math.floor((currentTime - this.roomStartTime) / 1000); // Convert to seconds
      this.state.timeCounter = elapsedTime;

      // console.log("My Room CountingTime: ",this.state.timeCounter);

      // Optionally, broadcast the time to all clients
      this.broadcast("waiting-time-update", { timeCounter: this.waitingPlayerTime - elapsedTime });

      // Check if 2 minutes have passed
      if (this.state.timeCounter >= this.waitingPlayerTime && !this.state.waitingForServer && this.state.players.size >= 2) {
        this.lock();
        this.startBattleRoomSearch(true);
        this.broadcast("waiting-time-update", { timeCounter: 0 });
        this.timeInterval.clear();
      }

    }, 1000); // Update every second
  }

  private startBattleRoomSearch(canStartGame: boolean) {

    // When room is full
    if (canStartGame) {
      // this.lock();
      //For private mode, select the correct private room
      if (this.privateMode) {
      } else {

        this.delayedInterval = this.clock.setInterval(async () => {          //send room length to clients

          const battleRoom = this.privateMode ? this.privateRoom : await matchMaker.findOneRoomAvailable("battleRoom", { mode: 'autogame' });

          console.log("have battleRoom: ", battleRoom);
          if (battleRoom) {
            this.lock();
            this.battleRoom = battleRoom;

            let players: any = [];
            // @ts-ignore
            this.state.players.forEach(async (player) => {
              players[players?.length] = { ...player, player: player };

              const client = this.clients.getById(player.sessionId);
              console.log("player.playerNumber: ", player.playerNumber);
              const options = { accessToken: player?.accessToken, sessionId: player?.sessionId, walletId: (player as any)?.walletid, userId: (player as any)?.uid, name: player?.name, ticket: player?.ticket, passCred: player?.passCred, playerNumber: player.playerNumber };

              if (client) {
                // client.send("get-my-sessionId", { data: player?.sessionId });
                const matchData = await matchMaker.reserveSeatFor(this.battleRoom, options);
                client.send("reserveSeatFor", { data: matchData });
                player.reserveSeat = true;
              }
            });

            console.log("battle-room-id");
            this.broadcast("battle-room-id", {});
            const payload = await matchMaker.remoteRoomCall(battleRoom.roomId, "setPlayer", [{ roomId: this.roomId, player: players }]);
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

    }else{
      this.unlock();
    }
  }

  async onJoin(client: Client, options: any) {
    console.log("queue room on join reconnect token:", this.roomId + ":" + client?._reconnectionToken);

    if (options.password && options.password == this.listing.password) {
      client.send("privateRoomId", { data: this.roomId });
      this.privateMode = true;
    }

    console.log("options: ", options);


    // let shouldContinue = true;

    // this.state.players.forEach((player, sessionId) => {
    //     if(options?.player?.uid == player.userId){
    //         console.log(`Queue room ${this.roomId} player ${player.userId} exist, sessionId: ${sessionId}.`);
    //         try{
    //             this.state.players.delete(client.sessionId);
    //             client.send("create-new-room", {});
    //         }catch(e){
    //             console.log(`Queue room ${this.roomId} remove old player ${player.userId} failed.`);
    //         }
    //         shouldContinue = false;
    //         return false;
    //     }
    // });

    // if (!shouldContinue) 
    //     return false;

    const syncTicketData = {
      "userId": options?.player?.uid,
      "ticket_id": (client as any)?.ticket,
      "state": "queue",
      "game_id": "ElfinArrow",
      "reconnectToken": this.roomId+":"+ client?._reconnectionToken
    }
    const syncTicketPayload = await syncTicket(options?.player?.accessToken, JSON.stringify(syncTicketData));

    const player = this.state.createPlayer(client.sessionId, options?.player, this.state.players.size, options?.player?.uid, "queue", options?.player?.walletId, (client as any)?.ticket, (client as any)?.passCred);
    player.playerNumber = this.state.players.size;
    // client.send("updateMessage", {message: "Wait for another player ..."});

    console.log("this.state.players.size: ", this.state.players.size);

    let canStartGame = this.state.players.size == this.maxClients;

    let players: any = [];
    this.state.players.forEach(player => {
      
      let shortWalletId = player.walletId.substring(0,10);
      let data = {
        id: player.sessionId,
        playerNumber: player.playerNumber,
        walletId: shortWalletId
      }
      players.push(data);
    })

    this.broadcast("game-event", {
      event: `set-player`, data: {
        players: players,
        canStartGame: canStartGame
      }
    });

    this.startBattleRoomSearch(canStartGame);

    if(this.state.players.size > 1){
      if(!this.isCountingTime)
        this.roomStartTime = Date.now();

      this.isCountingTime = true;
      this.CountingTime();
    }
    
  }

  async onAuth(client: Client, options: any, request: any | Promise<any>) {
    try {
      
      // options.player.sessionId = client.sessionId;
      if (process.env.NODE_ENV !== "production" && options?.debug === true) {
        options.player.isBot = true;
        return true;
      }
      if (!options?.accessToken) {
        throw new Error("Token not exists")
      }      
  
      const payload = await userinfo(options.accessToken);
      options.player.accessToken = options.accessToken;
      options.player.uid = payload?.data?.data?.userId;
      options.player.walletId = payload?.data?.data?.connectedWallets[0].walletAddress;
      options.player.name = payload?.data?.data?.nickname;

      if (!payload) {
        throw new Error("User not found");
      }

      let ticket = null;
      const userInfo = await userme(options?.accessToken);
      const _userInfo = userInfo?.data?.data;
      if(!_userInfo)
        throw new Error("userInfo not exists")

      const currentTime = new Date().getTime();
      const createTime = _userInfo?.ticket?.create_time ? new Date(_userInfo?.ticket?.create_time).getTime() : null;

      if(_userInfo?.ticket_id && _userInfo?.ticket?.state && ["NEW", "gameover"].indexOf(_userInfo?.ticket?.state) === -1 && createTime && currentTime - createTime <= 5 * 60 * 1000) {        
        ticket = _userInfo?.ticket_id;
        return false;
      }
  
      //user no ticket, check the game pass first..
      const gamePassPayload = await getGamePass(options.accessToken);
      if(gamePassPayload.data.code !== 1)
        throw new Error("Get Game Pass Error.");

      //console.log("gamePassPayload:", gamePassPayload.data);

      //Get unlocked ticket
      (gamePassPayload?.data?.data || []).forEach((_data:any)=>{
        if(!_data.locked)
          ticket = _data.passId;
      });

      if(ticket == null){
        //no ticket, pay to buy a new ticket
        throw new Error("Error: No ticket");      
      }


        //sync-ticket state (NEW)
        const syncTicketData = {
            "userId": options?.player?.uid,
            "ticket_id": ticket as string,
            "state": "NEW",
            "game_id": "ElfinGolf",
            "reconnectToken": this.roomId+":"+ client?._reconnectionToken
        }

        const syncTicketPayload = await syncTicket(options.accessToken, JSON.stringify(syncTicketData));
        if(syncTicketPayload.data.result !== 1)
            throw new Error("Sync Ticket Error.");
        //console.log('Sync Ticket successful:', syncTicketPayload.data);

  

      // redeem ticket
      const gameStartPayload = await gameStart(options.accessToken, ticket);
      //console.log("gameStartPayload:", gameStartPayload.data);
      if(gameStartPayload.data.code !== 1)
        throw new Error("Game Start Error.");      

      (client as any).passCred = gameStartPayload.data?.data?.passCred;
      (client as any).ticket = ticket;

      return true;
    } catch (error: any) {
      console.error(error);
      throw new ServerError(400, "Bad access token");
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    this.state.players.delete(client.sessionId);

    let playes: any = [];
    this.state.players.forEach(player => {
      let data = {
        id: player.sessionId,
        playerNumber: player.playerNumber,
      }
      playes.push(data);
    })

    this.broadcast("game-event", {
      event: `leave-player`, data: {
        players: playes
      }
    });

    if(this.state.players.size == 1)
      this.isCountingTime = false;
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
