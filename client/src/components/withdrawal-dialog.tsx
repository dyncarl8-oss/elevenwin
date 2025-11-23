import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWithdrawals } from "@/hooks/use-withdrawals";
import { useUser } from "@/hooks/use-user";
import { Banknote, Clock, CheckCircle, AlertTriangle, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface WithdrawalDialogProps {
  children: React.ReactNode;
}

export function WithdrawalDialog({ children }: WithdrawalDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const { 
    requestWithdrawal, 
    isRequestingWithdrawal, 
    withdrawalHistory, 
    isLoadingWithdrawals,
    availableForWithdrawal,
    isLoadingTransactions
  } = useWithdrawals();
  const { data: user } = useUser();

  const handleWithdrawal = async (withdrawAmount?: number) => {
    try {
      const finalAmount = withdrawAmount || parseFloat(amount);
      if (finalAmount <= 0) return;
      
      await requestWithdrawal(finalAmount);
      setAmount("");
      setOpen(false);
    } catch (error) {
      // Error handling is done by the hook
    }
  };

  const quickAmounts = [25, 50, 100, 250];
  const availableQuickAmounts = quickAmounts.filter(amt => 
    availableForWithdrawal >= amt
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getStatusBadge = (description: string) => {
    if (description.includes("Pending")) {
      return (
        <Badge variant="secondary">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="default">
        <CheckCircle className="w-3 h-3 mr-1" />
        Processed
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] bg-background border-border overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2 text-foreground">
            <Banknote className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold">Withdraw Funds</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="withdraw" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted border border-border">
            <TabsTrigger value="withdraw" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Banknote className="w-4 h-4 mr-2" />
              Withdraw
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <History className="w-4 h-4 mr-2" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="withdraw" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Balance
                  </CardTitle>
                  <div className="text-2xl font-bold text-primary">
                    ${user ? parseFloat(user.balance).toFixed(2) : "0.00"}
                  </div>
                </CardHeader>
              </Card>
              
              <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Available to Withdraw
                  </CardTitle>
                  <div className="text-2xl font-bold text-primary">
                    {isLoadingTransactions ? "..." : availableForWithdrawal >= 20 ? `$${availableForWithdrawal.toFixed(2)}` : "Need $20 min"}
                  </div>
                </CardHeader>
              </Card>
            </div>

            {availableForWithdrawal >= 20 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-foreground font-medium">Withdrawal Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount..."
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="20"
                    max={availableForWithdrawal.toString()}
                    step="0.01"
                    className="bg-card border-border text-foreground"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum withdrawal: $20.00
                  </p>
                </div>

                {availableQuickAmounts.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-foreground font-medium">Quick Amounts</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {availableQuickAmounts.map((quickAmount) => (
                        <Button
                          key={quickAmount}
                          variant="outline"
                          size="sm"
                          onClick={() => handleWithdrawal(quickAmount)}
                          disabled={isRequestingWithdrawal}
                          className="text-xs bg-muted border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all font-semibold"
                        >
                          ${quickAmount}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-muted border border-border rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-foreground">
                      <p className="font-semibold mb-1.5">How withdrawals work:</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li>• Your app balance will be deducted immediately</li>
                        <li>• Money will be sent to your Whop account within 24-48 hours</li>
                        <li>• All withdrawals are processed manually for security</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleWithdrawal()}
                  disabled={!amount || parseFloat(amount) < 20 || isRequestingWithdrawal || (user && parseFloat(amount) > parseFloat(user.balance))}
                  className="w-full"
                  size="lg"
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  {isRequestingWithdrawal ? "Processing..." : "Request Withdrawal"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <div className="bg-muted border border-border rounded-lg p-4">
                  <div className="flex items-center justify-center space-x-2 mb-3">
                    <AlertTriangle className="w-6 h-6 text-primary" />
                    <h3 className="font-semibold text-foreground text-lg">Minimum Amount Required</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    You need at least $20.00 to withdraw. Keep playing and winning to reach the minimum!
                  </p>
                  <p className="text-xs text-muted-foreground font-medium">
                    Current balance: ${availableForWithdrawal.toFixed(2)} • Need: ${(20 - availableForWithdrawal).toFixed(2)} more
                  </p>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ScrollArea className="h-[300px] pr-4">
              {isLoadingWithdrawals ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                      <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/4"></div>
                    </div>
                  ))}
                </div>
              ) : withdrawalHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <History className="w-10 h-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium">No withdrawals yet</p>
                  <p className="text-xs mt-1">Your withdrawal history will appear here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {withdrawalHistory.map((withdrawal) => (
                    <Card key={withdrawal.id} className="bg-card border-border hover:bg-muted/50 transition-all">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-lg text-foreground">
                            {withdrawal.amount}
                          </div>
                          {getStatusBadge(withdrawal.description)}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>{withdrawal.description}</p>
                          <p>{formatDate(withdrawal.createdAt)}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}