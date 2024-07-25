import { Schema, type } from "@colyseus/schema";

export class MainBall extends Schema {
    @type("number") angle!: number;
    @type("number") skin!: number;
    @type("number") side!: number;
    @type("number") countArrow!: number;
}