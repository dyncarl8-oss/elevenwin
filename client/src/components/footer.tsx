import { Link } from "wouter";
import BugReportDialog from "./bug-report-dialog";

export default function Footer() {
  return (
    <footer className="w-full py-4 px-6 border-t border-border/20 mt-auto" style={{ backgroundColor: '#080b12' }}>
      <div className="max-w-7xl mx-auto flex justify-between items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-6">
          <span>© 2025 ElevenWin</span>
        </div>
        <div className="flex items-center justify-center">
          <BugReportDialog />
        </div>
        <div className="flex items-center gap-6">
          <Link href="/terms" className="hover:text-primary transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-primary transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
