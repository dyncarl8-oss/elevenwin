import { useState } from "react";
import { useWhopUser } from "@/hooks/use-whop-user";
import { useUser } from "@/hooks/use-user";
import { useAccessCheck } from "@/hooks/use-access-check";
import { useTournaments, useCreateTournament, useUpdateTournamentStatus, useStartTournament, useNotifyTournamentMembers } from "@/hooks/use-tournaments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WithdrawalDialog } from "@/components/withdrawal-dialog";
import { Trophy, Plus, Loader2, AlertCircle, Calendar, Users, DollarSign, Shield, Bell, CheckCircle, Banknote, HelpCircle, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { useWithdrawals } from "@/hooks/use-withdrawals";

export default function TournamentDashboard() {
  const [, setLocation] = useLocation();
  const { user: whopUser, isLoading: whopUserLoading } = useWhopUser();
  const { data: user, isLoading: userLoading } = useUser();
  const { availableForWithdrawal, isLoadingTransactions } = useWithdrawals();
  const [resourceIds] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    
    let companyId = params.get('companyId') || undefined;
    let experienceId = params.get('experienceId') || undefined;
    
    if (!companyId && !experienceId) {
      if (pathParts[0] === 'tournaments' && pathParts[1]?.startsWith('biz_')) {
        companyId = pathParts[1];
      } else if (pathParts[0] === 'tournaments' && pathParts[1]?.startsWith('exp_')) {
        experienceId = pathParts[1];
      }
    }
    
    return { companyId, experienceId };
  });

  const { isAdmin, isLoading: accessLoading } = useAccessCheck({
    companyId: resourceIds.companyId,
    experienceId: resourceIds.experienceId,
  });

  const { data: tournaments, isLoading: tournamentsLoading } = useTournaments();
  const createTournament = useCreateTournament();
  const updateStatus = useUpdateTournamentStatus();
  const startTournament = useStartTournament();
  const notifyMembers = useNotifyTournamentMembers();

  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
  const [createdTournament, setCreatedTournament] = useState<any>(null);
  const [cancellingTournamentId, setCancellingTournamentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    gameType: "yahtzee",
    name: "",
    entryFee: "",
    maxParticipants: "5",
  });

  const ADMIN_COMMISSION_RATE = 0.10; // 10% admin commission
  const PRIZE_POOL_RATE = 0.75; // 75% goes to winner
  
  const calculatePrizePool = () => {
    const entryFee = parseFloat(formData.entryFee) || 0;
    const maxParticipants = parseInt(formData.maxParticipants) || 0;
    const totalEntryFees = entryFee * maxParticipants;
    return (totalEntryFees * PRIZE_POOL_RATE).toFixed(2);
  };

  const calculateAdminCommission = () => {
    const entryFee = parseFloat(formData.entryFee) || 0;
    const maxParticipants = parseInt(formData.maxParticipants) || 0;
    const totalEntryFees = entryFee * maxParticipants;
    return (totalEntryFees * ADMIN_COMMISSION_RATE).toFixed(2);
  };

  if (accessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Card className="bg-gray-800 border-gray-700 max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
              <p className="text-gray-400 mb-4">You must be an admin to access this page.</p>
              <Button onClick={() => setLocation("/")} className="bg-blue-600 hover:bg-blue-700">
                Return to Lobby
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateTournament = async () => {
    try {
      const tournament = await createTournament.mutateAsync({
        gameType: formData.gameType,
        name: formData.name,
        potAmount: calculatePrizePool(),
        entryFee: parseFloat(formData.entryFee).toFixed(2),
        maxParticipants: parseInt(formData.maxParticipants),
        companyId: resourceIds.companyId,
        experienceId: resourceIds.experienceId,
      });
      
      setCreatedTournament(tournament);
      setIsCreateDialogOpen(false);
      setIsSuccessDialogOpen(true);
      setFormData({
        gameType: "yahtzee",
        name: "",
        entryFee: "",
        maxParticipants: "5",
      });
    } catch (error) {
      console.error("Failed to create tournament:", error);
    }
  };

  const handleNotifyMembers = async () => {
    if (createdTournament?.id) {
      try {
        await notifyMembers.mutateAsync(createdTournament.id);
        setCreatedTournament({
          ...createdTournament,
          notificationSent: true,
          notificationSentAt: new Date()
        });
      } catch (error) {
        console.error("Failed to notify members:", error);
      }
    }
  };

  const handleUpdateStatus = async (tournamentId: string, status: string) => {
    try {
      setCancellingTournamentId(tournamentId);
      await updateStatus.mutateAsync({ 
        tournamentId, 
        status,
        companyId: resourceIds.companyId,
        experienceId: resourceIds.experienceId
      });
    } catch (error) {
      console.error("Failed to update tournament status:", error);
    } finally {
      setCancellingTournamentId(null);
    }
  };

  const handleStartTournament = async (tournamentId: string) => {
    try {
      await startTournament.mutateAsync({
        tournamentId,
        companyId: resourceIds.companyId,
        experienceId: resourceIds.experienceId
      });
    } catch (error) {
      console.error("Failed to start tournament:", error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "started":
        return "bg-amber-500";
      case "completed":
        return "bg-blue-500";
      case "cancelled":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const filteredTournaments = tournaments?.filter(t => {
    if (statusFilter === "all") return true;
    if (statusFilter === "active") return t.status === "active" || t.status === "started";
    return t.status === statusFilter;
  }) || [];

  const statusCounts = {
    all: tournaments?.length ?? 0,
    active: tournaments?.filter(t => t.status === "active" || t.status === "started")?.length ?? 0,
    completed: tournaments?.filter(t => t.status === "completed")?.length ?? 0,
    cancelled: tournaments?.filter(t => t.status === "cancelled")?.length ?? 0,
  };

  const isHeaderLoading = whopUserLoading || userLoading;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        {/* Admin Header - Minimalist Style */}
        <div className="mb-12 sm:mb-16">
          {isHeaderLoading ? (
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-10">
              <div className="flex items-center gap-4">
                <Skeleton className="w-14 h-14 rounded-full" />
                <div className="min-w-0 space-y-2">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <Skeleton className="h-12 w-32" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-10">
              <div className="flex items-center gap-4">
                <img 
                  src={whopUser?.profileImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80"} 
                  alt="Admin Profile" 
                  className="w-14 h-14 rounded-full object-cover ring-1 ring-border/50"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-medium text-foreground">
                      {whopUser?.username || "Admin"}
                    </h2>
                    <span className="bg-primary px-2 py-0.5 rounded-md text-xs font-semibold text-primary-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      ADMIN
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-wide">Balance</span>
                    <span className="text-lg font-semibold text-primary">
                      ${user ? parseFloat(user.balance).toFixed(2) : "0.00"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <WithdrawalDialog>
                  <button 
                    className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!user || isLoadingTransactions || availableForWithdrawal < 20}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Withdraw</span>
                  </button>
                </WithdrawalDialog>
              </div>
            </div>
          )}

          {/* Stats Bar - Inline Minimalist */}
          <div className="flex flex-wrap items-center gap-8 sm:gap-12">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Total Tournaments</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-primary">
                {tournaments?.length || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Active Now</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-green-500">
                {statusCounts.active}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Completed</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-secondary">
                {statusCounts.completed}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Cancelled</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-accent">
                {statusCounts.cancelled}
              </p>
            </div>
          </div>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground max-w-md">
              <DialogHeader className="pb-3">
                <DialogTitle className="text-xl font-bold">Create New Tournament</DialogTitle>
                <DialogDescription className="text-muted-foreground text-sm">
                  Set up a new tournament for your members to compete
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="gameType" className="text-sm font-medium">Game Type</Label>
                    <Select value={formData.gameType} onValueChange={(value) => setFormData({ 
                      ...formData, 
                      gameType: value,
                      maxParticipants: value === "chess" ? "2" : "5"
                    })}>
                      <SelectTrigger className="bg-muted border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="yahtzee">Yahtzee</SelectItem>
                        <SelectItem value="chess">Chess</SelectItem>
                        <SelectItem value="poker" disabled>
                          <span className="flex items-center justify-between w-full">
                            <span>Poker</span>
                            <span className="text-xs text-muted-foreground ml-2">(Coming Soon)</span>
                          </span>
                        </SelectItem>
                        <SelectItem value="tictactoe" disabled>
                          <span className="flex items-center justify-between w-full">
                            <span>Tic Tac Toe</span>
                            <span className="text-xs text-muted-foreground ml-2">(Coming Soon)</span>
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="maxParticipants" className="text-sm font-medium">Players</Label>
                    {formData.gameType === "chess" ? (
                      <Input
                        id="maxParticipants"
                        type="text"
                        value="2"
                        disabled
                        className="bg-muted border-border cursor-not-allowed"
                      />
                    ) : (
                      <Select 
                        value={formData.maxParticipants} 
                        onValueChange={(value) => setFormData({ ...formData, maxParticipants: value })}
                      >
                        <SelectTrigger className="bg-muted border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border">
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">Tournament Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Weekly Championship"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="bg-muted border-border placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="entryFee" className="text-sm font-medium">Entry Fee ($)</Label>
                  <Input
                    id="entryFee"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5.00"
                    value={formData.entryFee}
                    onChange={(e) => setFormData({ ...formData, entryFee: e.target.value })}
                    className="bg-muted border-border placeholder:text-muted-foreground"
                  />
                </div>

                {formData.entryFee && parseFloat(formData.entryFee) > 0 && (
                  <div className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-green-500 mb-2">Tournament Financials</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs text-muted-foreground">Prize Pool</p>
                        <p className="text-base font-bold text-green-500">${calculatePrizePool()}</p>
                        <p className="text-xs text-muted-foreground">75% of total</p>
                      </div>
                      <div className="bg-muted/50 rounded p-2">
                        <p className="text-xs text-muted-foreground">Your Earnings</p>
                        <p className="text-base font-bold text-primary">${calculateAdminCommission()}</p>
                        <p className="text-xs text-muted-foreground">10% commission</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Total: ${((parseFloat(formData.entryFee) || 0) * (parseInt(formData.maxParticipants) || 0)).toFixed(2)} 
                      <span className="opacity-50"> • </span>
                      {formData.maxParticipants} × ${(parseFloat(formData.entryFee) || 0).toFixed(2)}
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="gap-2 pt-3">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="bg-muted border-border text-foreground hover:bg-muted/70"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateTournament}
                  disabled={createTournament.isPending || !formData.name || !formData.entryFee}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {createTournament.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Tournament"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        {/* Filter Section */}
        <div className="mb-12 sm:mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
              Manage Tournaments
            </h2>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {tournamentsLoading ? (
                <>
                  <Skeleton className="h-9 w-[90px] rounded-lg" />
                  <Skeleton className="h-9 w-[110px] rounded-lg" />
                  <Skeleton className="h-9 w-[105px] rounded-lg" />
                  <Skeleton className="h-9 w-[75px] rounded-lg" />
                </>
              ) : (
                <>
                  <Button
                    onClick={() => setStatusFilter("active")}
                    variant="outline"
                    className={statusFilter === "active" 
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 border-primary" 
                      : "border-border text-foreground hover:bg-muted"}
                    size="sm"
                  >
                    Active ({statusCounts.active})
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("completed")}
                    variant="outline"
                    className={statusFilter === "completed" 
                      ? "bg-secondary text-secondary-foreground hover:bg-secondary/90 border-secondary" 
                      : "border-border text-foreground hover:bg-muted"}
                    size="sm"
                  >
                    Completed ({statusCounts.completed})
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("cancelled")}
                    variant="outline"
                    className={statusFilter === "cancelled" 
                      ? "bg-accent text-accent-foreground hover:bg-accent/90 border-accent" 
                      : "border-border text-foreground hover:bg-muted"}
                    size="sm"
                  >
                    Cancelled ({statusCounts.cancelled})
                  </Button>
                  <Button
                    onClick={() => setStatusFilter("all")}
                    variant="outline"
                    className={statusFilter === "all" 
                      ? "bg-foreground text-background hover:bg-foreground/90" 
                      : "border-border text-foreground hover:bg-muted"}
                    size="sm"
                  >
                    All ({statusCounts.all})
                  </Button>
                </>
              )}
            </div>
            
            {tournamentsLoading ? (
              <Skeleton className="h-9 w-[180px] rounded-xl" />
            ) : (
              <div className="flex gap-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline"
                      className="border-border text-foreground hover:bg-muted"
                      size="sm"
                    >
                      <HelpCircle className="w-4 h-4 mr-2" />
                      How It Works
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border text-foreground max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Trophy className="h-6 w-6 text-primary" />
                        How It Works
                      </DialogTitle>
                      <DialogDescription className="text-muted-foreground text-base">
                        Quick guide to managing tournaments and earning commissions
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-5 mt-4">
                      {/* What This Platform Does */}
                      <div className="bg-gradient-to-r from-primary/20 to-secondary/20 p-4 rounded-lg border border-primary/30">
                        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          What This Platform Does
                        </h3>
                        <p className="text-foreground text-sm leading-relaxed">
                          This platform lets you host gaming tournaments for your members. Members pay an entry fee, compete, and winners get prize money. 
                          You earn 10% commission from every game, keeping your community engaged while making money.
                        </p>
                      </div>

                      {/* Revenue Breakdown */}
                      <div className="bg-muted/50 p-4 rounded-lg border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                          <DollarSign className="h-5 w-5 text-green-500" />
                          Where the Money Goes
                        </h3>
                        <div className="space-y-2 text-foreground">
                          <p className="text-sm">Entry fees get split like this:</p>
                          <div className="bg-card/50 rounded-lg p-3 space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-foreground">Prize Pool (Winner)</span>
                              <span className="font-bold text-green-500">75%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-foreground">Your Commission</span>
                              <span className="font-bold text-primary">10%</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-foreground">Platform Fee</span>
                              <span className="font-bold text-muted-foreground">15%</span>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-2">
                            Your 10% is added to your balance automatically after each game. Withdraw anytime using the Withdraw button.
                          </p>
                        </div>
                      </div>

                      {/* Creating Tournaments */}
                      <div className="bg-muted/50 p-4 rounded-lg border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Plus className="h-5 w-5 text-primary" />
                          Creating Tournaments
                        </h3>
                        <div className="space-y-2 text-foreground">
                          <p className="text-sm">Click "Create Tournament" and set these up:</p>
                          <ul className="space-y-1.5 ml-4 text-sm">
                            <li className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span><strong>Game:</strong> Yahtzee, Chess, etc.</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span><strong>Name:</strong> Something catchy for your tournament</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span><strong>Entry Fee:</strong> How much members pay to join</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="text-primary">•</span>
                              <span><strong>Players:</strong> 2-5 players (Chess is locked to 2)</span>
                            </li>
                          </ul>
                          <p className="text-sm text-muted-foreground mt-2">
                            The form shows exactly how much the winner gets and how much you'll earn.
                          </p>
                        </div>
                      </div>

                      {/* How Tournaments Work */}
                      <div className="bg-muted/50 p-4 rounded-lg border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-secondary" />
                          How Tournaments Work
                        </h3>
                        <div className="space-y-2 text-foreground text-sm">
                          <p><strong>After Creation:</strong> Your tournament shows up in the Active tab where members can join.</p>
                          <p><strong>Auto-Start:</strong> When the tournament fills up with all players, it automatically starts. No button needed.</p>
                          <p><strong>Games:</strong> Members play their games, and the winner gets the prize pool added to their balance.</p>
                          <p><strong>Your Cut:</strong> Your 10% commission gets added to your balance automatically.</p>
                          <p><strong>Cancelling:</strong> Cancel anytime before it fills up. Members get refunded automatically.</p>
                        </div>
                      </div>

                      {/* Notifying Members */}
                      <div className="bg-muted/50 p-4 rounded-lg border border-border">
                        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Bell className="h-5 w-5 text-primary" />
                          Notifying Members
                        </h3>
                        <div className="space-y-2 text-foreground">
                          <p className="text-sm">
                            After creating a tournament, click <strong>"Notify All Members"</strong> in the success popup. 
                            This sends a push notification to everyone in your community about the new tournament.
                          </p>
                          <p className="text-sm text-muted-foreground">
                            You can only notify once per tournament, so make sure it's ready before sending.
                          </p>
                        </div>
                      </div>

                      {/* Quick Tips */}
                      <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 p-4 rounded-lg border border-green-500/30">
                        <h3 className="text-lg font-semibold text-foreground mb-2">Quick Tips</h3>
                        <ul className="space-y-1.5 text-foreground text-sm">
                          <li className="flex items-start gap-2">
                            <span className="text-green-500">•</span>
                            <span>Host tournaments regularly to keep members active and maximize earnings</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500">•</span>
                            <span>Test different entry fees to find what works for your community</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500">•</span>
                            <span>Always notify members about new tournaments to boost participation</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500">•</span>
                            <span>Use the filter tabs (Active, Completed, Cancelled) to track everything</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-green-500">•</span>
                            <span>Check your balance regularly and withdraw whenever you want</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button 
                  onClick={() => setIsCreateDialogOpen(true)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-2.5 rounded-xl font-semibold shadow-md"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Tournament
                </Button>
              </div>
            )}
          </div>
        </div>

        {tournamentsLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-6 w-48" />
                    <Skeleton className="h-4 w-64" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
                <div className="flex flex-wrap items-center gap-8">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-8 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : filteredTournaments.length > 0 ? (
          <div className="space-y-6">
            {filteredTournaments.map((tournament) => (
              <div key={tournament.id} className="bg-card border border-border rounded-xl p-6 hover:border-primary/50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-display font-bold text-foreground mb-2">
                      {tournament.name}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-primary" />
                      {tournament.gameType.charAt(0).toUpperCase() + tournament.gameType.slice(1)} Tournament
                      {tournament.description && <span>• {tournament.description}</span>}
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(tournament.status)} text-white whitespace-nowrap`}>
                    {getStatusText(tournament.status)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-8 sm:gap-12 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Prize Pool</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-green-500">
                      ${parseFloat(tournament.potAmount).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Entry Fee</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-primary">
                      ${parseFloat(tournament.entryFee).toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">{tournament.status === "completed" ? "Earnings" : "Est. Earnings"}</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-accent">
                      ${(parseFloat(tournament.entryFee) * tournament.maxParticipants * ADMIN_COMMISSION_RATE).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">10% commission</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Players</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-secondary">
                      {tournament.currentParticipants}/{tournament.maxParticipants}
                    </p>
                    {(tournament.status === "active" || tournament.status === "started") && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tournament.status === "started" 
                          ? "Game in progress" 
                          : tournament.currentParticipants === 0 
                            ? "Waiting for players" 
                            : "Auto-starts when full"}
                      </p>
                    )}
                  </div>
                </div>

                {(tournament.status === "active" || tournament.status === "started") && (
                  <div className="flex justify-end pt-4 border-t border-border">
                    <Button
                      onClick={() => handleUpdateStatus(tournament.id, "cancelled")}
                      disabled={cancellingTournamentId === tournament.id}
                      variant="destructive"
                      className="shadow-md"
                    >
                      {cancellingTournamentId === tournament.id ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Cancelling...
                        </>
                      ) : (
                        "Cancel Tournament"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-6 flex items-center justify-center">
              <Trophy className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-2">
              {statusFilter === "all" ? "No Tournaments Yet" : `No ${getStatusText(statusFilter)} Tournaments`}
            </h3>
            <p className="text-muted-foreground mb-6 text-sm sm:text-base">
              {statusFilter === "all" 
                ? "Create your first tournament to get started" 
                : `There are no ${statusFilter} tournaments at this time`}
            </p>
            {(statusFilter === "all" || statusFilter === "active") && (
              <Button
                onClick={() => setIsCreateDialogOpen(true)}
                className="bg-accent hover:bg-accent/90 text-accent-foreground px-6 py-3 shadow-md"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Tournament
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Success Modal */}
      <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
        <DialogContent 
          className="bg-card border-border text-foreground max-w-2xl"
          hideCloseButton
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-2xl">Tournament Created Successfully!</DialogTitle>
                <DialogDescription className="text-muted-foreground">
                  Your tournament is now live and ready for your members
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {createdTournament && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h3 className="text-xl font-bold text-foreground">{createdTournament.name}</h3>
                {createdTournament.description && (
                  <p className="text-sm text-muted-foreground">{createdTournament.description}</p>
                )}
                
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="bg-card/50 rounded p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Trophy className="h-3 w-3" />
                      <span>Game Type</span>
                    </div>
                    <p className="text-foreground font-semibold capitalize">{createdTournament.gameType}</p>
                  </div>
                  
                  <div className="bg-card/50 rounded p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Users className="h-3 w-3" />
                      <span>Max Players</span>
                    </div>
                    <p className="text-foreground font-semibold">{createdTournament.maxParticipants}</p>
                  </div>
                  
                  <div className="bg-card/50 rounded p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <DollarSign className="h-3 w-3" />
                      <span>Entry Fee</span>
                    </div>
                    <p className="text-green-500 font-bold">${createdTournament.entryFee}</p>
                  </div>
                  
                  <div className="bg-card/50 rounded p-3">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                      <Trophy className="h-3 w-3" />
                      <span>Prize Pool</span>
                    </div>
                    <p className="text-green-500 font-bold">${createdTournament.potAmount}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Bell className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-primary mb-1">Notify Team Members</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Send a notification to all members about this new tournament
                    </p>
                    <Button
                      onClick={handleNotifyMembers}
                      disabled={notifyMembers.isPending || createdTournament.notificationSent}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                      size="sm"
                    >
                      {notifyMembers.isPending ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : createdTournament.notificationSent ? (
                        <>
                          <CheckCircle className="w-3 h-3 mr-2" />
                          Notification Sent
                        </>
                      ) : (
                        <>
                          <Bell className="w-3 h-3 mr-2" />
                          Notify All Members
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setIsSuccessDialogOpen(false)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
