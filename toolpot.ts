import type { CoreMessage, GenerateTextResult, LanguageModelV1, StreamTextResult, ToolSet } from "ai"
import { streamText, generateText } from 'ai'
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai'
import { createAnthropic, type AnthropicProvider } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google'

import { McpConnection, type ToolpotMcpServerConfig } from "./mcp.ts"

export type ToolpotSupportedProvider = 'google' | 'openai' | 'anthropic'

export type ToolpotProviderConfig = {
  provider: ToolpotSupportedProvider
  apiKey?: string
  apiBase?: string
}

export type ToolpotAgentConfig = {
  provider: string,
  model: string,
  mcpServers?: string[]
  tools?: ToolSet
  modelArgs?: Record<string, unknown>
  label?: string
}

export type ToolpotConfig = {
  providers: Record<string, ToolpotProviderConfig>
  agents: Record<string, ToolpotAgentConfig>
  mcpServers?: Record<string, ToolpotMcpServerConfig>
}

export type TextGenerationParams = {
  messages: CoreMessage[]
  model: LanguageModelV1
  tools?: ToolSet
  maxSteps?: number
}

export type TextGenerationInit = Partial<TextGenerationParams> & Required<Pick<TextGenerationParams, 'messages'>>

const providerFactories = { openai: createOpenAI, anthropic: createAnthropic, google: createGoogleGenerativeAI }

export class Toolpot {
  private mcpConnections: Record<string, McpConnection> = {}

  constructor(private config: ToolpotConfig) {
    if (this.config.mcpServers) {
      for (const [name, config] of Object.entries(this.config.mcpServers)) {
        this.mcpConnections[name] = new McpConnection(config)
      }
    }
  }

  get agents(): Record<string, ToolpotAgentConfig> {
    return this.config.agents
  }

  get mcpServers(): Record<string, ToolpotMcpServerConfig> | undefined {
    return this.config.mcpServers
  }

  get providers(): Record<string, ToolpotProviderConfig> {
    return this.config.providers
  }

  get defaultGenerationParams(): Partial<TextGenerationParams> {
    return {
      maxSteps: 10
    }
  }

  getProvider(providerId: string): AnthropicProvider | OpenAIProvider | GoogleGenerativeAIProvider {
    const providerConfig = this.providers[providerId]
    if (!providerConfig) {
      throw new Error(`Provider '${providerId}' not found`)
    }
    const providerFactory = providerFactories[providerConfig.provider as ToolpotSupportedProvider]
    if (!providerFactory) {
      throw new Error(`Provider factory for '${providerConfig.provider}' not found`)
    }
    return providerFactory({
      apiKey: providerConfig.apiKey,
      baseURL: providerConfig.apiBase
    })
  }

  getModel(providerId: string, modelId: string, modelArgs?: Record<string, unknown>): LanguageModelV1 {
    const provider = this.getProvider(providerId)
    return provider.languageModel(modelId, modelArgs)
  }

  getAgent(agentId: string): ToolpotAgentConfig {
    const agent = this.agents[agentId]
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`)
    }
    return agent
  }

  getMcpConnection(mcpServerId: string): McpConnection {
    const mcpConnection = this.mcpConnections[mcpServerId]
    if (!mcpConnection) {
      throw new Error(`MCP connection '${mcpServerId}' not found`)
    }
    return mcpConnection
  }

  async getAgentToolSet(agentId: string): Promise<ToolSet> {
    const agent = this.getAgent(agentId)
    const toolSet: ToolSet = agent.tools || {}
    if (agent.mcpServers?.length) {
      for (const mcpServerId of agent.mcpServers) {
        const mcpToolSet = await this.getMcpConnection(mcpServerId).getToolSet()
        Object.assign(toolSet, mcpToolSet)
      }
    }
    return toolSet
  }

  async generateText(agentId: string, params: TextGenerationInit): Promise<GenerateTextResult<ToolSet, never>> {
    return generateText(await this.buildTextGenerationParams(agentId, params))
  }

  async streamText(agentId: string, params: TextGenerationInit): Promise<StreamTextResult<ToolSet, never>> {
    return streamText(await this.buildTextGenerationParams(agentId, params))
  }

  private async buildTextGenerationParams(agentId: string, params: TextGenerationInit): Promise<TextGenerationParams> {
    const agent = this.getAgent(agentId)
    const tools = await this.getAgentToolSet(agentId)
    const model = this.getModel(agent.provider, agent.model, agent.modelArgs)
    return {
      ...this.defaultGenerationParams,
      ...params,
      model,
      tools,
    }
  }
}
