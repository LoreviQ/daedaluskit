import {
    Schema as GoogleGenaiSchema,
    Type as GoogleGenaiType,
} from "@google/genai";
import { OpenAPIV3 } from "openapi-types";

/**
 * Maps OpenAPI types to @google/genai types.
 * @param schema The OpenAPIV3.SchemaObject to convert.
 * @returns The corresponding GoogleGenAIType.
 */
function setType(schema: OpenAPIV3.SchemaObject): GoogleGenaiType {
    // Handle explicitly defined types first
    switch (schema.type) {
        case "string":
            return GoogleGenaiType.STRING;
        case "number":
            return GoogleGenaiType.NUMBER;
        case "integer":
            return GoogleGenaiType.INTEGER;
        case "boolean":
            return GoogleGenaiType.BOOLEAN;
        case "array":
            return GoogleGenaiType.ARRAY;
        case "object":
            return GoogleGenaiType.OBJECT;
    }

    // Try to infer based on OpenAPI spec rules
    if ("items" in schema) {
        return GoogleGenaiType.ARRAY;
    }
    if ("properties" in schema || "additionalProperties" in schema) {
        return GoogleGenaiType.OBJECT;
    }

    // Default if type is not specified and cannot be inferred from properties/items
    if (schema.type === undefined) {
        console.warn(
            `Schema type is undefined and cannot be inferred for schema: ${JSON.stringify(
                schema
            )}. Defaulting to TYPE_UNSPECIFIED.`
        );
    } else {
        // schema.type was specified but not one of the known cases
        console.warn(
            `Unsupported schema type: "${schema.type}". Defaulting to TYPE_UNSPECIFIED.`
        );
    }
    return GoogleGenaiType.TYPE_UNSPECIFIED;
}

function schemaObjectToGenAiSchema(
    schema: OpenAPIV3.SchemaObject,
    componentsSchemas?: OpenAPIV3.ComponentsObject["schemas"],
    processingRefs?: Set<string>
): GoogleGenaiSchema {
    const genAiSchema: GoogleGenaiSchema = {};

    // Map common and supported properties
    genAiSchema.type = setType(schema);
    if (schema.format) {
        genAiSchema.format = schema.format;
    }
    if (schema.description) {
        genAiSchema.description = schema.description;
    }
    if (typeof schema.nullable === "boolean") {
        genAiSchema.nullable = schema.nullable;
    }

    if (schema.enum) {
        // @google/genai schema typically expects string enums for its 'enum' field.
        // Ensure all enum values are strings or handle appropriately.
        if (schema.enum.every((e) => typeof e === "string")) {
            genAiSchema.enum = schema.enum as string[];
        } else if (
            schema.enum.every(
                (e) =>
                    typeof e === "number" ||
                    typeof e === "string" ||
                    typeof e === "boolean" ||
                    e === null
            )
        ) {
            // If enums are mixed but convertible to string, attempt conversion.
            // The genai library specifically mentions `string[]` for `enum` in some contexts.
            console.warn(
                "OpenAPI enum contains non-string values. Attempting to convert to string for @google/genai. Review if this is appropriate for your use case."
            );
            genAiSchema.enum = schema.enum.map(String);
        } else {
            console.warn(
                "OpenAPI enum contains complex types that cannot be directly mapped to string[]. Skipping 'enum' field."
            );
        }
    }

    // Recursive conversion for array items
    if (genAiSchema.type === GoogleGenaiType.ARRAY) {
        const arraySchema = schema as OpenAPIV3.ArraySchemaObject;
        if (arraySchema.items) {
            genAiSchema.items = OpenApiV3SchemaToGoogleGenaiSchema(
                arraySchema.items,
                componentsSchemas,
                processingRefs
            );
        } else {
            console.warn(
                "OpenAPI array schema is missing 'items'. The resulting @google/genai schema might be invalid."
            );
        }
    }

    // Recursive conversion for object properties
    if (genAiSchema.type === GoogleGenaiType.OBJECT) {
        if (schema.properties) {
            genAiSchema.properties = {};
            for (const key in schema.properties) {
                if (
                    Object.prototype.hasOwnProperty.call(schema.properties, key)
                ) {
                    const propSchema = schema.properties[key];
                    genAiSchema.properties[key] =
                        OpenApiV3SchemaToGoogleGenaiSchema(
                            propSchema,
                            componentsSchemas,
                            processingRefs
                        );
                }
            }
        }
        if (schema.required && schema.required.length > 0) {
            genAiSchema.required = schema.required;
        }
    }
    return genAiSchema;
}

function referenceObjectToGenAiSchema(
    refObject: OpenAPIV3.ReferenceObject,
    componentsSchemas: OpenAPIV3.ComponentsObject["schemas"] | undefined,
    processingRefs: Set<string>
): GoogleGenaiSchema {
    const refString = refObject.$ref;

    if (processingRefs.has(refString)) {
        console.error(
            `Circular reference detected: ${refString}. Cannot resolve.`
        );
        throw new Error(`Circular reference detected: ${refString}`);
    }

    if (!componentsSchemas) {
        throw new Error(
            `Cannot resolve reference "${refString}": 'componentsSchemas' was not provided.`
        );
    }

    // Basic $ref parsing: expecting #/components/schemas/SchemaName
    const parts = refString.split("/");
    if (
        parts[0] !== "#" ||
        parts[1] !== "components" ||
        parts[2] !== "schemas" ||
        parts.length !== 4
    ) {
        throw new Error(
            `Unsupported or malformed $ref format: "${refString}". Only "#/components/schemas/Name" is supported.`
        );
    }
    const schemaName = parts[3];
    const referencedSchema = componentsSchemas[schemaName];

    if (!referencedSchema) {
        throw new Error(
            `Reference "${refString}" not found in provided 'componentsSchemas'.`
        );
    }

    // Add to processing set before recursive call
    processingRefs.add(refString);

    const result = OpenApiV3SchemaToGoogleGenaiSchema(
        referencedSchema,
        componentsSchemas,
        processingRefs
    );

    // Remove from processing set after recursive call (cleaning up for parallel branches if any)
    processingRefs.delete(refString);

    return result;
}

/**
 * Converts an OpenAPIV3.SchemaObject or OpenAPIV3.ReferenceObject to a @google/genai Schema.
 *
 * @param openApiSchema The schema to convert.
 * @param componentsSchemas Optional map of schemas from OpenAPI components, used for resolving $ref.
 * @param processingRefs Internal set to track visited $refs and detect circular dependencies.
 * @returns The corresponding GoogleGenAISchema.
 * @throws Error if a $ref cannot be resolved or a circular reference is detected.
 */
export function OpenApiV3SchemaToGoogleGenaiSchema(
    openApiSchema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject,
    componentsSchemas?: OpenAPIV3.ComponentsObject["schemas"],
    processingRefs: Set<string> = new Set()
): GoogleGenaiSchema {
    // Determine type of schema and pass to appropriate conversion function
    if (typeof (openApiSchema as OpenAPIV3.ReferenceObject).$ref === "string") {
        return referenceObjectToGenAiSchema(
            openApiSchema as OpenAPIV3.ReferenceObject,
            componentsSchemas,
            processingRefs
        );
    } else {
        return schemaObjectToGenAiSchema(
            openApiSchema as OpenAPIV3.SchemaObject,
            componentsSchemas, // Pass componentsSchemas for potential nested $refs
            processingRefs // Pass processingRefs for potential nested $refs
        );
    }
}
