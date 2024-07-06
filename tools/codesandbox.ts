/**
 * Runs JavaScript code for data analysis and visualization
 * by creating a CodeSandbox environment and returning an 
 * embedded HTML iframe to display the results to the user.
 * Use this function only when the user asks to perform calculations, process data structures
 * such as json, csv, or arrays, or visualize data using libraries like chart.js, requesting
 * a specific result beyond generating JS code.
 * Prefer easy solutions requiring least amount of code.  If asked to fetch and process or visualize
 * data from a URL, use the fetch function inside JS code to retrieve the data.
 * Do not forget to import dependencies from NPM in the jsCode as if it was a standalone file.
 * 
 * @async
 * @param {string} jsCode The JavaScript code to run to perform analysis.
 * @param {string} htmlCode The HTML code to be used to output results to the user.
 * @param {object} dependencies An object containing the NPM dependencies required for the JS code like in package.json dependencies object. Example: { "d3": "^7.8.5" }
 * @returns {Promise<string>} A promise that resolves to an HTML string containing an iframe for the CodeSandbox environment.
 */
export async function runJsCodeInSandbox(jsCode, htmlCode, dependencies) {
  try {
    return getEmbedHtml(await createCodeSandbox({
      'index.js': { content: jsCode },
      'index.html': { content: htmlCode },
      'package.json': { content: { dependencies } },
    }))
  } catch (error) {
    console.error(`Error running JavaScript code for data analysis`, error)
    return `Error running JavaScript code for data analysis: ${error.message}`
  }
}
runJsCodeInSandbox.announce = () => `<blockquote>Creating Javascript code sandbox...</blockquote>`
runJsCodeInSandbox.present = result => result

const createCodeSandbox = async files => {
  const response = await fetch("https://codesandbox.io/api/v1/sandboxes/define?json=1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ files })
  })
  const sandbox = await response.json()
  if (sandbox.error) {
    throw sandbox.error
  }
  return sandbox.sandbox_id
}

const getEmbedHtml = async sandboxId => `
<iframe src="https://codesandbox.io/embed/${sandboxId}?fontsize=14&hidenavigation=1&theme=dark&view=preview&runonclick=1&hidedevtools=1&codemirror=1"
  style="width:100%; height: 500px; resize: both; border:0; border-radius: 4px; overflow:hidden;"
  allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
  sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
></iframe>
<strong><a href="https://codesandbox.io/s/${sandboxId}" target="_blank">View results in CodeSandbox</a></strong>
`