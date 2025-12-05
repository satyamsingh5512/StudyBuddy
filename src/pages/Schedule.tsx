import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Calendar, Clock, CheckCircle2, Circle } from 'lucide-react';
import { API_URL } from '@/config/api';

interface Schedule {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  title: string;
  subject?: string;
  notes?: string;
  completed: boolean;
  createdAt: string;
}

export default function Schedule() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
    title: '',
    subject: '',
    notes: '',
  });

  useEffect(() => {
    fetchSchedules();
  }, [selectedDate]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const startDate = new Date(selectedDate);
      startDate.setDate(startDate.getDate() - 7);
      
      const endDate = new Date(selectedDate);
      endDate.setDate(endDate.getDate() + 7);

      const response = await fetch(
        `${API_URL}/schedule?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        { credentials: 'include' }
      );
      
      if (response.ok) {
        const data = await response.json();
        setSchedules(data);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowAddForm(false);
        setFormData({
          date: '',
          startTime: '',
          endTime: '',
          title: '',
          subject: '',
          notes: '',
        });
        fetchSchedules();
      }
    } catch (error) {
      console.error('Error adding schedule:', error);
    }
  };

  const handleToggleComplete = async (id: string, completed: boolean) => {
    try {
      const response = await fetch(`${API_URL}/schedule/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ completed: !completed }),
      });

      if (response.ok) {
        setSchedules(prev =>
          prev.map(s => (s.id === id ? { ...s, completed: !completed } : s))
        );
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this schedule entry?')) return;

    try {
      const response = await fetch(`${API_URL}/schedule/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setSchedules(prev => prev.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
    }
  };

  const groupedSchedules = schedules.reduce((acc, schedule) => {
    const date = new Date(schedule.date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (!acc[date]) acc[date] = [];
    acc[date].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 pb-6 px-2 sm:px-0">
      {/* Header - Responsive */}
      <div className="flex flex-col xs:flex-row justify-between items-stretch xs:items-center gap-2 sm:gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Schedule</h1>
        <div className="flex items-center gap-2 w-full xs:w-auto">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 xs:flex-none xs:w-auto text-sm transition-all duration-200"
          />
          <Button 
            onClick={() => setShowAddForm(true)} 
            size="sm"
            className="transition-all duration-200 hover:scale-105"
          >
            <Plus className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </div>

      {/* Add Form - Smooth transition */}
      <div 
        className={`
          transition-all duration-300 ease-in-out origin-top
          ${showAddForm ? 'opacity-100 scale-y-100 max-h-[1000px]' : 'opacity-0 scale-y-0 max-h-0 overflow-hidden'}
        `}
      >
        <Card className="shadow-lg">
          <CardHeader className="pb-3 sm:pb-4">
            <CardTitle className="text-base sm:text-lg">Add Schedule Entry</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <form onSubmit={handleAddSchedule} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium block">Date</label>
                  <Input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium block">Subject</label>
                  <Input
                    placeholder="e.g., Math, Physics"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium block">Start Time</label>
                  <Input
                    type="time"
                    required
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="w-full transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs sm:text-sm font-medium block">End Time</label>
                  <Input
                    type="time"
                    required
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="w-full transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium block">Title</label>
                <Input
                  placeholder="What are you studying?"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full transition-all duration-200 focus:scale-[1.02]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs sm:text-sm font-medium block">Notes (Optional)</label>
                <Input
                  placeholder="Additional details"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full transition-all duration-200 focus:scale-[1.02]"
                />
              </div>
              <div className="flex flex-col xs:flex-row gap-2 pt-2">
                <Button 
                  type="submit" 
                  className="flex-1 xs:flex-none transition-all duration-200 hover:scale-105"
                >
                  Save
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 xs:flex-none transition-all duration-200 hover:scale-105"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Loading State */}
      {loading ? (
        <Card className="transition-all duration-300">
          <CardContent className="py-8 sm:py-12 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-sm sm:text-base">Loading schedules...</p>
            </div>
          </CardContent>
        </Card>
      ) : Object.keys(groupedSchedules).length === 0 ? (
        <Card className="transition-all duration-300 hover:shadow-md">
          <CardContent className="py-8 sm:py-12 text-center text-muted-foreground">
            <div className="flex flex-col items-center gap-2">
              <Calendar className="h-12 w-12 sm:h-16 sm:w-16 opacity-20" />
              <p className="text-sm sm:text-base">No schedules found.</p>
              <p className="text-xs sm:text-sm">Click "Add" to create your first entry.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {Object.entries(groupedSchedules).map(([date, items], index) => (
            <Card 
              key={date}
              className="transition-all duration-300 hover:shadow-md"
              style={{ 
                animation: `fadeInUp 0.3s ease-out ${index * 0.1}s both`
              }}
            >
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="truncate">{date}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-3 sm:px-6">
                {items.map((schedule, itemIndex) => (
                  <div
                    key={schedule.id}
                    className={`
                      flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border 
                      transition-all duration-300 ease-in-out
                      ${schedule.completed 
                        ? 'bg-muted/50 border-muted' 
                        : 'bg-card border-border hover:border-primary/50 hover:shadow-sm active:scale-[0.98]'
                      }
                    `}
                    style={{ 
                      animation: `fadeInUp 0.2s ease-out ${itemIndex * 0.05}s both`
                    }}
                  >
                    <button
                      onClick={() => handleToggleComplete(schedule.id, schedule.completed)}
                      className="mt-0.5 flex-shrink-0 transition-transform duration-200 hover:scale-110 active:scale-95"
                    >
                      {schedule.completed ? (
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary transition-colors duration-200" />
                      ) : (
                        <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground transition-colors duration-200 hover:text-primary" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className={`
                            text-sm sm:text-base font-medium transition-all duration-200
                            ${schedule.completed ? 'line-through text-muted-foreground' : ''}
                          `}>
                            {schedule.title}
                          </h3>
                          {schedule.subject && (
                            <span className="text-xs text-muted-foreground bg-primary/10 px-2 py-0.5 rounded mt-1 inline-block transition-all duration-200 hover:bg-primary/20">
                              {schedule.subject}
                            </span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(schedule.id)}
                          className="h-7 w-7 sm:h-8 sm:w-8 p-0 flex-shrink-0 transition-all duration-200 hover:scale-110 hover:bg-destructive/10 active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1 text-xs sm:text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0" />
                        <span className="truncate">
                          {formatTime(schedule.startTime)} - {formatTime(schedule.endTime)}
                        </span>
                      </div>
                      {schedule.notes && (
                        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 line-clamp-2 transition-all duration-200">
                          {schedule.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
