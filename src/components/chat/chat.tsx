"use client";

import ChatTopbar from "./chat-topbar";
import ChatList from "./chat-list";
import ChatBottombar from "./chat-bottombar";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { BytesOutputParser } from "@langchain/core/output_parsers";
import { Attachment, ChatRequestOptions, generateId } from "ai";
import { Message, useChat } from "ai/react";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import useChatStore from "@/app/hooks/useChatStore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getAllChunks, getAllDocuments } from "@/lib/rag-db";
import { searchSimilarChunks, formatRetrievedContext } from "@/lib/rag-utils";

export interface ChatProps {
  id: string;
  initialMessages: Message[] | [];
  isMobile?: boolean;
}

export default function Chat({ initialMessages, id, isMobile }: ChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    stop,
    setMessages,
    setInput,
    reload,
  } = useChat({
    id,
    initialMessages,
    onResponse: (response) => {
      if (response) {
        setLoadingSubmit(false);
      }
    },
    onFinish: (message) => {
      const savedMessages = getMessagesById(id);
      saveMessages(id, [...savedMessages, message]);
      setLoadingSubmit(false);
      router.replace(`/c/${id}`);
    },
    onError: (error) => {
      setLoadingSubmit(false);
      router.replace("/");
      console.error(error.message);
      console.error(error.cause);
    },
  });
  const [loadingSubmit, setLoadingSubmit] = React.useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const base64Images = useChatStore((state) => state.base64Images);
  const setBase64Images = useChatStore((state) => state.setBase64Images);
  const selectedModel = useChatStore((state) => state.selectedModel);
  const isRAGEnabled = useChatStore((state) => state.isRAGEnabled);
  const ragMaxResults = useChatStore((state) => state.ragMaxResults);
  const ragSimilarityThreshold = useChatStore((state) => state.ragSimilarityThreshold);
  const saveMessages = useChatStore((state) => state.saveMessages);
  const getMessagesById = useChatStore((state) => state.getMessagesById);
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    window.history.replaceState({}, "", `/c/${id}`);

    if (!selectedModel) {
      toast.error("Please select a model");
      return;
    }

    let augmentedInput = input;

    // Perform RAG if enabled
    if (isRAGEnabled) {
      try {
        const chunks = await getAllChunks();
        
        if (chunks.length === 0) {
          toast.warning("RAG is enabled but no documents are uploaded. Upload documents to use RAG functionality.");
        } else {
          // Search for similar chunks
          const results = await searchSimilarChunks(input, chunks, ragMaxResults);
          
          // Filter by similarity threshold
          const filteredResults = results.filter(result => result.similarity >= ragSimilarityThreshold);
          
          if (filteredResults.length > 0) {
            // Format and prepend context to the user's input
            const contextString = formatRetrievedContext(filteredResults);
            augmentedInput = contextString + input;
            
            // Show a subtle indication that RAG was used
            toast.success(`Found ${filteredResults.length} relevant document chunks`, {
              duration: 2000,
            });
          } else {
            toast.info("No relevant documents found for your query", {
              duration: 2000,
            });
          }
        }
      } catch (error) {
        console.error("RAG search error:", error);
        toast.error("Error searching documents. Proceeding without RAG.");
      }
    }

    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: input, // Store original input in messages
    };

    setLoadingSubmit(true);

    const attachments: Attachment[] = base64Images
      ? base64Images.map((image) => ({
          contentType: "image/base64",
          url: image,
        }))
      : [];

    const requestOptions: ChatRequestOptions = {
      body: {
        selectedModel: selectedModel,
        // Send the augmented input to the API
        messages: [
          ...messages,
          { ...userMessage, content: augmentedInput }
        ],
      },
      ...(base64Images && {
        data: {
          images: base64Images,
        },
        experimental_attachments: attachments,
      }),
    };

    // Create a custom event to use the augmented input
    const customEvent = {
      ...e,
      target: {
        ...e.target,
        elements: {
          message: { value: augmentedInput }
        }
      }
    } as any;

    handleSubmit(customEvent, requestOptions);
    saveMessages(id, [...messages, userMessage]);
    setBase64Images(null);
  };

  const removeLatestMessage = () => {
    const updatedMessages = messages.slice(0, -1);
    setMessages(updatedMessages);
    saveMessages(id, updatedMessages);
    return updatedMessages;
  };

  const handleStop = () => {
    stop();
    saveMessages(id, [...messages]);
    setLoadingSubmit(false);
  };

  return (
    <div className="flex flex-col w-full max-w-3xl h-full">
      <ChatTopbar
        isLoading={isLoading}
        chatId={id}
        messages={messages}
        setMessages={setMessages}
      />

      {messages.length === 0 ? (
        <div className="flex flex-col h-full w-full items-center gap-4 justify-center">
          <Image
            src="/ollama.png"
            alt="AI"
            width={40}
            height={40}
            className="h-16 w-14 object-contain dark:invert"
          />
          <p className="text-center text-base text-muted-foreground">
            How can I help you today?
          </p>
          {isRAGEnabled && (
            <div className="text-center text-sm text-muted-foreground bg-primary/10 px-4 py-2 rounded-lg">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="font-medium">RAG Mode Active</span>
              </div>
              <p>Your questions will be augmented with relevant information from uploaded documents.</p>
            </div>
          )}
          <ChatBottombar
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={onSubmit}
            isLoading={isLoading}
            stop={handleStop}
            setInput={setInput}
          />
        </div>
      ) : (
        <>
          <ChatList
            messages={messages}
            isLoading={isLoading}
            loadingSubmit={loadingSubmit}
            reload={async () => {
              removeLatestMessage();

              const requestOptions: ChatRequestOptions = {
                body: {
                  selectedModel: selectedModel,
                },
              };

              setLoadingSubmit(true);
              return reload(requestOptions);
            }}
          />
          <ChatBottombar
            input={input}
            handleInputChange={handleInputChange}
            handleSubmit={onSubmit}
            isLoading={isLoading}
            stop={handleStop}
            setInput={setInput}
          />
        </>
      )}
    </div>
  );
}