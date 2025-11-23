import { useState } from "react";
import { Bug, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BugFix {
  id: string;
  title: string;
  description: string;
  date: string;
}

const bugFixes: BugFix[] = [
  {
    id: "1",
    title: "Idempotency Protection",
    description: "Added idempotency protection to prevent double credits when processing payments and transactions.",
    date: "October 25, 2025",
  },
  {
    id: "2",
    title: "Yahtzee Game Display Fix",
    description: "Fixed issue where Yahtzee game board would become blank when the game started.",
    date: "October 25, 2025",
  },
  {
    id: "3",
    title: "Chess Game Display Fix",
    description: "Resolved bug causing Chess game board to disappear when a new game was initiated.",
    date: "October 25, 2025",
  },
];

export default function BugFixesDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="hover:text-foreground transition-colors flex items-center gap-1.5">
          <Bug className="h-3.5 w-3.5" />
          Bug Fixes
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Recent Bug Fixes
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Here's a list of bugs that have been fixed to improve your experience.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {bugFixes.map((fix) => (
              <div
                key={fix.id}
                className="border border-border rounded-lg p-4 bg-card hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground mb-1">{fix.title}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{fix.description}</p>
                    <p className="text-xs text-muted-foreground/70">{fix.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
