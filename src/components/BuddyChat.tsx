import { useState, useRef, useEffect } from 'react';
import { X, Send, Plus, Loader2, Minimize2, Bot } from 'lucide-react';
import { useAtomValue } from 'jotai';
import { motion, AnimatePresence } from 'framer-motion';
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
          tasks: data.tasks,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to get response from Buddy. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
        throw new Error('Failed to add task');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add task. Please try again.',
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
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-gradient-to-tr from-primary to-purple-600 text-white shadow-xl flex items-center justify-center group border border-white/20"
            aria-label="Open Buddy Chat"
          >
            <Bot className="h-7 w-7" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse border-2 border-background"></span>

            <motion.div
              initial={{ opacity: 0, x: 10 }}
              whileHover={{ opacity: 1, x: 0 }}
              className="absolute bottom-full right-0 mb-3 px-4 py-2 bg-popover/90 backdrop-blur-md text-popover-foreground text-sm font-medium rounded-xl shadow-lg border border-border whitespace-nowrap pointer-events-none"
            >
              Chat with Buddy
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              height: isMinimized ? 64 : 600,
              width: isMinimized ? 320 : 400
            }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={`fixed z-50 bottom-6 right-6 md:right-8 bg-background/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-white/10 flex flex-col overflow-hidden max-w-[calc(100vw-3rem)]`}
          >
            {/* Header */}
            <div
              className="h-16 px-4 flex items-center justify-between border-b border-white/10 bg-gradient-to-r from-primary/10 to-purple-600/10 cursor-pointer"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center shadow-lg">
                    <Bot className="h-6 w-6 text-white" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background"></span>
                </div>
                <div>
                  <h3 className="font-bold text-base leading-none">Buddy AI</h3>
                  <p className="text-xs text-muted-foreground mt-1">Study Companion</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
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
            {!isMinimized && (
              <>
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
                          className={`rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user'
                            ? 'bg-gradient-to-br from-primary to-purple-600 text-white rounded-br-none'
                            : 'bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-md rounded-bl-none'
                            }`}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
                        </div>

                        {/* Task Suggestions */}
                        {message.tasks && message.tasks.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.tasks.map((task, index) => (
                              <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
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
                      <div className="bg-white/50 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-xs font-medium text-muted-foreground">Thinking...</span>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white/50 dark:bg-black/20 backdrop-blur-md border-t border-white/10">
                  <div className="relative flex items-end gap-2 bg-background/50 dark:bg-black/40 rounded-2xl border border-white/20 dark:border-white/10 p-1.5 shadow-inner">
                    <textarea
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
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
