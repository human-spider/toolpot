import type { Request, Response } from 'express'
import type { ToolpotConfig, ToolpotSupportedProvider } from "./mod.ts"

import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { streamText, generateText, type CoreMessage, type ToolSet } from 'ai'

import { openAICompatibleResponseStream } from "./stream.ts"
import { McpSseConnection } from "./mcp.ts";

const providerFactories = { openai: createOpenAI, anthropic: createAnthropic, google: createGoogleGenerativeAI }

export const handleRequest = async (req: Request, res: Response, config: ToolpotConfig): Promise<void> => {
  const { messages, stream, model } = req.body as { messages: CoreMessage[], model: string, stream: boolean };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  if (!model || !config.agents[model]) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const agentConfig = config.agents[model]
  const providerConfig = config.providers[agentConfig?.provider]
  if (!agentConfig || !providerConfig || !Object.keys(providerFactories).includes(providerConfig.provider)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const mcpSseUrl = agentConfig.mcpSse && config.mcpServers?.[agentConfig.mcpSse]?.sseUrl

  const aiSdkModel = providerFactories[providerConfig.provider as ToolpotSupportedProvider]({
    apiKey: providerConfig.apiKey
  })(agentConfig.model, agentConfig.modelArgs)

  let mcp: McpSseConnection | undefined,
      tools: ToolSet | undefined

  if (mcpSseUrl) {
    mcp = new McpSseConnection(mcpSseUrl)
    tools = await mcp.getToolSet()
  }

  const params = {
    messages,
    tools,
    model: aiSdkModel,
    maxSteps: 10,
  }

  if (stream) {
    const { fullStream } = streamText(params)
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    const stream = openAICompatibleResponseStream(fullStream, agentConfig.model)
    for await (const chunk of stream) {
      res.write(chunk)
    }
  }
  else {
    const { text, usage, finishReason } = await generateText(params)

    res.json({
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: agentConfig.model,
      usage: {
        completion_tokens: usage.completionTokens,
        prompt_tokens: usage.promptTokens,
        total_tokens: usage.totalTokens,
        usage
      },
      choices: [{
        index: 0,
        finish_reason: finishReason,
        message: {
          role: 'assistant',
          content: text
        },
      }],
    })
  }
  await mcp?.close()
  res.end()
}
