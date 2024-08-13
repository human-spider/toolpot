import { marked } from 'https://deno.land/x/marked/mod.ts';

import OneCompilerAPI from "../lib/onecompiler.ts";

/**
 * Executes code in several languages using the OneCompiler API and returns the result that code outputs to stdout.
 * Use this function to perform precise calculations and transform data to use in your answers.
 * Use this function when user asks to calculate something, process data or text, and for any tasks
 * that require precise result, e.g. calculating amount of words in a sentence, or amount of days to the new year.
 * 
 * @param {array} files An array of file objects containing the name and content of each file to be executed. Each file is an object that must have `name` and `content` fields.
 * @param {string} language The programming language of the code to be executed. Must be one of 'javascript', 'nodejs', 'python', 'ruby', 'r'
 * @param {string} [stdin] Optional input to be passed to the program during execution as stdin
 * @returns {Promise<string>} A promise that resolves to the execution response object or an error message string.
 */
export async function executeCode(files: Array<{ name: string; content: string }>, language: string, stdin?: string) {
  const compiler = new OneCompilerAPI()
  try {
    const response = await compiler.executeCode({ language, files, stdin })
    if (response.stderr) {
      throw response.stderr
    }
    return response.stdout
  } catch (e) {
    console.error(e)
    return `Error executing code: ${e}`
  }
}
executeCode.announce = (files, language) => `Executing ${language} code...
  ${files.map(file => `<pre><code class="language-${language}">${file.content}</code></pre>`).join('\n')}
`
executeCode.present = (result, _, language) => `Output:
  <pre><code class="language-${language}">${result}</code></pre>
`