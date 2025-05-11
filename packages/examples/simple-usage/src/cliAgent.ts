import { Agent } from "@daedaluskit/core";
import { Catalysts, Runes, Edicts, Gateways } from "@daedaluskit/basic";

// Added imports for CLI interaction and .env loading
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import dotenv from "dotenv";
import path from "node:path";

// Configure dotenv to load .env from the package root (e.g., packages/examples/simple-usage/.env)
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const catalyst = new Catalysts.Direct();

const cliAgent = new Agent({
    name: "CLI Agent",
    logLevel: "debug",
})
    .addRunes([
        new Runes.CatalystContext(),
        new Runes.SystemPrefix("You are a helpful assistant."),
    ])
    .addEdict(new Edicts.Reply())
    .addCatalyst(catalyst)
    .setGateway(
        new Gateways.Gemini25Flash({
            apiKey: process.env.GEMINI_API_KEY,
        })
    );

async function runCLI() {
    if (!process.env.GEMINI_API_KEY) {
        console.error(
            "GEMINI_API_KEY not found. Please ensure it is set in a .env file"
        );
        process.exit(1);
    }

    const rl = readline.createInterface({ input, output });

    console.log("Daedalus CLI Agent started. Type 'exit' or 'quit' to end.");
    console.log("");

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const userInput = await rl.question("You: ");

        if (
            userInput.toLowerCase() === "exit" ||
            userInput.toLowerCase() === "quit"
        ) {
            break;
        }

        try {
            // catalyst.execute will trigger the agent.
            // The Edicts.Reply() edict should handle printing the agent's response.
            await catalyst.execute(userInput);
        } catch (error) {
            console.error("Error during agent execution:", error);
        }
    }

    rl.close();
    console.log("CLI Agent stopped.");
}

runCLI().catch(console.error);
