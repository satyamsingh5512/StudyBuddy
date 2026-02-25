import { useState, useRef, useEffect } from 'react';
import { X, Send, Plus, Loader2, Minimize2, Bot, Sparkles } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
import { TextGenerateEffect } from './ui/text-generate-effect';
// import ReactMarkdown from 'react-markdown';
// import remarkGfm from 'remark-gfm';
import { userAtom } from '@/store/atoms';
import { apiFetch } from '@/config/api';
import { Button } from './ui/button';
import { useToast } from './ui/use-toast';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tasks?: Array<{
    title: string;
    subject: string;
    difficulty: string;
    questionsTarget: number;
  }>;
}

export default function BuddyChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm Buddy, your AI study assistant. Ask me to create study tasks, suggest topics, or help plan your study schedule!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const user = useAtomValue(userAtom);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await apiFetch('/ai/buddy-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input,
          examGoal: user?.examGoal || 'exam',
        }),
      });

      if (response.ok) {
        const data = await response.json();

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          tasks: data.tasks ? data.tasks.filter((task: any) =>
            task &&
            typeof task === 'object' &&
            typeof task.title === 'string' &&
            typeof task.subject === 'string' &&
            typeof task.difficulty === 'string'
          ) : undefined,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        const errorData = await response.json().catch(() => ({}));

        // Handle specific error cases
        if (response.status === 503) {
          toast({
            title: 'AI Service Unavailable',
            description: errorData.details || 'The AI service is currently unavailable. Please try again later.',
            variant: 'destructive',
          });
        } else {
          throw new Error(errorData.error || 'Failed to get response');
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get response from Buddy. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      // Auto-focus the input after response
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleAddTask = async (task: any) => {
    try {
      const response = await apiFetch('/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(task),
      });

      if (response.ok) {
        toast({
          title: 'Task added!',
          description: `"${task.title}" has been added to your tasks.`,
        });
      } else {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add task');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add task. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0, rotate: -180 }}
            animate={{
              scale: 1,
              opacity: 1,
              rotate: 0,
            }}
            exit={{ scale: 0, opacity: 0, rotate: 180 }}
            whileHover={{
              scale: 1.1,
              boxShadow: "0 20px 40px -10px rgba(99, 102, 241, 0.4)"
            }}
            whileTap={{ scale: 0.9 }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 20,
              mass: 1
            }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-tr from-primary to-purple-600 text-white shadow-xl flex items-center justify-center group border border-white/20"
            aria-label="Open Buddy Chat"
          >
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shadow-inner ring-2 ring-white/10">
              <Sparkles className="h-6 w-6 text-white animate-pulse" />
            </div>
            <motion.span
              className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-background"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />

            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.8 }}
              whileHover={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="absolute bottom-full right-0 mb-3 px-4 py-2 bg-popover/90 backdrop-blur-md text-popover-foreground text-sm font-medium rounded-xl shadow-lg border border-border whitespace-nowrap pointer-events-none"
            >
              Chat with Buddy
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.5,
              y: 100,
              originX: 1,
              originY: 1
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              height: isMinimized ? 64 : 650,
              width: isMinimized ? 320 : 420
            }}
            exit={{
              opacity: 0,
              scale: 0.5,
              y: 50,
              transition: { duration: 0.2, ease: "anticipate" }
            }}
            transition={{
              type: "spring",
              stiffness: 260,
              damping: 25,
              mass: 0.8
            }}
            className={`fixed z-[60] bottom-24 right-6 md:right-8 bg-card/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/10 flex flex-col overflow-hidden max-w-[calc(100vw-3rem)]`}
          >
            {/* Header */}
            <div
              className="h-[72px] px-5 flex items-center justify-between border-b border-border/50 bg-gradient-to-r from-primary/10 to-transparent cursor-pointer"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shadow-lg overflow-hidden border border-white/10 bg-gradient-to-br from-primary to-purple-600">
                    <span className="font-black text-white text-lg tracking-tighter">AI</span>
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background"></span>
                </div>
                <div>
                  <h3 className="font-bold text-base leading-none">Buddy AI</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Powered by Groq Llama 3.3
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMinimized(!isMinimized);
                  }}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Chat Area */}
            <AnimatePresence mode="wait">
              {!isMinimized && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: 0.1, duration: 0.2 }}
                  className="flex flex-col flex-1 overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                    {messages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] ${message.role === 'user' ? 'ml-8' : 'mr-8'}`}>
                          <div
                            className={`rounded-2xl px-5 py-4 shadow-sm ${message.role === 'user'
                              ? 'bg-primary text-primary-foreground rounded-br-sm'
                              : 'bg-card/50 border border-border rounded-bl-sm max-w-none text-sm'
                              }`}
                          >
                            {message.role === 'assistant' ? (
                              <TextGenerateEffect words={message.content} />
                            ) : (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                            )}
                          </div>

                          {/* Task Suggestions */}
                          {message.tasks && message.tasks.length > 0 && (
                            <div className="mt-3 space-y-2">
                              {message.tasks.map((task) => (
                                <motion.div
                                  key={`${message.id}-${task.title}`}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: 0.1 }}
                                  className="group relative bg-card/50 hover:bg-card border border-border rounded-xl p-3 transition-all hover:shadow-md cursor-pointer"
                                  onClick={() => handleAddTask(task)}
                                >
                                  <div className="flex justify-between items-start gap-3">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-medium text-sm truncate">{task.title}</h4>
                                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
                                          {task.subject}
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-medium">
                                          {task.difficulty}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                                      <Plus className="h-4 w-4" />
                                    </div>
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          )}

                          <span className={`text-[10px] mt-1 block opacity-50 ${message.role === 'user' ? 'text-right' : 'text-left'}`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </motion.div>
                    ))}

                    {isLoading && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex justify-start"
                      >
                        <div className="bg-card/50 border border-border rounded-2xl rounded-bl-sm px-5 py-4 flex items-center gap-2 w-20 h-12">
                          <motion.div
                            className="h-2 w-2 bg-primary rounded-full"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0 }}
                          />
                          <motion.div
                            className="h-2 w-2 bg-primary rounded-full"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }}
                          />
                          <motion.div
                            className="h-2 w-2 bg-primary rounded-full"
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }}
                          />
                        </div>
                      </motion.div>
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <div className="p-4 bg-background z-10">
                    <div className="relative flex items-end gap-2 bg-card rounded-2xl border border-border focus-within:ring-1 focus-within:ring-primary/50 focus-within:border-primary/50 transition-all p-1.5 shadow-inner">
                      <textarea
                        ref={inputRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Message Buddy..."
                        className="flex-1 bg-transparent border-0 focus:ring-0 resize-none max-h-32 text-sm py-2.5 px-3 min-h-[44px] placeholder:text-muted-foreground/70"
                        rows={1}
                        disabled={isLoading}
                      />
                      <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="h-9 w-9 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:scale-105 active:scale-95 mb-0.5 mr-0.5"
                      >
                        {isLoading ? (
                          <Sparkles className="h-4 w-4 animate-pulse" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
