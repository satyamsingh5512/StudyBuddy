import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Check, CheckCheck } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';
import { API_URL } from '@/config/api';
import { soundManager } from '@/lib/sounds';

interface Message {
  id: string;
  message: string;
  createdAt: string;
  read?: boolean;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export default function Chat() {
  const [user] = useAtom(userAtom);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const newSocket = io(API_URL, {
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-chat', user?.id);
    });

    newSocket.on('chat-history', (history: Message[]) => {
      setMessages(history);
      // Count unread messages
      const unread = history.filter((m) => !m.read && m.user.id !== user?.id).length;
      setUnreadCount(unread);
    });

    newSocket.on('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
      
      // Play sound and increment unread if message is from another user
      if (message.user.id !== user?.id) {
        soundManager.playMessageNotification();
        setUnreadCount((prev) => prev + 1);
      }
    });

    newSocket.on('online-users', (users: string[]) => {
      setOnlineUsers(new Set(users));
    });

    newSocket.on('user-online', (userId: string) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    newSocket.on('user-offline', (userId: string) => {
      setOnlineUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    });

    newSocket.on('rate-limit', (data: { message: string; remainingSeconds: number }) => {
      toast({
        title: 'Slow mode',
        description: `Wait ${data.remainingSeconds}s before sending another message`,
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
    
    // Mark messages as read when viewing chat
    if (messages.length > 0 && socket) {
      const unreadMessages = messages.filter((m) => !m.read && m.user.id !== user?.id);
      if (unreadMessages.length > 0) {
        socket.emit('mark-read', unreadMessages.map((m) => m.id));
        setUnreadCount(0);
      }
    }
  }, [messages, socket, user?.id]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', { message: newMessage });
    setNewMessage('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Community Chat</h1>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {unreadCount} unread
          </Badge>
        )}
      </div>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Chat</CardTitle>
              <p className="text-sm text-muted-foreground">
                Slow mode: 1 message per 30 seconds
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              {onlineUsers.size} online
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((msg) => {
              const isOnline = onlineUsers.has(msg.user.id);
              const isOwnMessage = msg.user.id === user?.id;
              
              return (
                <div key={msg.id} className="flex gap-3">
                  <div className="relative">
                    <img
                      src={msg.user.avatar || 'https://via.placeholder.com/40'}
                      alt={msg.user.name}
                      className="h-8 w-8 rounded-full"
                    />
                    {isOnline && (
                      <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{msg.user.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </span>
                      {isOwnMessage && (
                        <span className="text-xs text-muted-foreground">
                          {msg.read ? (
                            <CheckCheck className="h-3 w-3 text-blue-500" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>
                    <p className="text-sm mt-1">{msg.message}</p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            />
            <Button onClick={sendMessage}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
