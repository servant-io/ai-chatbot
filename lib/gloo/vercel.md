## [Using the Vercel AI SDK](https://docs.ai.gloo.com/docs/quickstart-for-developers#using-the-vercel-ai-sdk)

```python
// Setup

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const provider = createOpenAICompatible({
  name: 'gloo-ai',
  apiKey: 'CLIENT_ACCESS_TOKEN',  // Your Client Access Token
  baseURL: 'https://platform.ai.gloo.com/ai/v1',  // Gloo base URL
});


// Completions

const { text } = await generateText({
  model: provider('us.meta.llama3-3-70b-instruct-v1:0'),
  prompt: 'How can I find a mentor?',
});

console.log(text);


// List models is not supported by Vercel AI SDK
```
