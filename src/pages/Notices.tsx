import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';

interface Notice {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
}

const categoryColors: Record<string, string> = {
  'Exam Dates': 'bg-red-500',
  'Form Submissions': 'bg-blue-500',
  'Study Tips': 'bg-green-500',
  'General': 'bg-gray-500',
};

export default function Notices() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetchNotices();
  }, []);

  const fetchNotices = async () => {
    const res = await fetch('/api/notices', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setNotices(data);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Notices</h1>

      <div className="space-y-4">
        {notices.map((notice, index) => (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{notice.title}</CardTitle>
                  <Badge className={categoryColors[notice.category] || 'bg-gray-500'}>
                    {notice.category}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{notice.content}</p>
                <p className="text-xs text-muted-foreground mt-4">
                  {new Date(notice.createdAt).toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {notices.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No notices yet
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
