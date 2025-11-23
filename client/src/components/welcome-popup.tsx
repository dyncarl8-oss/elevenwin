import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function WelcomePopup() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("elevenwin-welcome-seen");
    
    // Don't show popup on Terms or Privacy pages
    const isTermsOrPrivacy = location === "/terms" || location === "/privacy";
    
    if (!hasSeenWelcome && !isTermsOrPrivacy) {
      // Add a 1.5 second delay before showing the popup for a smooth transition
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [location]);

  const handleAccept = () => {
    localStorage.setItem("elevenwin-welcome-seen", "true");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md bg-purple-950 border-purple-800" hideCloseButton>
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-white">Welcome to ElevenWin</h2>
          <p className="text-purple-200 text-sm">
            By using ElevenWin, you agree to our{" "}
            <a 
              href="/terms" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 hover:underline transition-colors"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a 
              href="/privacy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 hover:underline transition-colors"
            >
              Privacy Policy
            </a>
            .
          </p>
          <Button
            onClick={handleAccept}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg"
          >
            I Understand
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
