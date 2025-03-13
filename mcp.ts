import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js"
import { jsonSchema, type Tool, type ToolSet } from "ai"

type ToolManifest = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export class McpSseConnection {
  private transport: SSEClientTransport
  private client: Client
  private connected = false

  constructor(private sseUrl: string) {
    this.transport = new SSEClientTransport(new URL(this.sseUrl))
    this.client = new Client({
      name: 'Toolpot',
      version: '0.1.0',
    }, {
      capabilities: {
        tools: {}
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
    const { tools } = await this.client.listTools()

    return tools.reduce((acc: ToolSet, { name, description, inputSchema }: ToolManifest): ToolSet => ({
      ...acc,
      [name]: {
        name,
        description,
        parameters: jsonSchema(inputSchema),
        execute: input => this.client.callTool({
          name,
          arguments: input,
        }),
      } as Tool,
    }), {})
  }

  async close() {
    if (this.connected) {
      await this.client.close()
    }
  }
}
