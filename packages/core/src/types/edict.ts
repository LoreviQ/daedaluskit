import { Agent } from "../agent";

export interface IEdict<Config = any, Args = any, Result = any> {
    readonly key: string;
    config?: Config;
    description: string; // Textual description of what the edict does for the LLM
    argsSchema?: any; // JSON schema for the arguments
    initialize?(agent: Agent): Promise<void>;
    execute(args: Args): Promise<Result>; // execution function
    toPrompt(): string; // function to convert the edict to a prompt
}

export abstract class Edict<Config = any, Args = any, Result = any>
    implements IEdict<Config, Args, Result>
{
    readonly key: string;
    config?: Config;
    description: string;
    argsSchema?: any;

    constructor(
        key: string,
        options: {
            description: string;
            argsSchema?: any;
            config?: Config;
        }
    ) {
        this.key = key;
        this.description = options.description;
        this.argsSchema = options.argsSchema;
        this.config = options.config;
    }

    public async initialize?(agent: Agent): Promise<void>;
    public abstract execute(args: Args): Promise<Result>;

    public toPrompt(): string {
        let desc = `Tool: ${this.key}\nDescription: ${this.description}`;
        if (this.argsSchema) {
            // Ensure argsSchema isn't undefined before stringifying
            try {
                desc += `\nArguments (JSON Schema): ${JSON.stringify(
                    this.argsSchema,
                    null,
                    2
                )}`;
            } catch (e) {
                desc += `\nArguments Schema: (Error serializing schema)`;
            }
        }
        return desc + "\n---";
    }
}
