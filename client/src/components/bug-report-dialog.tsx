import { useState } from "react";
import { Bug, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function BugReportDialog() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
  });
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: "Missing Information",
        description: "Please provide both a title and description for the bug.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await apiRequest("POST", "/api/bug-reports", {
        title: formData.title,
        description: formData.description,
        page: window.location.pathname,
      });

      toast({
        title: "Bug Report Submitted",
        description: "Thank you for helping us improve the app!",
      });

      setFormData({
        title: "",
        description: "",
      });
      setOpen(false);
    } catch (error) {
      toast({
        title: "Submission Failed",
        description: "Failed to submit bug report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="hover:text-foreground transition-colors flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5" />
          Report Bug
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Bug className="h-5 w-5 text-primary" />
            Report a Bug
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Found something not working right? Let us know and we'll fix it!
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="text-foreground">Bug Title</Label>
            <Input
              id="title"
              placeholder="Brief description of the issue"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              disabled={isSubmitting}
              className="bg-card border-border text-foreground"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description" className="text-foreground">Details</Label>
            <Textarea
              id="description"
              placeholder="What happened? What did you expect to happen? Steps to reproduce..."
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              disabled={isSubmitting}
              rows={5}
              className="bg-card border-border text-foreground"
            />
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full"
          >
            {isSubmitting ? (
              "Submitting..."
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Submit Bug Report
              </>
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
