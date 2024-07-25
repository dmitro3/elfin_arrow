import { Schema, type } from "@colyseus/schema";

export class Player extends Schema {
    public connected: boolean;
    private isBot: boolean;
    private uid: string;
    private walletid: string;
    public sessionId: string;
    public accessToken: string;
    public options: any;
    
    @type("number") posx!: number;
    @type("number") posy!: number;
    @type("number") life!: number;
    @type("string") rank!: string;
    @type("number") playerNumber!: number;

    @type("string") name: string;
    @type("string") state: string;
    @type("string") userId: string;
    @type("string") walletId: string;    
    @type("string") ticket: string;    
    @type("string") passCred: string;    
    @type("boolean") reserveSeat: boolean;
}