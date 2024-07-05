import { SerperClient } from "./serper.ts";

export function scrapeWebsite(url: string) {
  const serper = new SerperClient();
  return serper.scrape(url);
}