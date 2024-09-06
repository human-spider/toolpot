import { googleResults } from "../lib/google.ts"
import { scrapeWebsite } from "../lib/scrape.ts"

/**
 * Takes in a query string and returns search results from Google in the form of links and optional summary..
 * Use it to answer user questions that require dates, facts, real-time information, or news.
 * Links in the search results can be opened using the get_web_page function. Select 1-3 links from the
 * search results to get detailed information about the topic, do not rely only on link previews.
 * 
 * @param {string} query The query string to search for.
 * @returns {Promise<string>}
 */
export function searchGoogle(query: string) {
  return googleResults(query)
}
searchGoogle.announce = query => `Searching Google...`

/**
 * Fetches content from a specified webpage URL and converts it to Markdown format.
 * Use ot to get detailed information from links in the google search results, fetch up to date
 * information from websites, and summarize website contents. 
 * 
 * @param {string} url The URL to scrape.
 * @returns {Promise<String>}
 */
export function getWebPageContent(url: string) {
  return scrapeWebsite(url)
}
getWebPageContent.announce = url => `Visiting page...`