
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface ReportButtonProps {
  postId: string;
  postContent: string;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam or unwanted content' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'hate', label: 'Hate speech' },
  { value: 'violence', label: 'Violence or threats' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'misinformation', label: 'False or misleading information' },
  { value: 'other', label: 'Other' }
];

export const ReportButton = ({ postId, postContent }: ReportButtonProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  const handleReport = async () => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to report content",
        variant: "destructive"
      });
      return;
    }

    if (!reason) {
      toast({
        title: "Error",
        description: "Please select a reason for reporting",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      // Insert report into content_reports table (we'll create this)
      const { error } = await supabase
        .from('content_reports')
        .insert({
          reported_post_id: postId,
          reporter_id: user.id,
          reason: reason,
          details: details.trim() || null,
          status: 'pending'
        });

      if (error) {
        console.error("Report error:", error);
        throw error;
      }

      toast({
        title: "Report submitted",
        description: "Thank you for helping keep our community safe. We'll review this content."
      });
      
      setIsOpen(false);
      setReason('');
      setDetails('');
    } catch (error) {
      console.error("Error submitting report:", error);
      toast({
        title: "Error",
        description: "Failed to submit report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <Flag className="w-3 h-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report Content</DialogTitle>
          <DialogDescription>
            Help us keep the community safe by reporting inappropriate content.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-3 bg-muted rounded-lg max-h-20 overflow-y-auto">
            <p className="text-sm text-foreground line-clamp-3">{postContent}</p>
          </div>
          
          <div className="space-y-3">
            <Label className="text-sm font-medium">Why are you reporting this?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REPORT_REASONS.map((reportReason) => (
                <div key={reportReason.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={reportReason.value} id={reportReason.value} />
                  <Label htmlFor={reportReason.value} className="text-sm">
                    {reportReason.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="details" className="text-sm font-medium">
              Additional details (optional)
            </Label>
            <Textarea
              id="details"
              placeholder="Provide any additional context..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[80px]"
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {details.length}/500 characters
            </p>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setIsOpen(false);
                setReason('');
                setDetails('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReport} 
              disabled={loading || !reason}
              variant="destructive"
            >
              {loading ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
