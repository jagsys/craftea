import { z } from 'zod';

export interface ToolExample {
  userInput: string;
  toolInput: Record<string, unknown>;
}

export interface ToolMetadata {
  instructions?: string;
  examples?: ToolExample[];
  requiresConfirmation?: boolean;
}

export interface ToolSchema {
  name: string;
  description: string;
  schema: z.ZodObject<any>;
  metadata: ToolMetadata;
}

export class ToolSchemaBuilder {
  private name?: string;
  private description?: string;
  private inputSchema?: z.ZodObject<any>;
  private metadata: ToolMetadata = {};

  static withName(name: string): ToolSchemaBuilder {
    const builder = new ToolSchemaBuilder();
    builder.name = name;
    return builder;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  withInstructions(instructions: string): this {
    this.metadata.instructions = instructions;
    return this;
  }

  withInputSchema(schema: z.ZodObject<any>): this {
    this.inputSchema = schema;
    return this;
  }

  addExample(example: ToolExample): this {
    if (!this.metadata.examples) {
      this.metadata.examples = [];
    }
    this.metadata.examples.push(example);
    return this;
  }

  requiresConfirmation(value: boolean = true): this {
    this.metadata.requiresConfirmation = value;
    return this;
  }

  build(): ToolSchema {
    if (!this.name) {
      throw new Error('Tool name is required');
    }
    if (!this.description) {
      throw new Error('Tool description is required');
    }
    if (!this.inputSchema) {
      throw new Error('Tool input schema is required');
    }

    return {
      name: this.name,
      description: this.description,
      schema: this.inputSchema,
      metadata: this.metadata,
    };
  }
}
