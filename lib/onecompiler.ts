const ENV_API_KEY = Deno.env.get("ONECOMPILER_API_KEY");

interface CompilerOptions {
    language: string;
    stdin?: string;
    files: Array<{ name: string; content: string }>;
  }
  
  interface CompilerResponse {
    stdout: string;
    stderr: string;
    executionTime: number;
  }

export default class OneCompilerAPI {
    private apiKey: string;
    private apiHost: string = 'onecompiler-apis.p.rapidapi.com';
    private apiUrl: string = 'https://onecompiler-apis.p.rapidapi.com/api/v1/run';
  
    constructor(apiKey: string | undefined = ENV_API_KEY) {
      this.apiKey = apiKey;
    }
  
    async executeCode(options: CompilerOptions): Promise<CompilerResponse> {
      const requestOptions: RequestInit = {
        method: 'POST',
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': this.apiHost,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      };
  
      try {
        const response = await fetch(this.apiUrl, requestOptions);
        if (!response.ok) {
          throw new Error(`API request failed: ${response.statusText}`);
        }
        return await response.json() as CompilerResponse;
      } catch (error) {
        if (error instanceof Error) {
          throw new Error(`API request failed: ${error.message}`);
        } else {
          throw new Error('An unexpected error occurred');
        }
      }
    }
  }