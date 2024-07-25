import { Schema, type } from "@colyseus/schema";

export class Arrow extends Schema {
    @type("string") id!: string;
    @type("number") angle!: number;
    @type("number") posX!: number;
    @type("number") posY!: number;
}