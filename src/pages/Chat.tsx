import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';

interface Message {
  id: string;
  message: string;
  createdAt: string;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const newSocket = io('http://localhost:3001', {
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-chat', user?.id);
    });

    newSocket.on('chat-history', (history: Message[]) => {
      setMessages(history);
    });

    newSocket.on('new-message', (message: Message) => {
      setMessages((prev) => [...prev, message]);
      // Play sound if message is from another user
      if (message.user.id !== user?.id) {
        import('@/lib/sounds').then(({ soundManager }) => {
          soundManager.playMessageNotification();
        });
      }
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
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', { message: newMessage });
    setNewMessage('');
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Community Chat</h1>

      <Card className="h-[600px] flex flex-col">
        <CardHeader>
          <CardTitle>Global Chat</CardTitle>
          <p className="text-sm text-muted-foreground">
            Slow mode: 1 message per 30 seconds
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((msg) => (
              <div key={msg.id} className="flex gap-3">
                <img
                  src={msg.user.avatar || 'https://via.placeholder.com/40'}
                  alt={msg.user.name}
                  className="h-8 w-8 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{msg.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm mt-1">{msg.message}</p>
                </div>
              </div>
            ))}
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
