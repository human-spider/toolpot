import { StreamResponse } from "https://deno.land/x/stream_response@v0.1.0-pre.4/index.ts";

export abstract class APIProxy {
  apiKey?: string;
  model?: string;

  constructor(options: { apiKey?: string, model?: string }) {
    this.apiKey = options.apiKey
    this.model = options.model
  }

  abstract getClient()

  abstract getCompletionStream(apiRequest)

  abstract getCompletion(apiRequest)

  get customRequestOptions() {
    const options = {}
    if (this.model) {
      options.model = this.model
    }
    return options
  }
}

export class ToolCallingProxy {
  proxy: APIProxy

  constructor(proxy: APIProxy) {
    this.proxy = proxy
  }

  async handleRequest(request: Request): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
  
    if (request.headers.get("Content-Type") !== "application/json") {
      return new Response("Unsupported Media Type", { status: 415 });
    }
  
    const apiKey = request.headers.get('x-api-key');
    if (apiKey) {
      this.proxy.apiKey = apiKey;
    }
    const body = await request.json();
  
    if (!body.messages || !Array.isArray(body.messages)) {
      return new Response("Invalid request body", { status: 400 });
    }
  
    if (body.stream) {
      return new StreamResponse(this.proxy.getCompletionStream(body), {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      })
    }
    else {
      const message = await this.proxy.getCompletion(body);
      return new Response(JSON.stringify(message), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
  }
}

export const dataChunk = chunk => `data: ${JSON.stringify(chunk)}\n\n`;