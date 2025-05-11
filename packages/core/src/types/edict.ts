import { OpenAPIV3 } from "openapi-types";
import { Logger } from "winston";

import { Agent } from "../agent";

export interface IEdict<Config = any, Args = any, Result = any> {
    readonly key: string;
    config?: Config;
    description: string; // Textual description of what the edict does for the LLM
    agent?: Agent;
    logger?: Logger;
    argsSchema?: OpenAPIV3.SchemaObject; // JSON schema for the arguments matching the OpenAPI V3 spec
    /// responseSchema?: TODO
    initialize(agent: Agent): void;
    toPrompt(): string; // function to convert the edict to a prompt
    execute(args: Args): Promise<Result>; // execution function
}

export abstract class Edict<Config = any, Args = any, Result = any>
    implements IEdict<Config, Args, Result>
{
    readonly key: string;
    description: string;
    argsSchema?: OpenAPIV3.SchemaObject;
    config?: Config;

    // defined in initialize()
    agent?: Agent;
    logger?: Logger;

    constructor(
        key: string,
        description: string,
        argsSchema?: OpenAPIV3.SchemaObject,
        config?: Config
    ) {
        this.key = key;
        this.description = description;
        this.argsSchema = argsSchema;
        this.config = config;
    }

    public initialize(agent: Agent): void {
        this.agent = agent;
        this.logger = agent.logger.child({ componentKey: this.key });
    }

    public toPrompt(): string {
        const prompt = [];
        prompt.push(`<${this.key}_tool>`);
        prompt.push(`Key: ${this.key}`);
        prompt.push(`Description: ${this.description}`);
        if (this.argsSchema) {
            try {
                const args = `Arguments (JSON Schema): ${JSON.stringify(
                    this.argsSchema,
                    null,
                    2
                )}`;
                prompt.push(args);
            } catch (e) {
                this.logger?.error(`Error converting argsSchema to JSON: ${e}`);
            }
        }
        prompt.push(`</${this.key}_tool>`);
        return prompt.join("\n");
    }

    public abstract execute(args: Args): Promise<Result>;
}
