import OpenAI from 'https://deno.land/x/openai@v4.52.3/mod.ts';

import { APIProxy, dataChunk } from "./mod.ts";
import { getTools, formatAnnouncement, removeAnnouncementsFromMessages } from "../tools/mod.ts";

const { tools, toolSchema } = await getTools('openai');

export default class OpenAIProxy extends APIProxy {
  openai: OpenAI;

  constructor(options) {
    super(options)
    this.openai = new OpenAI({ apiKey: this.apiKey })
  }

  getClient() {
    if (!this.openai.apiKey && this.apiKey) {
      this.openai.apiKey = this.apiKey
    }
    return this.openai
  }

  getCompletionStream(apiRequest) {
    return apiCallStream(this.getClient(), { ...apiRequest, ...this.customRequestOptions })
  }

  getCompletion(apiRequest) {
    return this.getClient().chat.completions.create({ ...apiRequest, ...this.customRequestOptions })
  }
}

async function* apiCallStream(openai, apiRequest) {
  const runner = openai.beta.chat.completions.runTools({
    ...apiRequest,
    tools: toolSchema,
    messages: removeAnnouncementsFromMessages(apiRequest.messages),
  });
  const stream = await runner;
  stream.on('error', console.error)
  for await (const chunk of stream) {
    if (chunk.choices[0]?.finish_reason !== 'tool_calls') {
      yield dataChunk(chunk);
    } else {
      try {
        const toolCall = await runner.finalFunctionCall()
        yield* announceToolUse(toolCall, chunk)
      } catch (e) {
        console.error(e)
      }
    }
  }
}

async function* announceToolUse(toolCall, chunk) {
  const tool = tools[toolCall.name]
  const description = tool.announceParsed?.(toolCall.arguments) || '...'
  yield dataChunk({
    ...chunk,
    choices: [{
      index: 0,
      finish_reason: null,
      logprobs: null,
      delta: {
        content: formatAnnouncement(description)
      }
    }]
  })
}