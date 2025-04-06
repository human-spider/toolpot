import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { jsonSchema, type Tool, type ToolSet } from "ai"
import type { Transport, StdioServerParameters } from "@modelcontextprotocol/sdk"

type ToolManifest = {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export type ToolpotMcpServerConfig = {
  type: 'sse'
  url: string
} | {
  type: 'stdio'
  params: StdioServerParameters
}

export class McpConnection {
  private transport: Transport
  private client: Client
  private connected = false
  private toolSet?: ToolSet

  constructor(private config: ToolpotMcpServerConfig) {
    if (this.config.type === 'sse') {
      this.transport = new SSEClientTransport(new URL(this.config.url))
    } else if (this.config.type === 'stdio') {
      this.transport = new StdioClientTransport(this.config.params)
    } else {
      throw new Error('Unsupported transport type')
    }
    this.client = new Client({
      name: 'Toolpot',
      version: '0.1.0',
    }, {
      capabilities: {
        tools: {},
        prompts: {}
      }
    })
  }

  async connect() {
    await this.client.connect(this.transport)
    this.connected = true
  }

  async getToolSet(): Promise<ToolSet> {
    if (!this.connected) {
      await this.connect()
    }
    if (this.toolSet) {
      return this.toolSet
    }

    const { tools } = await this.client.listTools()

    this.toolSet = tools?.reduce((acc: ToolSet, { name, description, inputSchema }: ToolManifest): ToolSet => {
      acc[name] = {
        name,
        description,
        parameters: jsonSchema(inputSchema),
        execute: input => this.client.callTool({
          name,
          arguments: input,
        }),
      } as Tool
      return acc
    }, {})

    return this.toolSet || {}
  }

  async close() {
    if (this.connected) {
      await this.client.close()
    }
  }
}
