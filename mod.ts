import { parseArgs } from "jsr:@std/cli/parse-args"
import { handleRequest } from "./proxy/mod.ts";

const flags = parseArgs(Deno.args, {
  string: ['hostname', 'port'],
  default: { hostname: '0.0.0.0', port: '8000' },
})

const serveOptions = {
  hostname: flags.hostname,
  port: Number(flags.port),
}

console.log(`Server running on http://${flags.hostname}:${flags.port}`)

await Deno.serve(serveOptions, handleRequest);