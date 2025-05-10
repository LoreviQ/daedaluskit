import { Agent } from "../agent"; // Adjust path

export interface ICatalyst<Config = any> {
    readonly key: string;
    agent: Agent;
    config?: Config;
}

export abstract class Catalyst<Config = any> implements ICatalyst<Config> {
    readonly key: string;
    agent: Agent;
    config?: Config;

    constructor(key: string, agent: Agent, config?: Config) {
        this.key = key;
        this.agent = agent;
        this.config = config;
    }
}
