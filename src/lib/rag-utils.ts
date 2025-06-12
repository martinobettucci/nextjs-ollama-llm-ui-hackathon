import { pipeline, Pipeline } from '@xenova/transformers';
import { Document, DocumentChunk } from './rag-db';
import { generateUUID } from './utils';

// Global embedding pipeline instance
let embeddingPipeline: Pipeline | null = null;

// Configuration
const CHUNK_SIZE = 512; // Characters per chunk
const CHUNK_OVERLAP = 50; // Overlap between chunks
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

/**
 * Initialize the embedding pipeline
 */
export async function initializeEmbeddingPipeline(): Promise<Pipeline> {
  if (!embeddingPipeline) {
    console.log('Initializing embedding pipeline...');
    embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL);
    console.log('Embedding pipeline initialized');
  }
  return embeddingPipeline;
}

/**
 * Split text into overlapping chunks
 */
export function chunkText(text: string): { content: string; startIndex: number; endIndex: number }[] {
  const chunks: { content: string; startIndex: number; endIndex: number }[] = [];
  
  if (text.length <= CHUNK_SIZE) {
    return [{ content: text, startIndex: 0, endIndex: text.length }];
  }
  
  let start = 0;
  
  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    
    // Try to break at a sentence or word boundary
    if (end < text.length) {
      const sentenceEnd = text.lastIndexOf('.', end);
      const wordEnd = text.lastIndexOf(' ', end);
      
      if (sentenceEnd > start + CHUNK_SIZE * 0.5) {
        end = sentenceEnd + 1;
      } else if (wordEnd > start + CHUNK_SIZE * 0.5) {
        end = wordEnd;
      }
    }
    
    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        startIndex: start,
        endIndex: end
      });
    }
    
    // Move start position with overlap
    start = end - CHUNK_OVERLAP;
    if (start >= text.length) break;
  }
  
  return chunks;
}

/**
 * Generate embeddings for text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const pipeline = await initializeEmbeddingPipeline();
  const output = await pipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Generate embeddings for multiple text chunks
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  
  for (const text of texts) {
    const embedding = await generateEmbedding(text);
    embeddings.push(embedding);
  }
  
  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Process a document and create chunks with embeddings
 */
export async function processDocument(
  document: Document,
  onProgress?: (progress: number) => void
): Promise<DocumentChunk[]> {
  // Chunk the text
  const textChunks = chunkText(document.content);
  const chunks: DocumentChunk[] = [];
  
  onProgress?.(0);
  
  // Generate embeddings for each chunk
  for (let i = 0; i < textChunks.length; i++) {
    const textChunk = textChunks[i];
    const embedding = await generateEmbedding(textChunk.content);
    
    chunks.push({
      id: generateUUID(),
      documentId: document.id,
      content: textChunk.content,
      embedding,
      startIndex: textChunk.startIndex,
      endIndex: textChunk.endIndex
    });
    
    onProgress?.((i + 1) / textChunks.length);
  }
  
  return chunks;
}

/**
 * Search for similar chunks using vector similarity
 */
export async function searchSimilarChunks(
  query: string,
  chunks: DocumentChunk[],
  topK: number = 5
): Promise<{ chunk: DocumentChunk; similarity: number }[]> {
  if (chunks.length === 0) {
    return [];
  }
  
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);
  
  // Calculate similarities
  const similarities = chunks.map(chunk => ({
    chunk,
    similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
  
  // Sort by similarity (descending) and take top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Read file content as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}

/**
 * Read PDF file content using PDF.js
 */
export async function readPDFAsText(file: File): Promise<string> {
  // Dynamically import PDF.js to avoid SSR issues
  const pdfjsLib = await import('pdfjs-dist');
  
  // Set worker path
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        
        let fullText = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + '\n';
        }
        
        resolve(fullText);
      } catch (error) {
        reject(new Error(`Error parsing PDF: ${error}`));
      }
    };
    reader.onerror = () => reject(new Error('Error reading PDF file'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Format retrieved context for the LLM prompt
 */
export function formatRetrievedContext(results: { chunk: DocumentChunk; similarity: number }[]): string {
  if (results.length === 0) {
    return '';
  }
  
  const contextSections = results.map((result, index) => {
    return `[Document ${index + 1}] (Relevance: ${(result.similarity * 100).toFixed(1)}%)\n${result.chunk.content}`;
  });
  
  return `[CONTEXT]\nThe following information has been retrieved from your uploaded documents to help answer your question:\n\n${contextSections.join('\n\n')}\n\n[END CONTEXT]\n\n`;
}