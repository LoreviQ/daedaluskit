import { Edict } from "@daedaluskit/core";
import { OpenAPIV3 } from "openapi-types";

export class ReplyEdict extends Edict {
    constructor(
        argsSchema: OpenAPIV3.SchemaObject = {
            type: "object",
            properties: {
                replyText: {
                    type: "string",
                    description: "The content of the reply to the user",
                },
            },
            required: ["replyText"],
        }
    ) {
        super("reply", "Replies to the console CLI interface", argsSchema);
    }

    public async execute(args: { messageId: string; replyText: string }) {
        // log in CLI
        console.log(args.replyText);
    }
}
