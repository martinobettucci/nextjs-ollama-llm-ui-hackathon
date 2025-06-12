/**
 * Configuration utility for Ollama URL
 * 
 * Priority order:
 * 1. Environment variable OLLAMA_URL
 * 2. Hardcoded OLLAMA_URL (fallback for production)
 */

// Hardcoded Ollama URL for production deployment
const HARDCODED_OLLAMA_URL = "http://51.159.155.179:11434";

/**
 * Get the Ollama URL from environment variables or fallback to hardcoded value
 * @returns {string} The Ollama URL to use
 */
export function getOllamaUrl(): string {
  // First try to get from environment variable
  const envUrl = process.env.OLLAMA_URL;
  
  // Return environment URL if it exists and is not empty
  if (envUrl && envUrl !== 'undefined') {
    console.log('Using Ollama URL from environment:', envUrl);
    return envUrl;
  }
  
  // Always fallback to hardcoded URL
  console.log('Using hardcoded Ollama URL:', HARDCODED_OLLAMA_URL);
  return HARDCODED_OLLAMA_URL;
}

/**
 * Alternative function to force hardcoded URL (useful for production builds)
 * @returns {string} The hardcoded Ollama URL
 */
export function getHardcodedOllamaUrl(): string {
  return HARDCODED_OLLAMA_URL;
}