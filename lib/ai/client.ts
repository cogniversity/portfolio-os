import OpenAI from "openai";

export class AIConfigError extends Error {
  constructor(message = "AI is not configured. Set OPENAI_API_KEY in .env.") {
    super(message);
    this.name = "AIConfigError";
  }
}

export class AIRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIRuntimeError";
  }
}

export function isAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AIConfigError();
  if (client) return client;
  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  return client;
}

export function getModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}

const MAX_INPUT_CHARS = 8000;

export function trimProse(input: string): string {
  if (input.length <= MAX_INPUT_CHARS) return input;
  return input.slice(0, MAX_INPUT_CHARS) + "\n\n[...truncated]";
}
