import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarIcon, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSchedule: (scheduledAt: Date) => void;
  loading?: boolean;
}

export function ScheduleDialog({ open, onOpenChange, onSchedule, loading }: ScheduleDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState('12:00');

  const handleSchedule = () => {
    if (!selectedDate) return;
    
    const [hours, minutes] = selectedTime.split(':').map(Number);
    const scheduledDateTime = new Date(selectedDate);
    scheduledDateTime.setHours(hours, minutes, 0, 0);
    
    onSchedule(scheduledDateTime);
    onOpenChange(false);
  };

  const isValidDateTime = selectedDate && new Date(selectedDate.getTime() + (parseInt(selectedTime.split(':')[0]) * 60 + parseInt(selectedTime.split(':')[1])) * 60000) > new Date();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            Schedule Broadcast
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <Label>Select Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              disabled={(date) => date < new Date()}
              className="rounded-md border"
            />
          </div>
          
          <div>
            <Label htmlFor="time">Select Time</Label>
            <div className="flex items-center gap-2 mt-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <Input
                id="time"
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>
          
          {selectedDate && (
            <div className="bg-muted p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Scheduled for: {format(selectedDate, 'PPP')} at {selectedTime}
              </p>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSchedule} 
            disabled={!isValidDateTime || loading}
          >
            {loading ? 'Scheduling...' : 'Schedule Broadcast'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}