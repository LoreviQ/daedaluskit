export class Agent {
    private runes: Map<string, Rune> = new Map();
    private edicts: Map<string, Edict> = new Map();
    private catalysts: ICatalyst[] = [];
    private gateway?: IGateway;
    private context: ContextData = {};
}
