import { Rune, Context } from "./types";

export class Agent {
    private runes: Map<string, Rune> = new Map();
    private context: Context;
}
