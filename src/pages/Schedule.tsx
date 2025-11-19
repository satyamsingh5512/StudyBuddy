import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Schedule() {
  const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8 AM to 10 PM
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Weekly Schedule</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Time Planner</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-8 gap-2 min-w-[800px]">
              <div></div>
              {days.map((day) => (
                <div key={day} className="text-center font-medium p-2">
                  {day}
                </div>
              ))}
              
              {hours.map((hour) => (
                <>
                  <div key={`time-${hour}`} className="text-sm text-muted-foreground p-2">
                    {hour}:00
                  </div>
                  {days.map((day) => (
                    <div
                      key={`${day}-${hour}`}
                      className="border rounded p-2 min-h-[60px] hover:bg-accent/50 cursor-pointer transition-colors"
                    >
                    </div>
                  ))}
                </>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
