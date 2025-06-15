"use client";

import { RAGDocumentManagerPanel } from "@/components/rag-document-manager";

export default function KnowledgeBasePage() {
  return (
    <main className="flex justify-center p-4">
      <div className="w-full max-w-4xl">
        <RAGDocumentManagerPanel />
      </div>
    </main>
  );
}

