import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Trash2 } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';
import { API_URL } from '@/config/api';
import { soundManager } from '@/lib/sounds';

interface Message {
  id: string;
  userId: string;
  message: string;
  roomId: string;
  timestamp: number;
  userName?: string;
  userAvatar?: string;
  userAvatarType?: string;
}

export default function Chat() {
  const [user] = useAtom(userAtom);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!user?.id) return;

    const socketUrl = API_URL.replace('/api', '');
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket connected');
      newSocket.emit('join-chat', {
        userId: user.id,
        roomId: 'global-chat',
      });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
    });

    newSocket.on('chat-history', (history: Message[]) => {
      console.log('📜 Received chat history:', history.length, 'messages');
      setMessages(history);
    });

    newSocket.on('new-message', (message: Message) => {
      console.log('📨 New message:', message);
      setMessages((prev) => [...prev, message]);

      // Play sound if message is from another user
      if (message.userId !== user.id) {
        soundManager.playMessageNotification();
      }
    });

    newSocket.on('message-deleted', (data: { messageId: string }) => {
      console.log('🗑️  Message deleted:', data.messageId);
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    newSocket.on('online-users', (users: string[]) => {
      console.log('👥 Online users:', users.length);
      setOnlineUsers(users);
    });

    newSocket.on('online-count', (count: number) => {
      console.log('📊 Online count:', count);
      setOnlineCount(count);
    });

    newSocket.on('user-joined', (data: { userId: string; userName: string }) => {
      console.log('👋 User joined:', data.userName);
      toast({
        title: 'User joined',
        description: `${data.userName} joined the chat`,
      });
    });

    newSocket.on('user-left', (data: { userId: string }) => {
      console.log('👋 User left:', data.userId);
    });

    newSocket.on('user-typing', (data: { userId: string; userName: string }) => {
      console.log('⌨️  User typing:', data.userName);
      setTypingUsers((prev) => new Set([...prev, data.userName]));
    });

    newSocket.on('user-stopped-typing', (data: { userId: string }) => {
      console.log('⌨️  User stopped typing:', data.userId);
      setTypingUsers((prev) => {
        const next = new Set(prev);
        // Remove by userId (we'll need to map this properly)
        next.delete(data.userId);
        return next;
      });
    });

    newSocket.on('rate-limit', (data: { message: string; remainingMs: number }) => {
      const seconds = Math.ceil(data.remainingMs / 1000);
      toast({
        title: 'Slow down',
        description: `Wait ${seconds}s before sending another message`,
        variant: 'destructive',
      });
    });

    newSocket.on('error', (data: { message: string }) => {
      console.error('❌ Socket error:', data.message);
      toast({
        title: 'Error',
        description: data.message,
        variant: 'destructive',
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [user?.id, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', { message: newMessage });
    setNewMessage('');
    
    // Stop typing indicator
    if (isTyping) {
      socket.emit('typing', { isTyping: false });
      setIsTyping(false);
    }
  };

  const handleTyping = () => {
    if (!socket) return;

    // Start typing
    if (!isTyping) {
      socket.emit('typing', { isTyping: true });
      setIsTyping(true);
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (socket) {
        socket.emit('typing', { isTyping: false });
        setIsTyping(false);
      }
    }, 3000);
  };

  const deleteMessage = (messageId: string) => {
    if (!socket) return;
    socket.emit('delete-message', { messageId });
  };

  const viewProfile = (_userId: string) => {
    // For now, just show a toast
    toast({
      title: 'Profile',
      description: 'User profile feature coming soon!',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Community Chat</h1>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">
            {onlineCount} online
          </span>
        </div>
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Chat</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rate limit: 1 message per 2 seconds
              </p>
            </div>
            {socket && (
              <Badge variant="outline" className="gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Connected
              </Badge>
            )}
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
                const isOnline = onlineUsers.includes(msg.userId);
                const isOwnMessage = msg.userId === user?.id;
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
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                        )}
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
            
            {/* Typing indicator */}
            {typingUsers.size > 0 && (
              <div className="flex gap-3 text-sm text-muted-foreground italic">
                <div className="h-8 w-8" /> {/* Spacer for alignment */}
                <p>{Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...</p>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={!socket}
            />
            <Button onClick={sendMessage} disabled={!socket || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
