import { Edict } from "@daedaluskit/core";

export class ReplyEdict extends Edict {
    constructor(
        key: string = "reply",
        description: string = "Reply to the users message",
        argsSchema: any = {
            type: "object",
            properties: {
                replyText: { type: "string" },
            },
            required: ["replyText"],
        }
    ) {
        super(key, description, argsSchema);
    }

    public async execute(args: { messageId: string; replyText: string }) {
        // log in CLI
        console.log(args.replyText);
    }
}
