import { GoogleGenAI } from "@google/genai";
import {
    Gateway,
    Edict,
    typeConversions,
    LLMCallParams,
} from "@daedaluskit/core";

export interface Gemini25FlashConfig {
    apiKey: string;
}

export class Gemini25Flash implements Gateway<Gemini25FlashConfig> {
    key = "gemini-2.5-flash-preview-04-17";
    config: any;
    name = "Gemini 2.5 Flash";
    contextWindow = 1048576;
    private client: GoogleGenAI;

    constructor(config: any) {
        this.config = config;
        this.client = new GoogleGenAI({
            apiKey: config.apiKey,
        });
    }

    public async tokenize(text: string): Promise<number> {
        const countTokensResponse = await this.client.models.countTokens({
            model: this.key,
            contents: text,
        });
        if (!countTokensResponse.totalTokens) {
            throw new Error(
                `Error counting tokens: Returned totalTokens is undefined.`
            );
        }
        return countTokensResponse.totalTokens;
    }

    public async process(
        systemPrompt: string,
        userPrompt: string,
        edicts: Edict[],
        llmParams: LLMCallParams
    ): Promise<any> {
        const declarations = [];
        for (const edict of edicts) {
            const declaration = {
                name: edict.key,
                description: edict.description,
                parameters: edict.argsSchema
                    ? typeConversions.OpenApiV3SchemaToGoogleGenaiSchema(
                          edict.argsSchema
                      )
                    : {},
            };
            declarations.push(declaration);
        }
        this.client.models.generateContent({
            model: this.key,
            contents: userPrompt,
            config: {
                systemInstruction: systemPrompt,
                temperature: llmParams.temperature,
                topP: llmParams.topP,
                topK: llmParams.topK,
                candidateCount: llmParams.candidateCount,
                maxOutputTokens: llmParams.maxOutputTokens,
                stopSequences: llmParams.stopSequences,
                presencePenalty: llmParams.presencePenalty,
                frequencyPenalty: llmParams.frequencyPenalty,
                seed: llmParams.seed,
                tools: [
                    {
                        functionDeclarations: declarations,
                    },
                ],
            },
        });
    }
}
