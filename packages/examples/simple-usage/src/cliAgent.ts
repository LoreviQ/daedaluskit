import { Agent } from "@daedaluskit/core";
import { Catalysts, Runes, Edicts, Gateways } from "@daedaluskit/basic";

const catalyst = new Catalysts.Direct();

const cliAgent = new Agent()
    .addRunes([
        new Runes.CatalystContext(),
        new Runes.SystemPrefix("You are a helpful assistant."),
    ])
    .addEdict(new Edicts.Reply())
    .addCatalyst(catalyst)
    .setGateway(
        new Gateways.Gemini25Flash({
            apiKey: process.env.GEMINI_API_KEY || "",
        })
    );
