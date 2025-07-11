import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";
import { accessToken } from "@/lib/gloo/api";
import { defaultModel } from "@/lib/gloo/models";

/**
 * Create a Gloo AI provider for Vercel AI SDK
 */
export function createGlooProvider() {
  console.log("[GLOO_DEBUG] createGlooProvider called");
  
  try {
    const token = accessToken();
    console.log("[GLOO_DEBUG] Access token retrieved successfully");
    
    const provider = createOpenAICompatible({
      name: "gloo-ai",
      apiKey: token,
      baseURL: "https://platform.ai.gloo.com/ai/v1",
    });
    
    console.log("[GLOO_DEBUG] OpenAI compatible provider created successfully");
    return provider;
  } catch (error) {
    console.error("[GLOO_DEBUG] createGlooProvider error:", error);
    throw error;
  }
}

/**
 * Generate text using Gloo AI with Vercel AI SDK
 */
export async function generateGlooText(model: string, prompt: string) {
  const provider = createGlooProvider();

  const { text } = await generateText({
    model: provider(model),
    prompt,
  });

  return text;
}

/**
 * Generate text with messages using Gloo AI with Vercel AI SDK
 */
export async function generateGlooTextWithMessages(
  model: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
) {
  const provider = createGlooProvider();

  const { text } = await generateText({
    model: provider(model),
    messages,
  });

  return text;
}

/**
 * Example usage function matching the markdown example
 */
export async function exampleUsage() {
  try {
    // Basic text generation example
    const text = await generateGlooText(
      defaultModel,
      "How can I find a mentor?",
    );

    console.log(text);

    // Advanced example with messages
    const advancedText = await generateGlooTextWithMessages(defaultModel, [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "How can I find a mentor?" },
    ]);

    console.log(advancedText);
  } catch (error) {
    console.error("Error:", error);
  }
}
