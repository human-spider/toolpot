import type { Request, Response } from 'express'
import express from 'express'
import cors from 'cors'
import type { CoreMessage } from "ai"

import { Toolpot, type ToolpotConfig } from "./toolpot.ts"
import { openAICompatibleResponseStream } from "./stream.ts";

export type ToolpotServerConfig = {
  config: ToolpotConfig
  apiKeys?: string[]
  hostname?: string
  port?: number
}

const authMiddlware = (apiKeys: string[]) => (req: Request, res: Response, next: VoidFunction) => {
  const authorization = req.get('authorization')
  const apiKey =
    authorization?.split('Bearer ')[1] ||
    req.headers['x-api-key'] ||
    req.headers['api-key']

  if (!apiKey) {
    return res.status(400).send('Missing api-key, x-api-key, or authorization header')
  }

  if (!apiKeys.includes(apiKey)) {
    return res.status(403).send('Invalid API key')
  }

  next()
}

const handleRequest = async (req: Request, res: Response, toolpot: Toolpot): Promise<void> => {
  const { messages, stream, model } = req.body as { messages: CoreMessage[], model: string, stream: boolean };

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  if (stream) {
    const { fullStream } = await toolpot.streamText(model, { messages })
    res.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })
    const stream = openAICompatibleResponseStream(fullStream, model)
    for await (const chunk of stream) {
      res.write(chunk)
    }
  } else {
    const { text, usage, finishReason } = await toolpot.generateText(model, { messages })

    res.json({
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
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
  res.end()
}

export const serveToolpot = (config: ToolpotServerConfig): void => {
  const toolpot = new Toolpot(config.config)

  const app = express()
  app.use(cors())

  app.use(express.json())

  let generatedApiKey: string

  const apiKeys: string[] = []

  if (config.apiKeys?.length) {
    apiKeys.push(...config.apiKeys)
  } else {
    generatedApiKey = crypto.randomUUID()
    apiKeys.push(generatedApiKey)
  }

  app.use('/v1/*', authMiddlware(apiKeys))

  app.get('/', (_: Request, res: Response) => {
    res.send('OK')
  })

  app.get('/v1/models', (_: Request, res: Response) => {
    res.json({
      data: Object.keys(toolpot.agents).map(id => ({ id, object: 'model', label: toolpot.agents[id].label })),
      object: 'list',
    })
  })

  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
    try {
      await handleRequest(req, res, toolpot)
    } catch (error) {
      console.error('Error handling request:', error)
      res.status(500).send('Internal Server Error')
    }
  })

  const hostname = config.hostname || '0.0.0.0'
  const port = Number(config.port || 8000)

  app.listen(port, hostname, () => {
    console.log(`Completions endpoint: https://${hostname}:${port}/v1/chat/completions`)
    if (generatedApiKey) {
      console.log(`API key: ${generatedApiKey}`)
    }
  })
}
