import { parseArgs } from "jsr:@std/cli/parse-args"
import { ToolCallingProxy } from "./proxy/mod.ts"
import OpenAIProxy from './proxy/openai.ts'
import AnthropicProxy from './proxy/anthropic.ts'

function attachHandlers(handlers: { [path: string]: ToolCallingProxy }) {
  return (request: Request) => {
    const parsedUrl = new URL(request.url)
    const handler = handlers[parsedUrl.pathname]
    if (handler) {
      return handler.handleRequest(request)
    }
    return new Response(JSON.stringify({
      error: `No handler for path: ${request.url}`,
    }), { status: 400 })
  }
}

const flags = parseArgs(Deno.args, {
  string: ['hostname', 'port', 'cert', 'key'],
  default: { hostname: '0.0.0.0', port: '8000', https: false },
})

const serveOptions = {
  hostname: flags.hostname,
  port: Number(flags.port),
}

if (flags.cert && flags.key) {
  serveOptions.cert = flags.cert
  serveOptions.key = flags.key
}

const protocol = serveOptions.cert ? 'https' : 'http'

console.log(`Server running on ${protocol}://${flags.hostname}:${flags.port}`)

await Deno.serve(serveOptions, attachHandlers({
  '/v1/chat/completions': new ToolCallingProxy(new OpenAIProxy()),
  '/v1/messages': new ToolCallingProxy(new AnthropicProxy()),
}));