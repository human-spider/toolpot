import { colorize } from 'https://deno.land/x/json_colorize/mod.ts';
import { getTools } from './tools/mod.ts';

const shape = Deno.args[0]

const { tools, toolSchema } = await getTools(shape);

console.log(colorize(JSON.stringify({ tools, toolSchema }, null, 2)))