import OpenAI from "openai";
import { accessToken } from "@/lib/gloo/api";
import { defaultModel } from "@/lib/gloo/models";
import { access } from "fs";

/**
 * Create an OpenAI client configured for Gloo AI
 */
export async function createGlooOpenAIClient(): Promise<OpenAI> {
  return new OpenAI({
    apiKey: accessToken(),
    baseURL: "https://platform.ai.gloo.com/ai/v1",
  });
}

/**
 * Create a chat completion using Gloo AI
 */
export async function createChatCompletion(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
) {
  const client = await createGlooOpenAIClient();

  const response = await client.chat.completions.create({
    model,
    messages,
  });

  return response;
}

/**
 * List available models from Gloo AI
 */
export async function listModels() {
  const client = await createGlooOpenAIClient();

  const models = await client.models.list();

  return models;
}

/**
 * Example usage function matching the Python example
 */
export async function exampleUsage() {
  try {
    // Chat completion example
    const response = await createChatCompletion(defaultModel, [
      { role: "system", content: "You are a teacher." },
      { role: "user", content: "How can I be joyful in hard times?" },
    ]);

    console.log(response.choices[0].message.content);

    // List models example
    const models = await listModels();
    console.log(models);
  } catch (error) {
    console.error("Error:", error);
  }
}
