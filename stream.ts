import type { JSONValue, TextStreamPart, Tool } from "ai"

const dataChunk = (chunk: JSONValue) => `data: ${JSON.stringify(chunk)}\n\n`
const eventChunk = (event: string, chunk: JSONValue) => `event: ${event}\ndata: ${JSON.stringify(chunk)}\n\n`

export async function* openAICompatibleResponseStream<TOOLS extends Record<string, Tool>>(stream: AsyncIterable<TextStreamPart<TOOLS>>, model: string): AsyncGenerator<string> {
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
    if (chunk.type === 'error') {
      throw new Error(chunk.error?.toString() || 'Unknown error')
    }
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
