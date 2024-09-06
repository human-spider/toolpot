import { StreamResponse } from "https://deno.land/x/stream_response@v0.1.0-pre.4/index.ts";
import { z } from "https://deno.land/x/zod/mod.ts";

import { openai } from 'npm:@ai-sdk/openai'
import { anthropic } from 'npm:@ai-sdk/anthropic'
import { streamText, generateText, type CoreMessage, type JSONValue } from 'npm:ai'
import { tool } from "npm:ai";

import { googleResults } from "../lib/google.ts"

const API_KEYS = Deno.env.get('API_KEYS')?.split(',') ?? []

const PROVIDERS = { openai, anthropic }

const dataChunk = (chunk: JSONValue) => `data: ${JSON.stringify(chunk)}\n\n`
const eventChunk = (event: string, chunk: JSONValue) => `event: ${event}\ndata: ${JSON.stringify(chunk)}\n\n`


async function* openAICompatibleResponseStream(stream: AsyncIterable<unknown>, model: string): AsyncGenerator<string> {
  yield dataChunk({
    object: 'chat.completion.chunk',
    created: Date.now(),
    model,
    choices: [{
      index: 0,
      finish_reason: null,
      content: "",
    }]
  })
  for await (const chunk of stream) {
    if (chunk.type === 'text-delta') {
      yield dataChunk({
        object: 'chat.completion.chunk',
        choices: [{
          index: 0,
          delta: { content: chunk.textDelta },
        }]
      })
    }
    if (chunk.type === 'tool-call') {
      yield eventChunk('tool-call', {
        id: chunk.toolCallId,
        type: 'function',
        function: {
          name: chunk.toolName,
          arguments: JSON.stringify(chunk.args)
        }
      })
    }
    if (chunk.type === 'tool-result') {
      yield eventChunk('tool-result', {
        tool_call_id: chunk.toolCallId,
        content: JSON.stringify(chunk.result)
      })
    }
    if (chunk.type === 'finish') {
      const { finishReason, usage } = chunk
      yield dataChunk({
        object: 'chat.completion.chunk',
        usage: {
          completion_tokens: usage.completionTokens,
          prompt_tokens: usage.promptTokens,
          total_tokens: usage.totalTokens,
        },
        choices: [{
          index: 0,
          finish_reason: finishReason,
        }]
      })
    }
  }
  yield 'data: [DONE]'
}

export const handleRequest = async (request: Request): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const apiKey = request.headers.get('x-api-key') || request.headers.get('api-key')
  if (!apiKey) {
    return new Response(JSON.stringify({
      error: 'Missing x-api-key header',
    }), { status: 400 })
  }
  if (!API_KEYS.includes(apiKey)) {
    return new Response(JSON.stringify({
      error: 'Invalid API key',
    }), { status: 403 })
  }

  if (request.headers.get("Content-Type") !== "application/json") {
    return new Response("Unsupported Media Type", { status: 415 });
  }

  const { messages, stream, model } = await request.json() as { messages: CoreMessage[], model: string, stream: boolean };

  // console.log(messages, rest)

  if (!messages || !Array.isArray(messages)) {
    return new Response("Invalid request body", { status: 400 });
  }

  let [ provider, modelName ] = model?.length ? model.split(':') : ['openai', 'gpt-4o-mini']
  if (provider && !modelName) {
    modelName = provider
    provider = 'openai'
  }

  if (provider !== 'openai' && provider !== 'anthropic') {
    return new Response("Invalid request body", { status: 400 });
  }

  if (!provider || !modelName || !PROVIDERS[provider]) {
    return new Response("Invalid request body", { status: 400 });
  }

  const params = {
    messages,
    model: PROVIDERS[provider](modelName),
    tools: {
      google: tool({
        description: "Takes in a query string and returns search results from Google in the form of links and optional summary..\nUse it to answer user questions that require dates, facts, real-time information, or news.\nLinks in the search results can be opened using the get_web_page function. Select 1-3 links from the\nsearch results to get detailed information about the topic, do not rely only on link previews.\n",
        parameters: z.object({
          query: z.string().describe('The query string to search for.')
        }),
        execute: ({ query }) => googleResults(query),
      })
    },
    maxToolRoundtrips: 5,
  }

  if (stream) {
    const { fullStream, response } = await streamText({ 
      ...params,
      onFinish: async (chunk) => {
        console.log(chunk)
        console.log(await response)
      }
    })
    // for await (const chunk of fullStream) {
    //   console.log(chunk)
    // }
    return new StreamResponse(
      openAICompatibleResponseStream(fullStream, modelName),
      {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      }
    )
  }
  else {
    const { text, usage, finishReason } = await generateText(params)
    return new Response(JSON.stringify({
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelName,
      usage: {
        completion_tokens: usage.completionTokens,
        prompt_tokens: usage.promptTokens,
        total_tokens: usage.totalTokens,
      },
      choices: [{
        index: 0,
        finish_reason: finishReason,
        message: {
          role: 'assistant',
          content: text
        },
      }],
    }), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  }
}