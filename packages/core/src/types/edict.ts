import { Agent } from "../agent";

export interface Edict<Config = any, Args = any, Result = any> {
    readonly key: string;
    config?: Config;
    description: string; // Textual description of what the edict does for the LLM
    argsSchema?: any; // JSON schema for the arguments
    initialize?(agent: Agent): Promise<void>;
    execute(args: Args): Promise<Result>; // execution function
}
