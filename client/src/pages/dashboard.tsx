import { useState } from "react";
import { useParams } from "wouter";
import { useDashboardUser, useDashboardLedgerAccount, useDashboardTransfer } from "@/hooks/use-dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Search, Send, Wallet, User } from "lucide-react";

export default function Dashboard() {
  const { companyId } = useParams();
  const [userId, setUserId] = useState("");
  const [searchedUserId, setSearchedUserId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const { data: userData, isLoading: userLoading, error: userError } = useDashboardUser(searchedUserId);
  const { data: ledgerData, isLoading: ledgerLoading } = useDashboardLedgerAccount(companyId || null);
  const transferMutation = useDashboardTransfer();

  const handleSearch = () => {
    if (userId.trim()) {
      setSearchedUserId(userId.trim());
    }
  };

  const handleTransfer = async () => {
    if (!userData || !ledgerData?.company?.ledgerAccount) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    await transferMutation.mutateAsync({
      amount: numAmount,
      currency: "usd",
      destinationId: userData.id,
      ledgerAccountId: ledgerData.company.ledgerAccount.id,
      transferFee: ledgerData.company.ledgerAccount.transfer_fee || undefined,
      notes: notes || undefined,
    });

    // Reset form after successful transfer
    setAmount("");
    setNotes("");
  };

  const ledgerAccount = ledgerData?.company?.ledgerAccount;
  const usdBalance = ledgerAccount?.balances?.find(b => b.currency === "usd");

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        
        {/* Header & Stats Section - Matching Member Page */}
        <div className="mb-12 sm:mb-16">
          <div className="mb-10">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground mb-2">
              Payment Dashboard
            </h1>
            <p className="text-muted-foreground">Manage user payments and transfers</p>
          </div>

          {/* Ledger Stats - Minimalist Inline Style */}
          {ledgerLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : ledgerAccount ? (
            <div className="flex flex-wrap items-center gap-8 sm:gap-12 mb-8">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Available Balance</p>
                <p className="text-3xl sm:text-4xl font-display font-bold text-primary">
                  ${usdBalance?.balance?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Pending Balance</p>
                <p className="text-3xl sm:text-4xl font-display font-bold text-secondary">
                  ${usdBalance?.pending_balance?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Transfer Fee</p>
                <p className="text-3xl sm:text-4xl font-display font-bold text-accent">
                  {ledgerAccount.transfer_fee ? `${(ledgerAccount.transfer_fee * 100).toFixed(1)}%` : "None"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
                <p className="text-3xl sm:text-4xl font-display font-bold text-success">
                  {ledgerAccount.payments_approval_status === "approved" ? "✓" : ledgerAccount.payments_approval_status}
                </p>
              </div>
            </div>
          ) : (
            <Alert className="bg-muted border-border mb-8">
              <AlertDescription className="text-foreground">
                Unable to load ledger account information
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* User Search Section */}
        <div className="mb-12 sm:mb-16">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">
              Find User
            </h2>
            <p className="text-sm text-muted-foreground">Enter a Whop user ID to look up user information</p>
          </div>

          <div className="flex gap-3 mb-6">
            <Input
              type="text"
              placeholder="user_xxxxxxxxxxxxx"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="bg-card border-border text-foreground flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button 
              onClick={handleSearch}
              disabled={!userId.trim() || userLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
            >
              {userLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {userError && (
            <Alert className="bg-muted border-border mb-6">
              <AlertDescription className="text-foreground">
                User not found or error retrieving user data
              </AlertDescription>
            </Alert>
          )}

          {userData && (
            <div className="bg-card border border-border rounded-xl p-6 mb-6">
              <div className="flex items-center gap-4 mb-4">
                {userData.profile_picture?.url ? (
                  <img 
                    src={userData.profile_picture.url} 
                    alt={userData.username}
                    className="w-14 h-14 rounded-full ring-1 ring-border/50 object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center ring-1 ring-border/50">
                    <User className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="text-xl font-medium text-foreground">@{userData.username}</p>
                  {userData.name && <p className="text-sm text-muted-foreground">{userData.name}</p>}
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 border-t border-border pt-4">
                <p>User ID: <span className="text-foreground font-mono">{userData.id}</span></p>
                <p>Member since: <span className="text-foreground">{new Date(userData.created_at).toLocaleDateString()}</span></p>
                {userData.bio && <p className="text-foreground italic mt-2">"{userData.bio}"</p>}
              </div>
            </div>
          )}
        </div>

        {/* Payment Form */}
        {userData && ledgerAccount && (
          <div className="mb-12 sm:mb-16">
            <div className="mb-6">
              <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-2">
                Send Payment
              </h2>
              <p className="text-sm text-muted-foreground">Transfer funds to @{userData.username}</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="amount" className="text-foreground text-sm">Amount (USD)</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-card border-border text-foreground text-lg h-12"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="notes" className="text-foreground text-sm">Notes (Optional)</Label>
                <Input
                  id="notes"
                  type="text"
                  placeholder="Payment description"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={50}
                  className="bg-card border-border text-foreground"
                />
                <p className="text-xs text-muted-foreground">Maximum 50 characters</p>
              </div>

              <Button
                onClick={handleTransfer}
                disabled={!amount || transferMutation.isPending}
                className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold py-6 text-base"
              >
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processing Transfer...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-5 w-5" />
                    Send ${amount || "0.00"} to @{userData.username}
                  </>
                )}
              </Button>

              {ledgerAccount.transfer_fee && amount && (
                <Alert className="bg-muted border-border">
                  <AlertDescription className="text-foreground text-sm">
                    Transfer fee: ${(parseFloat(amount || "0") * ledgerAccount.transfer_fee).toFixed(2)} 
                    ({(ledgerAccount.transfer_fee * 100).toFixed(1)}%)
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
