import { getOllamaUrl } from "@/lib/config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const OLLAMA_URL = getOllamaUrl();
  console.log('OLLAMA_URL:', OLLAMA_URL);
  
  try {
    const res = await fetch(OLLAMA_URL + "/api/tags");
    
    if (!res.ok) {
      // Handle specific HTTP error codes with helpful messages
      if (res.status === 403) {
        console.error('Ollama server returned 403 Forbidden. This is likely a CORS issue.');
        return new Response(JSON.stringify({ 
          error: 'Ollama server access forbidden (403). This is typically caused by CORS restrictions. Please ensure your Ollama server is configured with OLLAMA_ORIGINS to allow requests from your application origin.',
          details: `Server URL: ${OLLAMA_URL}`,
          suggestion: 'Set OLLAMA_ORIGINS environment variable on your Ollama server to include your application URL (e.g., OLLAMA_ORIGINS=http://localhost:3000)',
          status: 403
        }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        });
      }
      
      if (res.status === 404) {
        console.error('Ollama server not found (404). Check if Ollama is running and the URL is correct.');
        return new Response(JSON.stringify({ 
          error: 'Ollama server not found (404). Please verify that Ollama is running and the URL is correct.',
          details: `Server URL: ${OLLAMA_URL}`,
          suggestion: 'Check if Ollama is running on the specified URL and port',
          status: 404
        }), {
          status: 404,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          }
        });
      }
      
      console.error(`Ollama server returned ${res.status}: ${res.statusText}`);
      return new Response(JSON.stringify({ 
        error: `Failed to fetch models from Ollama server (${res.status}: ${res.statusText})`,
        details: `Server URL: ${OLLAMA_URL}`,
        status: res.status
      }), {
        status: res.status,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    const data = await res.json();
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  } catch (error) {
    console.error('Error fetching from Ollama:', error);
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return new Response(JSON.stringify({ 
        error: 'Unable to connect to Ollama server. Please check if Ollama is running and accessible.',
        details: `Server URL: ${OLLAMA_URL}`,
        suggestion: 'Verify Ollama is running and the URL/port are correct',
        networkError: true
      }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error while fetching models',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

export async function OPTIONS(req: Request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}