import { tool, type Tool } from 'ai'
import { z } from '@nhttp/zod'
import { SerperClient } from "./client.ts"

export type SerperTools = {
  serper_google_search: Tool,
  serper_fetch_web_page: Tool,
}

export const serper = (config: {apiKey: string}): SerperTools => {
  const serperClient = new SerperClient(config.apiKey)
  return {
    serper_google_search: tool({
      description: `
        Takes in a query string and returns search results from Google in the form of links and optional summary.
        Use this function to answer user questions that require access to recent up-to-date information, and cannot
        be adequately answered otherwise (e.g. current prices and events)
        or when user explicitly asks for it. Use this function when user mentions currnet or recent data,
        or when user asks for news, or when user asks for information that is not available in the current context.
        Always use google search to answer questions about prices, market data, weather, laws, regulations, and news.
        Never use this function when user asks for data that is persistent and unlikely to change,
        like distances between cities, and laws of physics, unless user explicitly asks for this.
        Links in the search results can be opened using the getWebPageContent function. Select 2-5 links from the
        search results to get detailed information about the topic, do not rely only on link previews.`,
      parameters: z.object({
        q: z.string().describe('The query string to search for.'),
        num: z.number().describe('The number of results to return.'),
        page: z.number().describe('The page number to return.').optional(),
      }),
      execute: ({ q, num, page }) => {
        return serperClient.search({
          q,
          num,
          page
        })
      },
    }),
    serper_fetch_web_page: tool({
      description: `
        Fetches content from a specified webpage URL and converts it to Markdown format to provide context information for assistant's answers.
        Use this function to get detailed information from links in the google search results, fetch up to date
        information from websites, get more detailed information
        after performing google search to cross check data from previews and provide a more detailed quality answer.
      `,
      parameters: z.object({
        url: z.string().describe('The URL to fetch data from.')
      }),
      execute: ({ url }) => {
        return serperClient.scrape(url)
      },
    })
  }
}
