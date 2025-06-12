/**
 * Configuration utility for Ollama URL
 * 
 * Priority order:
 * 1. Environment variable OLLAMA_URL
 * 2. Hardcoded OLLAMA_URL (fallback for production)
 */

// Set this to true to use hardcoded URL as fallback when env var is not set
const USE_HARDCODED_FALLBACK = true;

// Hardcoded Ollama URL for production deployment
const HARDCODED_OLLAMA_URL = "http://51.159.155.179:11434";

/**
 * Get the Ollama URL from environment variables or fallback to hardcoded value
 * @returns {string} The Ollama URL to use
 */
export function getOllamaUrl(): string {
  // First try to get from environment variable
  const envUrl = process.env.OLLAMA_URL;
  
  if (envUrl) {
    console.log('Using Ollama URL from environment:', envUrl);
    return envUrl;
  }
  
  // Fallback to hardcoded URL if enabled
  if (USE_HARDCODED_FALLBACK) {
    console.log('Using hardcoded Ollama URL:', HARDCODED_OLLAMA_URL);
    return HARDCODED_OLLAMA_URL;
  }
  
  // If no fallback is enabled, throw an error
  throw new Error('OLLAMA_URL environment variable is not set and hardcoded fallback is disabled');
}

/**
 * Alternative function to force hardcoded URL (useful for production builds)
 * @returns {string} The hardcoded Ollama URL
 */
export function getHardcodedOllamaUrl(): string {
  return HARDCODED_OLLAMA_URL;
}