import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  content: string;
  uploadDate: string;
  chunkCount: number;
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding: number[];
  type: string;
  startIndex: number;
  endIndex: number;
}

interface RAGDatabase extends DBSchema {
  documents: {
    key: string;
    value: Document;
  };
  chunks: {
    key: string;
    value: DocumentChunk;
    indexes: {
      'by-document': string;
    };
  };
}

const DB_NAME = 'rag-database';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<RAGDatabase>> | null = null;

export async function openRAGDatabase(): Promise<IDBPDatabase<RAGDatabase>> {
  if (!dbPromise) {
    dbPromise = openDB<RAGDatabase>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create documents store
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }

        // Create chunks store
        if (!db.objectStoreNames.contains('chunks')) {
          const chunksStore = db.createObjectStore('chunks', { keyPath: 'id' });
          chunksStore.createIndex('by-document', 'documentId');
        }
      },
    });
  }
  return dbPromise;
}

export async function addDocument(document: Document): Promise<void> {
  const db = await openRAGDatabase();
  await db.add('documents', document);
}

export async function addDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
  const db = await openRAGDatabase();
  const tx = db.transaction('chunks', 'readwrite');
  
  for (const chunk of chunks) {
    await tx.store.add(chunk);
  }
  
  await tx.done;
}

export async function getAllDocuments(): Promise<Document[]> {
  const db = await openRAGDatabase();
  return await db.getAll('documents');
}

export async function getDocumentById(id: string): Promise<Document | undefined> {
  const db = await openRAGDatabase();
  return await db.get('documents', id);
}

export async function getChunksByDocumentId(documentId: string): Promise<DocumentChunk[]> {
  const db = await openRAGDatabase();
  return await db.getAllFromIndex('chunks', 'by-document', documentId);
}

export async function getAllChunks(): Promise<DocumentChunk[]> {
  const db = await openRAGDatabase();
  return await db.getAll('chunks');
}

export async function deleteDocument(id: string): Promise<void> {
  const db = await openRAGDatabase();
  const tx = db.transaction(['documents', 'chunks'], 'readwrite');
  
  // Delete the document
  await tx.objectStore('documents').delete(id);
  
  // Delete all chunks for this document
  const chunks = await tx.objectStore('chunks').index('by-document').getAllKeys(id);
  for (const chunkKey of chunks) {
    await tx.objectStore('chunks').delete(chunkKey);
  }
  
  await tx.done;
}

export async function clearAllDocuments(): Promise<void> {
  const db = await openRAGDatabase();
  const tx = db.transaction(['documents', 'chunks'], 'readwrite');
  
  await tx.objectStore('documents').clear();
  await tx.objectStore('chunks').clear();
  
  await tx.done;
}