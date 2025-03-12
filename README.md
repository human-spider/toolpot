# Toolpot

A function calling proxy for connecting Google, OpenAI, or Anthropic API with tools through MCP and make it available through unified OpenAI compatible API.
Made for quick deployment of AI agents to Deno Deploy.

## Usage

```
toolpot({
  apiKeys: [Deno.env.get('API_KEY')],
  providers: {
    'openai-default': {
      provider: 'openai',
      apiKey: Deno.env.get('OPENAI_API_KEY')
    },
  },
  mcpServers: {
    'mcprun-default': {
      sseUrl: Deno.env.get('MCP_SSE_URL')
    }
  },
  agents: {
    '4o-mini': {
      model: 'gpt-4o-mini',
      provider: 'openai-default',
      mcpSse: 'mcprun-default'
    }
  }
})
```

Pre-alpha version, use at your own risk!
