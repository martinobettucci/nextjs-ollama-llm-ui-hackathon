import React, { memo, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Message } from "ai/react";
import { ChatRequestOptions } from "ai";
import { CheckIcon, CopyIcon } from "@radix-ui/react-icons";
import { RefreshCcw, Database } from "lucide-react";
import Image from "next/image";
import {
  ChatBubble,
  ChatBubbleAvatar,
  ChatBubbleMessage,
} from "../ui/chat/chat-bubble";
import ButtonWithTooltip from "../button-with-tooltip";
import { Button } from "../ui/button";
import CodeDisplayBlock from "../code-display-block";
import { Badge } from "../ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../ui/tooltip";

export type ChatMessageProps = {
  message: Message;
  isLast: boolean;
  isLoading: boolean | undefined;
  reload: (chatRequestOptions?: ChatRequestOptions) => Promise<string | null | undefined>;
};

const MOTION_CONFIG = {
  initial: { opacity: 0, scale: 1, y: 20, x: 0 },
  animate: { opacity: 1, scale: 1, y: 0, x: 0 },
  exit: { opacity: 0, scale: 1, y: 20, x: 0 },
  transition: {
    opacity: { duration: 0.1 },
    layout: {
      type: "spring",
      bounce: 0.3,
      duration: 0.2,
    },
  },
};

function ChatMessage({ message, isLast, isLoading, reload }: ChatMessageProps) {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Extract "think" content from Deepseek R1 models and clean message (rest) content
  const { thinkContent, cleanContent, ragContext } = useMemo(() => {
    const getThinkContent = (content: string) => {
      const match = content.match(/<think>([\s\S]*?)(?:<\/think>|$)/);
      return match ? match[1].trim() : null;
    };

    const getRagContext = (content: string) => {
      const match = content.match(/\[CONTEXT\]([\s\S]*?)\[END CONTEXT\]/);
      return match ? match[1].trim() : null;
    };

    const contentWithoutThink = message.content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
    const ragContext = getRagContext(contentWithoutThink);
    const cleanContentWithoutRag = contentWithoutThink.replace(/\[CONTEXT\][\s\S]*?\[END CONTEXT\]\s*/g, '').trim();

    return {
      thinkContent: message.role === "assistant" ? getThinkContent(message.content) : null,
      cleanContent: cleanContentWithoutRag,
      ragContext: message.role === "user" ? ragContext : null,
    };
  }, [message.content, message.role]);

  const contentParts = useMemo(() => cleanContent.split("```"), [cleanContent]);

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  const renderAttachments = () => (
    <div className="flex gap-2">
      {message.experimental_attachments
        ?.filter((attachment) => attachment.contentType?.startsWith("image/"))
        .map((attachment, index) => (
          <Image
            key={`${message.id}-${index}`}
            src={attachment.url}
            width={200}
            height={200}
            alt="attached image"
            className="rounded-md object-contain"
          />
        ))}
    </div>
  );

  const renderThinkingProcess = () => (
    thinkContent && message.role === "assistant" && (
      <details className="mb-2 text-sm" open>
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Thinking process
        </summary>
        <div className="mt-2 text-muted-foreground">
          <Markdown remarkPlugins={[remarkGfm]}>{thinkContent}</Markdown>
        </div>
      </details>
    )
  );

  const renderRAGIndicator = () => (
    ragContext && message.role === "user" && (
      <div className="mb-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="secondary" className="text-xs cursor-help">
                <Database className="w-3 h-3 mr-1" />
                RAG Enhanced
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-md">
              <div className="text-xs">
                <p className="font-medium mb-1">Document Context Used:</p>
                <div className="max-h-32 overflow-y-auto text-muted-foreground">
                  <Markdown remarkPlugins={[remarkGfm]} className="prose prose-xs">
                    {ragContext}
                  </Markdown>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  );

  const renderContent = () => (
    contentParts.map((part, index) => (
      index % 2 === 0 ? (
        <Markdown key={index} remarkPlugins={[remarkGfm]}>{part}</Markdown>
      ) : (
        <pre className="whitespace-pre-wrap" key={index}>
          <CodeDisplayBlock code={part} />
        </pre>
      )
    ))
  );

  const renderActionButtons = () => (
    message.role === "assistant" && (
      <div className="pt-2 flex gap-1 items-center text-muted-foreground">
        {!isLoading && (
          <ButtonWithTooltip side="bottom" toolTipText="Copy">
            <Button
              onClick={handleCopy}
              variant="ghost"
              size="icon"
              className="h-4 w-4"
            >
              {isCopied ? (
                <CheckIcon className="w-3.5 h-3.5 transition-all" />
              ) : (
                <CopyIcon className="w-3.5 h-3.5 transition-all" />
              )}
            </Button>
          </ButtonWithTooltip>
        )}
        {!isLoading && isLast && (
          <ButtonWithTooltip side="bottom" toolTipText="Regenerate">
            <Button
              variant="ghost"
              size="icon"
              className="h-4 w-4"
              onClick={() => reload()}
            >
              <RefreshCcw className="w-3.5 h-3.5 scale-100 transition-all" />
            </Button>
          </ButtonWithTooltip>
        )}
      </div>
    )
  );

  return (
    <motion.div {...MOTION_CONFIG} className="flex flex-col gap-2 whitespace-pre-wrap">
      <ChatBubble variant={message.role === "user" ? "sent" : "received"}>
        <ChatBubbleAvatar
          src={message.role === "assistant" ? "/ollama.png" : ""}
          width={6}
          height={6}
          className="object-contain dark:invert"
          fallback={message.role === "user" ? "US" : ""}
        />
        <ChatBubbleMessage>
          {renderRAGIndicator()}
          {renderThinkingProcess()}
          {renderAttachments()}
          {renderContent()}
          {renderActionButtons()}
        </ChatBubbleMessage>
      </ChatBubble>
    </motion.div>
  );
}

export default memo(ChatMessage, (prevProps, nextProps) => {
  if (nextProps.isLast) return false;
  return prevProps.isLast === nextProps.isLast && prevProps.message === nextProps.message;
});