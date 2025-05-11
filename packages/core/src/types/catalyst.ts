import { Logger } from "winston";

import { Agent } from "../agent";

export interface ICatalyst<Config = any> {
    readonly key: string;
    config?: Config;
    agent?: Agent;
    logger?: Logger;
    initialize(agent: Agent): void;
}

export abstract class Catalyst<Config = any> implements ICatalyst<Config> {
    readonly key: string;
    config?: Config;

    // defined in initialize()
    agent?: Agent;
    logger?: Logger;

    constructor(key: string, config?: Config) {
        this.key = key;
        this.config = config;
    }

    public initialize(agent: Agent): void {
        this.agent = agent;
        this.logger = agent.logger.child({ componentKey: this.key });
    }
}
