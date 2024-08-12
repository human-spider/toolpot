import * as path from "https://deno.land/std@0.138.0/path/mod.ts";
import { doc } from "https://deno.land/x/deno_doc@0.125.0/mod.ts";
import type { DocNode } from "https://deno.land/x/deno_doc@0.125.0/types.d.ts";
import { snakeCase } from "https://deno.land/x/case/mod.ts";

const ANNOUNCEMENT_PARTS = [
  '<span class="tool_announcement">',
  '</span><span class="tool_announcement_end"></span>',
]
const ANNOUNCEMENT_REGEX = new RegExp(`${ANNOUNCEMENT_PARTS[0]}(.*?)${ANNOUNCEMENT_PARTS[1]}`, 'gs');

const toolFiles = [
  './web.ts',
  './codesandbox.ts',
  './execute-code.ts'
]

const getJSDoc = file => doc(`file://${Deno.cwd()}/${dir}/${file}`)

function getModuleDir(importMeta: ImportMeta): string {
  return path.resolve(path.dirname(path.fromFileUrl(importMeta.url)));
}

const dir = getModuleDir(import.meta);

export const formatAnnouncement = description =>
  `\n\n${ANNOUNCEMENT_PARTS[0]}${description}${ANNOUNCEMENT_PARTS[1]}\n\n`

export const removeAnnouncementsFromMessages = messages =>
  messages.map(msg => {
    if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'text') {
            block.text = block.text.replace(ANNOUNCEMENT_REGEX, '')
          }
        }
      } else if (msg.content.replace) {
        msg.content = msg.content.replace(ANNOUNCEMENT_REGEX, '')
      }
    }
    return msg
  })

export async function getTools(shape = 'openai') {
  const [ tools, toolSchema ] = await Promise.all([
    getFunctions(),
    getSchema(shape)
  ])
  if (shape === 'openai') {
    for (const schema of toolSchema) {
      const tool = tools[schema.function.name]
      if (tool) {
        schema.function.function = (args) => tool(...args)
        schema.function.parse = (args) => {
          const input = JSON.parse(args || '{}')
          return tool.parameters.map(
            key => input[key]
          )
        }
        const announce = tool.announce
        if (announce && announce.call) {
          tool.announceParsed = args => announce(...schema.function.parse(args))
        }
      }
    }
  }
  return {
    tools,
    toolSchema,
  }
}

async function getFunctions() {
  const functions = {}
  for (const file of toolFiles) {
    const funcs = await import(file)
    for (const [name, func] of Object.entries(funcs)) {
      func.parameters = getParameterNames(func)
      functions[snakeCase(name)] = func
    }
  }
  return functions
}

async function getSchema(shape = 'openai') {
  return (await Promise.all(toolFiles.map(file => parseJSDoc(file, shape)))).flat()
}

function getParameterNames(func) {
  const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
  const ARGUMENT_NAMES = /([^\s,]+)/g;
  const fnStr = func.toString().replace(STRIP_COMMENTS, '');
  let result = fnStr.slice(fnStr.indexOf('(')+1, fnStr.indexOf(')')).match(ARGUMENT_NAMES);
  if(result === null)
     result = [];
  return result;
}

async function parseJSDoc(filePath: string, shape = 'openai') {
  try {
    const docNodes = await getJSDoc(filePath);

    const definitions = [];
    
    for (const node of docNodes) {
      if (node.kind.includes(['function'])) {
        definitions.push(getFunctionSchema(node, shape))
      }
    }
    return definitions;
  } catch (error) {
    console.error(`Error parsing file ${filePath}:`, error);
  }
}

function getFunctionSchema(node: DocNode, shape = 'openai') {
  if (shape === 'openai') {
    return {
      type: 'function',
      function: {
        name: snakeCase(node.name),
        description: node.jsDoc?.doc,
        parameters: getJsonSchema(node),  
      }
    }
  }
  if (shape === 'anthropic') {
    return {
      name: snakeCase(node.name),
      description: node.jsDoc?.doc,
      input_schema: getJsonSchema(node),
    }
  }
}

function getJsonSchema(node: DocNode) {
  return {
    type: 'object',
    properties: node.jsDoc?.tags?.filter(
      (tag) => tag.kind === "param"
    ).reduce((acc, { name, type, doc }) => ({
      ...acc,
      [name]: {
        type,
        description: doc,
      },
    }), {}),
    required: node.jsDoc?.tags?.filter(
      (tag) => tag.kind === "param" && !tag.optional && tag.name
    ).map(({ name }) => name),
  }
}