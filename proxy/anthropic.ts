import Anthropic from 'npm:@anthropic-ai/sdk';

import { APIProxy, dataChunk } from "./mod.ts";
import { getTools, formatAnnouncement, removeAnnouncementsFromMessages } from "../tools/mod.ts";

const { tools, toolSchema } = await getTools('anthropic')

export default class AnthropicProxy extends APIProxy {
  anthropic: Anthropic;

  constructor(options) {
    super(options)
    this.anthropic = new Anthropic({ apiKey: this.apiKey })
  }

  getClient() {
    if (!this.anthropic.apiKey && this.apiKey) {
      this.anthropic.apiKey = this.apiKey
    }
    return this.anthropic
  }

  getCompletionStream(apiRequest) {
    return apiCallStream(this.getClient(), { ...apiRequest, ...this.customRequestOptions })
  }

  getCompletion(apiRequest) {
    return this.getClient().messages.create({ ...apiRequest, ...this.customRequestOptions })
  }
}

async function* apiCallStream(anthropic, apiRequest) {
  console.log({
    ...apiRequest,
    tools: toolSchema,
    messages: removeAnnouncementsFromMessages(apiRequest.messages),
  })
  const stream = await anthropic.messages.stream({
    ...apiRequest,
    tools: toolSchema,
    messages: removeAnnouncementsFromMessages(apiRequest.messages),
  });
  let blocks = [];
  stream.on('contentBlock', block => {
    blocks.push(block);
  })
  stream.on('error', console.error)
  for await (const chunk of stream) {
    if (chunk.type === 'message_stop' && isToolUseRequested(blocks)) {
      yield* useTool(anthropic, apiRequest, blocks);
    } else {
      yield dataChunk(chunk);
    }
  }
}

const isToolUseRequested = (blocks) =>
  blocks.length > 0 && blocks[blocks.length - 1].type === 'tool_use';

const toolResultApiRequest = (apiRequest, blocks, toolUseId, toolResult) => ({
  ...apiRequest,
  messages: [
    ...apiRequest.messages,
    {
      role: 'assistant',
      content: blocks
    },
    {
      role: 'user',
      content: [{
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: toolResult,
      }],
    },
  ],
});

async function* announceToolUse(description, index) {
  yield dataChunk({
    type: 'content_block_start',
    index,
    content_block: {
      type: 'text',
      text: ''
    }
  })
  yield dataChunk({
    type: 'content_block_delta',
    index,
    delta: {
      type: 'text_delta',
      text: formatAnnouncement(description)
    }
  })
  yield dataChunk({
    type: 'content_block_stop',
    index,
  })
}

async function* useTool(anthropic, apiRequest, blocks) {
  const toolBlock = blocks[blocks.length - 1]
  const tool = tools[toolBlock.name]
  if (tool) {
    console.log('Tool call', tool);
    const args = tool.parameters.map(
      key => toolBlock.input[key]
    )
    if (tool.announce) {
      yield* announceToolUse(tool.announce?.(...args), blocks.length)
    }
    const toolResult = await tool(...args)
    if (tool.present) {
      yield* announceToolUse(tool.present?.(toolResult, ...args), blocks.length + 1)
    }
    yield* apiCallStream(
      anthropic,
      toolResultApiRequest(apiRequest, blocks, toolBlock.id, toolResult)
    )
  }
}