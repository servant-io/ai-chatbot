## [Using the OpenAI SDK](https://docs.ai.gloo.com/docs/quickstart-for-developers#using-the-openai-sdk)

```python
# Setup

from openai import OpenAI

client = OpenAI(
    api_key='CLIENT_ACCESS_TOKEN',  # Your Client Access Token
    base_url='https://platform.ai.gloo.com/ai/v1'  # Gloo base URL
)


# Completions

response = client.chat.completions.create(
    model='us.meta.llama3-3-70b-instruct-v1:0',
    messages=[
        {'role': "system", 'content': 'You are a teacher.'},
        {'role': 'user', 'content': 'How can I be joyful in hard times?'}
    ],
)

print(response.choices[0].message.content)


# List models

models = client.models.list()

print(models)
```
