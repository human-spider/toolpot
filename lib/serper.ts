export interface SearchParameters {
    q: string;
    num?: number;
    gl?: string;
    hl?: string;
    autocorrect?: boolean;
    page?: number;
    type?: string;
}

export interface KnowledgeGraph {
    title: string;
    type: string;
    website: string;
    imageUrl: string;
    description: string;
    descriptionSource: string;
    descriptionLink: string;
    attributes: {
        [key: string]: string;
    };
}

export interface OrganicResult {
    title: string;
    link: string;
    snippet: string;
    descriptionLink: string;
    sitelinks?: {
        title: string;
        link: string;
    }[];
    attributes?: {
        [key: string]: string;
    };
    position: number;
}

export interface PeopleAlsoAsk {
    question: string;
    snippet: string;
    title: string;
    link: string;
}

export interface RelatedSearch {
    query: string;
}

export interface SerperResponse {
    searchParameters: SearchParameters;
    knowledgeGraph: KnowledgeGraph;
    organic: OrganicResult[];
    peopleAlsoAsk: PeopleAlsoAsk[];
    relatedSearches: RelatedSearch[];
}

const SERPER_API_URL = "https://google.serper.dev/search";
const SCRAPE_API_URL = "https://scrape.serper.dev"; // Added scrape API URL
const ENV_API_KEY = Deno.env.get("SERPER_API_KEY");
const apiKeyErrorMsg = `Serper API key is missing!
Set SERPER_API_KEY environment variable or provide apiKey argument to the constructor.`;

export class SerperClient {
    private apiKey: string;

    constructor(apiKey: string | undefined = ENV_API_KEY) {
        this.apiKey = apiKey!;
        if (!this.apiKey) {
            throw new Error(apiKeyErrorMsg);
        }
    }

    async search(params: SearchParameters): Promise<SerperResponse> {
        const myHeaders = new Headers();
        myHeaders.append("X-API-KEY", this.apiKey);
        myHeaders.append("Content-Type", "application/json");

        const raw = JSON.stringify(params);
        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow" as RequestRedirect,
        };

        try {
            const response = await fetch(SERPER_API_URL, requestOptions);
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || "Failed to fetch search results");
            }

            return response.json();

        } catch (error) {
            return Promise.reject(
                `Error fetching search results: ${(error as Error).message}`
            );
        }
    }

    async scrape(url: string): Promise<string> { // Added scrape method
        const myHeaders = new Headers();
        myHeaders.append("X-API-KEY", this.apiKey);
        myHeaders.append("Content-Type", "application/json");
    
        const raw = JSON.stringify({ url });
        const requestOptions = {
            method: "POST",
            headers: myHeaders,
            body: raw,
            redirect: "follow" as RequestRedirect,
        };
    
        try {
            const response = await fetch(SCRAPE_API_URL, requestOptions);
            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || "Failed to fetch scraping results");
            }
    
            return (await response.json())?.text;
    
        } catch (error) {
            return Promise.reject(
                new Error(`Error fetching scraping results: ${(error as Error).message}`)
            );
        }
    }
}

// Example usage:
// (async () => {
//   const client = new SerperClient("6e403a52a4596706982c18557a5a169557acea2e");
//   try {
//     const results = await client.search({
//       q: "GitHub Copilot",
//       gl: "ua",
//       hl: "hy",
//       autocorrect: false,
//       page: 3,
//     });
//     console.log(results);

//     const scrapeResults = await client.scrape("https://www.fisheries.noaa.gov/species/blue-whale");
//     console.log(scrapeResults);

//   } catch (error) {
//     console.error(error);
//   }
// })();