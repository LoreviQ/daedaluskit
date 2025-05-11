import { GoogleGenAI } from "@google/genai";
import {
    Gateway,
    GatewayOutput,
    Edict,
    typeConversions,
    LLMCallParams,
} from "@daedaluskit/core";

export interface Gemini25FlashConfig {
    apiKey: string;
}

export class Gemini25Flash extends Gateway<Gemini25FlashConfig> {
    private client: GoogleGenAI;

    constructor(config: any) {
        super(
            "gemini-2.5-flash-preview-04-17",
            "Gemini 2.5 Flash",
            1048576,
            config
        );
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
        edicts: Map<string, Edict>,
        llmParams: LLMCallParams
    ): Promise<GatewayOutput> {
        // Build the function declarations for the edicts
        const declarations = [];
        for (const edict of edicts.values()) {
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

        // Call the Gemini API
        const response = await this.client.models.generateContent({
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

        this.logger?.debug(
            "----------GEMINI 2.5 FLASH RESPONSE----------",
            response
        );

        // Execute the edicts based on the function calls in the response
        const executedEdicts = [];
        if (response.functionCalls && response.functionCalls.length > 0) {
            for (const functionCall of response.functionCalls) {
                if (!functionCall.name) {
                    throw new Error(`Error: Function call name is undefined.`);
                }
                const edict = edicts.get(functionCall.name);
                if (!edict) {
                    throw new Error(
                        `Error: Edict with key ${functionCall.name} not found.`
                    );
                }
                const result = edict.execute(functionCall.args);
                executedEdicts.push({
                    key: functionCall.name,
                    args: functionCall.args,
                    result: result,
                });
            }
        } else {
            this.logger?.info("No function call found in the response.");
            this.logger?.info(response.text);
        }
        // returns metadata about the response
        return {
            finalTextResponse: response.text,
            executedEdicts: executedEdicts,
            usageData: {
                promptTokens:
                    response.usageMetadata?.promptTokenCount || undefined,
                completionTokens:
                    response.usageMetadata?.candidatesTokenCount || undefined,
                totalTokens:
                    response.usageMetadata?.totalTokenCount || undefined,
            },
        };
    }
}
