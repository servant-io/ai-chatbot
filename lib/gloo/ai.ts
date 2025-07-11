import { LanguageModelV2 } from "@ai-sdk/provider";
import { defaultModel, models } from "@/lib/gloo/models";
import { createGlooProvider } from "@/lib/gloo/vercel";

export function glooai(modelId: string = defaultModel): LanguageModelV2 {
  console.log("[GLOO_DEBUG] glooai called with modelId:", modelId);
  
  if (!models.includes(modelId)) {
    console.error("[GLOO_DEBUG] Invalid model ID:", modelId, "Available models:", models);
    throw new Error(`Invalid model ID: ${modelId}`);
  }

  console.log("[GLOO_DEBUG] Model ID validated successfully");

  try {
    // Create the OpenAI compatible provider using the vercel module
    const provider = createGlooProvider();
    console.log("[GLOO_DEBUG] Provider created successfully");

    // Return the specific model
    const model = provider(modelId);
    console.log("[GLOO_DEBUG] Model instance created successfully");
    
    return model;
  } catch (error) {
    console.error("[GLOO_DEBUG] glooai error:", error);
    throw error;
  }
}
