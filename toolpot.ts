import type { LanguageModelV1, ToolSet } from "ai"
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

export type AiSdkAgentParams = {
  model: LanguageModelV1
  tools?: ToolSet
}

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

  async getAgentParams(agentId: string): Promise<AiSdkAgentParams> {
    const agent = this.getAgentConfig(agentId)
    const tools = await this.getAgentToolSet(agentId)
    const model = this.getModel(agent.provider, agent.model, agent.modelArgs)
    return {
      model,
      tools,
    }
  }

  private getProvider(providerId: string): AnthropicProvider | OpenAIProvider | GoogleGenerativeAIProvider {
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

  private getModel(providerId: string, modelId: string, modelArgs?: Record<string, unknown>): LanguageModelV1 {
    const provider = this.getProvider(providerId)
    return provider.languageModel(modelId, modelArgs)
  }

  private getAgentConfig(agentId: string): ToolpotAgentConfig {
    const agent = this.agents[agentId]
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`)
    }
    return agent
  }

  private getMcpConnection(mcpServerId: string): McpConnection {
    const mcpConnection = this.mcpConnections[mcpServerId]
    if (!mcpConnection) {
      throw new Error(`MCP connection '${mcpServerId}' not found`)
    }
    return mcpConnection
  }

  private async getAgentToolSet(agentId: string): Promise<ToolSet> {
    const agent = this.getAgentConfig(agentId)
    const toolSet: ToolSet = agent.tools || {}
    if (agent.mcpServers?.length) {
      for (const mcpServerId of agent.mcpServers) {
        const mcpToolSet = await this.getMcpConnection(mcpServerId).getToolSet()
        Object.assign(toolSet, mcpToolSet)
      }
    }
    return toolSet
  }
}
