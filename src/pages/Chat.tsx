import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { apiFetch } from '@/config/api';

interface Message {
  id: string;
  userId: string;
  message: string;
  timestamp: number;
  userName?: string;
  userAvatar?: string;
}

export default function Chat() {
  const [user] = useAtom(userAtom);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Fetch messages
  const fetchMessages = async () => {
    if (!user?.id) return;
    
    try {
      const response = await apiFetch('/chat/messages?limit=50');
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  };

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!user?.id) return;

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);

    return () => clearInterval(interval);
  }, [user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || loading || !user?.id) return;

    setLoading(true);
    try {
      const response = await apiFetch('/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });

      if (response.ok) {
        setNewMessage('');
        // Immediately fetch to show new message
        await fetchMessages();
      } else {
        const error = await response.json();
        toast({
          title: 'Error',
          description: error.error || 'Failed to send message',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Send message error:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteMessage = async (messageId: string) => {
    try {
      const response = await apiFetch(`/chat/messages/${messageId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (error) {
      console.error('Delete message error:', error);
    }
  };

  const viewProfile = (_userId: string) => {
    toast({
      title: 'Profile',
      description: 'User profile feature coming soon!',
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Please log in to use chat</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Community Chat</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchMessages}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Chat</CardTitle>
              <p className="text-sm text-muted-foreground">
                Messages update every 3 seconds
              </p>
            </div>
            <Badge variant="outline" className="gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              {messages.length} messages
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No messages yet. Be the first to say hello! 👋</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwnMessage = msg.userId === user.id;
                const displayName = msg.userName || 'Anonymous';

                return (
                  <div key={msg.id} className="flex gap-3 group">
                    <div className="relative">
                      <button
                        onClick={() => viewProfile(msg.userId)}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={msg.userAvatar || 'https://via.placeholder.com/40'}
                          alt={displayName}
                          className="h-8 w-8 rounded-full cursor-pointer"
                        />
                      </button>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => viewProfile(msg.userId)}
                          className="font-medium text-sm hover:underline"
                        >
                          {displayName}
                        </button>
                        <span className="text-xs text-muted-foreground">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                        {isOwnMessage && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                            title="Delete message"
                          >
                            <Trash2 className="h-3 w-3 text-destructive hover:text-destructive/80" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm mt-1">{msg.message}</p>
                    </div>
                  </div>
                );
              })
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
            />
            <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
