import { SerperClient } from "./serper.ts";

export async function googleResults(q: string, num: number = 10) {
  const serper = new SerperClient();
  const results = await serper.search({ q, num });

  let content = results.organic.map(
    r => (`* ${r.title}\n${r.snippet}\n${r.link} `)
  ).join('\n\n');

  if (results.knowledgeGraph) {
    const { title, description } = results.knowledgeGraph;

    content = `**${title}**

      ${description}

      ${content}
      `; 
  }

  return content;
}