import { OpenAPIV3 } from "openapi-types";

export interface IEdict<Config = any, Args = any, Result = any> {
    readonly key: string;
    config?: Config;
    description: string; // Textual description of what the edict does for the LLM
    argsSchema?: OpenAPIV3.SchemaObject; // JSON schema for the arguments matching the OpenAPI V3 spec
    /// responseSchema?: TODO
    execute(args: Args): Promise<Result>; // execution function
    toPrompt(): string; // function to convert the edict to a prompt
}

export abstract class Edict<Config = any, Args = any, Result = any>
    implements IEdict<Config, Args, Result>
{
    readonly key: string;
    description: string;
    argsSchema?: OpenAPIV3.SchemaObject;
    config?: Config;

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

    public abstract execute(args: Args): Promise<Result>;

    public toPrompt(): string {
        let desc = `Tool: ${this.key}\nDescription: ${this.description}`;
        if (this.argsSchema) {
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
