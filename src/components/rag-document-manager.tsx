"use client";

import React, { useState, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "./ui/button";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Loader2, 
  FileIcon,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Progress } from "./ui/progress";
import {
  addDocument,
  addDocumentChunks,
  getAllDocuments,
  deleteDocument,
  Document,
} from "@/lib/rag-db";
import {
  readFileAsText,
  readPDFAsText,
  processDocument,
} from "@/lib/rag-utils";
import { generateUUID } from "@/lib/utils";

interface RAGDocumentManagerProps {
  onDocumentsChange?: () => void;
}

export default function RAGDocumentManager({ onDocumentsChange }: RAGDocumentManagerProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingFileName, setProcessingFileName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const docs = await getAllDocuments();
      setDocuments(docs);
      onDocumentsChange?.();
    } catch (error) {
      console.error("Error loading documents:", error);
      toast.error("Failed to load documents");
    } finally {
      setIsLoading(false);
    }
  };

  const onDrop = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      await processFile(file);
    }
    await loadDocuments();
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setProcessingProgress(0);
    setProcessingFileName(file.name);

    try {
      // Read file content based on type
      let content: string;
      if (file.type === "application/pdf") {
        content = await readPDFAsText(file);
      } else {
        content = await readFileAsText(file);
      }

      if (!content.trim()) {
        throw new Error("File appears to be empty or unreadable");
      }

      // Create document object
      const document: Document = {
        id: generateUUID(),
        name: file.name,
        type: file.type || "text/plain",
        size: file.size,
        content,
        uploadDate: new Date().toISOString(),
        chunkCount: 0,
      };

      // Process document and create chunks with embeddings
      const chunks = await processDocument(document, (progress) => {
        setProcessingProgress(progress * 100);
      });

      // Update document with chunk count
      document.chunkCount = chunks.length;

      // Store in IndexedDB
      await addDocument(document);
      await addDocumentChunks(chunks);

      toast.success(`Successfully processed "${file.name}" with ${chunks.length} chunks`);
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error(`Failed to process "${file.name}": ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress(0);
      setProcessingFileName("");
    }
  };

  const handleDeleteDocument = async (id: string, name: string) => {
    try {
      await deleteDocument(id);
      await loadDocuments();
      toast.success(`Deleted "${name}"`);
    } catch (error) {
      console.error("Error deleting document:", error);
      toast.error("Failed to delete document");
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.md', '.json', '.csv', '.log'],
      'application/pdf': ['.pdf'],
      'application/javascript': ['.js'],
      'application/typescript': ['.ts'],
      'text/javascript': ['.js'],
      'text/typescript': ['.ts'],
      'text/jsx': ['.jsx'],
      'text/tsx': ['.tsx'],
      'text/css': ['.css'],
      'text/html': ['.html'],
      'text/xml': ['.xml'],
      'application/json': ['.json'],
    },
    multiple: true,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type === "application/pdf") {
      return <FileText className="w-4 h-4 text-red-500" />;
    }
    return <FileIcon className="w-4 h-4 text-blue-500" />;
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="flex w-full gap-2 p-1 items-center cursor-pointer">
          <FileText className="w-4 h-4" />
          <span>RAG Documents</span>
          {documents.length > 0 && (
            <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
              {documents.length}
            </span>
          )}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>RAG Document Manager</DialogTitle>
          <DialogDescription>
            Upload documents to enable RAG functionality. Supported formats: TXT, PDF, MD, JS, TS, CSS, HTML, JSON, CSV, and more.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Upload Area */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/10"
                : "border-muted-foreground/25 hover:border-primary/50"
            } ${isProcessing ? "pointer-events-none opacity-50" : ""}`}
          >
            <input {...getInputProps()} disabled={isProcessing} />
            <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
            {isDragActive ? (
              <p>Drop the files here...</p>
            ) : (
              <div>
                <p className="text-sm font-medium">Click to upload or drag and drop</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Support for TXT, PDF, MD, JS, TS, CSS, HTML, JSON, CSV files (max 10MB each)
                </p>
              </div>
            )}
          </div>

          {/* Processing Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Processing "{processingFileName}"...</span>
              </div>
              <Progress value={processingProgress} className="w-full" />
              <p className="text-xs text-muted-foreground">
                Generating embeddings... {Math.round(processingProgress)}%
              </p>
            </div>
          )}

          {/* Documents List */}
          <div className="flex-1 min-h-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">
                Uploaded Documents ({documents.length})
              </h3>
              {documents.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Total chunks: {documents.reduce((sum, doc) => sum + doc.chunkCount, 0)}
                </p>
              )}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Loading documents...</span>
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-2 opacity-50" />
                <p className="text-sm">No documents uploaded yet</p>
                <p className="text-xs">Upload some documents to enable RAG functionality</p>
              </div>
            ) : (
              <ScrollArea className="h-64 w-full border rounded-md p-2">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      {getFileIcon(doc.type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{formatFileSize(doc.size)}</span>
                          <span>{doc.chunkCount} chunks</span>
                          <span>{new Date(doc.uploadDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDocument(doc.id, doc.name)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Status Info */}
          {documents.length > 0 && (
            <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="font-medium">RAG Ready</span>
              </div>
              <p>
                Your documents are processed and ready for RAG queries. Enable RAG mode in the chat to search through your documents.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}