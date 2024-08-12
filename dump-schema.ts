import { getSchema } from "./tools/mod.ts";

const schema = await getSchema(Deno.args[0]);
console.log(JSON.stringify(schema, null, 2));