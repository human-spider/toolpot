import { parseArgs } from "jsr:@std/cli/parse-args"
import { handleRequest } from "./proxy/mod.ts";

const flags = parseArgs(Deno.args, {
  string: ['hostname', 'port', 'model'],
  default: { hostname: '0.0.0.0', port: '8000' },
})

const serveOptions = {
  hostname: flags.hostname,
  port: Number(flags.port),
}

const customModels: Partial<Record<'openai' | 'anthropic', unknown>> = {}

if (flags.model) {
  const modelTuple = flags.model.split(':')
  if (modelTuple.length !== 2) {
    console.error('Invalid model format. Expected: <provider>:<model>')
    Deno.exit(1)
  }
  try {
    Object.assign(customModels, Object.fromEntries([modelTuple]))
  } catch (e) {
    console.error('Error parsing custom model:', flags.model)
    Deno.exit(1)
  }
}

console.log(`Server running on http://${flags.hostname}:${flags.port}`)

await Deno.serve(serveOptions, handleRequest);