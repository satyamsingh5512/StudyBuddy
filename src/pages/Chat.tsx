import { useState, useEffect, useRef } from 'react';
import { useAtom } from 'jotai';
import { userAtom } from '@/store/atoms';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Send, Trash2, Edit2, X, Check, AlertTriangle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/components/ui/use-toast';
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
  edited?: boolean;
}

export default function Chat() {
  const [user] = useAtom(userAtom);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
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

    // Use environment variable for backend URL, fallback to same origin
    const backendUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const socketUrl = backendUrl.replace('/api', '');

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

    newSocket.on('message-edited', (data: { messageId: string; message: string }) => {
      console.log('✏️  Message edited:', data.messageId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, message: data.message, edited: true } : m
        )
      );
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
    setMessageToDelete(messageId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!socket || !messageToDelete) return;
    socket.emit('delete-message', { messageId: messageToDelete });
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setMessageToDelete(null);
  };

  const startEditMessage = (messageId: string, currentMessage: string) => {
    setEditingMessageId(messageId);
    setEditingText(currentMessage);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditingText('');
  };

  const saveEdit = (messageId: string) => {
    if (!socket || !editingText.trim()) return;
    socket.emit('edit-message', { messageId, message: editingText.trim() });
    setEditingMessageId(null);
    setEditingText('');
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
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">
            {onlineCount} online
          </span>
        </div>
      </div>

      <Card className="h-[600px] flex flex-col overflow-hidden">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Global Chat</CardTitle>
              <p className="text-sm text-muted-foreground">
                Real-time messaging
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
        <CardContent className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0 pr-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>No messages yet. Be the first to say hello! 👋</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOnline = onlineUsers.includes(msg.userId);
                const isOwnMessage = msg.userId === user.id;
                const displayName = msg.userName || 'Anonymous';
                const isEditing = editingMessageId === msg.id;

                return (
                  <div key={msg.id} className="flex gap-3 group">
                    <div className="relative flex-shrink-0">
                      <button
                        onClick={() => viewProfile(msg.userId)}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={msg.userAvatar || 'https://via.placeholder.com/40'}
                          alt={displayName}
                          className="h-8 w-8 rounded-full cursor-pointer ring-2 ring-border"
                        />
                        {isOnline && (
                          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                        )}
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => viewProfile(msg.userId)}
                          className="font-medium text-sm hover:underline truncate"
                        >
                          {displayName}
                        </button>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                        {msg.edited && (
                          <span className="text-xs text-muted-foreground italic">
                            (edited)
                          </span>
                        )}
                        {isOwnMessage && !isEditing && (
                          <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => startEditMessage(msg.id, msg.message)}
                              className="p-1 hover:bg-accent rounded"
                              title="Edit message"
                            >
                              <Edit2 className="h-3 w-3 text-primary" />
                            </button>
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="p-1 hover:bg-accent rounded"
                              title="Delete message"
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        )}
                      </div>
                      {isEditing ? (
                        <div className="mt-1 flex gap-2">
                          <Input
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                saveEdit(msg.id);
                              }
                              if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                            className="text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => saveEdit(msg.id)}
                            disabled={!editingText.trim()}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEdit}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm mt-1 break-words whitespace-pre-wrap">{msg.message}</p>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {/* Typing indicator */}
            {typingUsers.size > 0 && (
              <div className="flex gap-3 text-sm text-muted-foreground italic">
                <div className="h-8 w-8" />
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Message
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this message? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={cancelDelete}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
