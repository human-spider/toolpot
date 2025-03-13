import express from 'express'
import type { Request, Response } from 'express'

import cors from 'cors'
import { handleRequest } from "./proxy.ts";

export type ToolpotSupportedProvider = 'google' | 'openai' | 'anthropic'

export type ToolpotProviderConfig = {
  provider: ToolpotSupportedProvider
  apiKey: string
}

export type ToolpotMcpServerConfig = {
  sseUrl: string
}

export type ToolpotAgentConfig = {
  provider: string,
  model: string,
  mcpSse?: string
  modelArgs?: Record<string, unknown>
}

export type ToolpotConfig = {
  apiKeys?: string[]
  hostname?: string
  port?: number
  providers: Record<string, ToolpotProviderConfig>
  mcpServers: Record<string, ToolpotMcpServerConfig>
  agents: Record<string, ToolpotAgentConfig>
}

export const toolpot = (config: ToolpotConfig): void => {
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

  app.get('/', (_: Request, res: Response) => {
    res.send('OK')
  })

  app.post('/v1/chat/completions', async (req: Request, res: Response) => {
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

    try {
      await handleRequest(req, res, config)
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
