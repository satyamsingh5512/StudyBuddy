import { useState, useRef, useEffect } from 'react';
import { X, Send, Plus, Loader2, Minimize2 } from 'lucide-react';
import { useAtomValue } from 'jotai';
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
  }, [messages]);

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
      const response = await apiFetch('/api/ai/buddy-chat', {
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
      const response = await apiFetch('/api/todos', {
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center group border-2 border-background"
        aria-label="Open Buddy Chat"
      >
        <img 
          src="/buddy-ai-logo.png" 
          alt="Buddy AI" 
          className="h-8 w-auto object-contain"
        />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-green-500 animate-pulse border-2 border-background"></span>
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-md border border-border">
          Chat with Buddy
        </div>
      </button>
    );
  }

  return (
    <div
      className={`fixed z-50 transition-all duration-300 ${
        isMinimized
          ? 'bottom-6 right-6 w-80 h-14'
          : 'bottom-6 right-6 w-96 h-[600px] md:w-[420px]'
      } bg-card rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden`}
    >
      {/* Header */}
      <div className="bg-primary text-primary-foreground p-4 flex items-center justify-between border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="relative px-3 py-1.5 bg-background/20 rounded-lg backdrop-blur-sm">
            <img 
              src="/buddy-ai-logo.png" 
              alt="Buddy AI" 
              className="h-6 w-auto object-contain"
            />
            <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-green-500 border-2 border-primary"></span>
          </div>
          <div>
            <p className="text-xs opacity-80">AI Study Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 hover:bg-background/20 rounded-lg transition-colors"
            aria-label={isMinimized ? 'Maximize' : 'Minimize'}
          >
            <Minimize2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-background/20 rounded-lg transition-colors"
            aria-label="Close chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground border border-border'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                  
                  {/* Task suggestions */}
                  {message.tasks && message.tasks.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold opacity-70">Suggested Tasks:</p>
                      {message.tasks.map((task, index) => (
                        <div
                          key={index}
                          className="bg-background rounded-lg p-2.5 text-xs border border-border hover:border-primary/50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-foreground mb-1.5">
                                {task.title}
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium">
                                  {task.subject}
                                </span>
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full text-xs font-medium">
                                  {task.difficulty}
                                </span>
                                <span className="text-xs text-muted-foreground">{task.questionsTarget} Qs</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleAddTask(task)}
                              className="flex-shrink-0 p-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors shadow-sm"
                              title="Add to tasks"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs opacity-50 mt-1.5">
                    {message.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-3 border border-border">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Buddy is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-card border-t border-border">
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask Buddy to create tasks..."
                className="flex-1 resize-none rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground max-h-24"
                rows={1}
                disabled={isLoading}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="h-10 w-10 p-0 rounded-xl"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Try: "Create 5 physics tasks" or "Help me plan tomorrow's study"
            </p>
          </div>
        </>
      )}
    </div>
  );
}
