import { useWhopUser } from "@/hooks/use-whop-user";
import { useUserActiveGame, useUser } from "@/hooks/use-user";
import { useGameParticipants, useLeaveGame } from "@/hooks/use-games";
import { useWhopPayments } from "@/hooks/use-whop-payments";
import { useWithdrawals } from "@/hooks/use-withdrawals";
import { useActiveTournaments, useUserActiveTournaments } from "@/hooks/use-tournaments";
import { useAccessCheck } from "@/hooks/use-access-check";
import { Button } from "@/components/ui/button";
import { WithdrawalDialog } from "@/components/withdrawal-dialog";
import InvitePlayersModal from "@/components/invite-players-modal";
import WelcomeBonusManager from "@/components/welcome-bonus-manager";
import { Plus, Download, Timer, Trophy, Wallet, Gamepad2, Loader2, History, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useBalanceUpdates, authenticateWebSocket } from "@/hooks/use-websocket";


export default function GameLobby() {
  const { user: whopUser, isLoading: whopLoading, error: whopError } = useWhopUser();
  const { data: user, isLoading: userLoading } = useUser();
  const { data: activeGame } = useUserActiveGame();
  const { data: participants } = useGameParticipants(activeGame?.id || "");
  const leaveGame = useLeaveGame();
  const { makePayment, isPaymentPending, isRealPaymentsAvailable } = useWhopPayments();
  const { availableForWithdrawal } = useWithdrawals();
  const { toast } = useToast();
  const [gameTimer, setGameTimer] = useState(154); // 2:34 in seconds
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<number | null>(null);
  const [location, setLocation] = useLocation();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [joiningTournamentId, setJoiningTournamentId] = useState<string | null>(null);

  const [resourceIds] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    
    let companyId = params.get('companyId') || undefined;
    let experienceId = params.get('experienceId') || undefined;
    
    if (!companyId && !experienceId) {
      if (pathParts[0] === 'dashboard' && pathParts[1]?.startsWith('biz_')) {
        companyId = pathParts[1];
      } else if (pathParts[0] === 'experiences' && pathParts[1]?.startsWith('exp_')) {
        experienceId = pathParts[1];
      }
    }
    
    return { companyId, experienceId };
  });

  const { isAdmin } = useAccessCheck({
    companyId: resourceIds.companyId,
    experienceId: resourceIds.experienceId,
  });

  const { data: activeTournaments } = useActiveTournaments();
  const { data: userActiveTournaments } = useUserActiveTournaments(whopUser?.id);
  
  const shouldShowMultiplayerGames = isAdmin;

  // Listen for real-time balance updates via WebSocket
  useBalanceUpdates(whopUser?.id);

  // Authenticate WebSocket when user is available
  useEffect(() => {
    if (whopUser?.id && whopUser?.username) {
      authenticateWebSocket(whopUser.id, whopUser.username);
    }
  }, [whopUser?.id, whopUser?.username]);

  // Track page view
  useEffect(() => {
    const trackPageView = async () => {
      try {
        await fetch('/api/analytics/page-view', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            pagePath: '/',
          }),
        });
      } catch (error) {
        // Silently fail - don't interrupt user experience
        console.debug('Page view tracking failed:', error);
      }
    };
    
    trackPageView();
  }, []);

  // Auto-navigate to game room when user has an active running game
  useEffect(() => {
    if (activeGame?.status === "running") {
      if (activeGame.gameType === "chess") {
        setLocation(`/chess/${activeGame.id}`);
      } else if (activeGame.gameType === "yahtzee") {
        setLocation(`/game/${activeGame.id}`);
      }
    }
  }, [activeGame, setLocation]);

  // Auto-redirect to tournament waiting room if user is in an active tournament
  useEffect(() => {
    if (userActiveTournaments && userActiveTournaments.length > 0 && !activeGame) {
      const activeTournament = userActiveTournaments[0];
      // Only redirect if the tournament is still active or started (not completed/cancelled)
      if (activeTournament.status === 'active' || activeTournament.status === 'started') {
        console.log(`Auto-redirecting to tournament waiting room: ${activeTournament.id}`);
        setLocation(`/tournament/${activeTournament.id}/waiting`);
      }
    }
  }, [userActiveTournaments, activeGame, setLocation]);

  // Create fallback user for development when authentication fails
  const fallbackUser = {
    id: "demo-user-123",
    username: "DemoPlayer",
    email: "demo@example.com",
    balance: "100.00",
    totalWinnings: "25.50",
    gamesPlayed: 8,
    gamesWon: 3,
    profileImageUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80"
  };

  // Wait for real user data to load first, only use fallback if auth actually failed
  const hasRealUserData = user || whopUser;
  const isStillLoading = whopLoading || userLoading;
  const authFailed = !isStillLoading && !hasRealUserData && whopError;

  // Use actual user data if available, otherwise use fallback only after auth fails
  const currentUser = hasRealUserData || (authFailed ? fallbackUser : null);

  // Loading states - show loading until we have real user data or confirmed auth failure
  const isLoading = isStillLoading || (!hasRealUserData && !authFailed);
  const hasError = false; // Always use fallback in development, so no errors


  useEffect(() => {
    if (activeGame?.status === "running") {
      const timer = setInterval(() => {
        setGameTimer((prev) => {
          if (prev <= 0) {
            return 154; // Reset timer
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [activeGame?.status]);

  const handleLeaveGame = async () => {
    if (!activeGame) return;

    try {
      await leaveGame.mutateAsync({ gameId: activeGame.id });
      toast({
        title: "Left game successfully",
        description: "You've been refunded the entry fee.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to leave game. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show loading screen if waiting for data
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080b12' }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
            <Gamepad2 className="w-8 h-8 text-background" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2 tracking-tight">Loading ElevenWin...</h2>
          <p className="text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Show error screen if unable to load user data
  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080b12' }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-destructive to-accent rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg">
            <Gamepad2 className="w-8 h-8 text-destructive-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2 tracking-tight">Connection Error</h2>
          <p className="text-muted-foreground">Unable to load user data</p>
        </div>
      </div>
    );
  }

  // Ensure we have user data before rendering the main component
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#080b12' }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-secondary rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-primary/30 animate-pulse">
            <Gamepad2 className="w-8 h-8 text-background" />
          </div>
          <h2 className="text-2xl font-display font-bold text-foreground mb-2 tracking-tight">Loading ElevenWin...</h2>
          <p className="text-muted-foreground">Initializing user session</p>
        </div>
      </div>
    );
  }

  const handleAddFunds = async (amount: number) => {
    try {
      setPendingAmount(amount);
      await makePayment({
        amount,
        description: "ElevenWin",
        metadata: { type: "game_credits" },
      });
      setShowAddFunds(false);
      toast({
        title: "Funds added successfully!",
        description: `$${amount} has been added to your account.`,
      });
    } catch (error) {
      // Error is already handled by useWhopPayments hook
    } finally {
      setPendingAmount(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
        {/* User Profile & Stats - Minimalist Layout */}
        <div className="mb-12 sm:mb-16">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-10">
            {/* Left: Profile Info */}
            <div className="flex items-center gap-4">
              <img 
                src={currentUser.profileImageUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=80&h=80"} 
                alt="Profile" 
                className="w-14 h-14 rounded-full object-cover ring-1 ring-border/50"
                data-testid="profile-avatar"
              />
              <div className="min-w-0">
                <h2 className="text-xl font-medium text-foreground mb-1" data-testid="profile-username">
                  {currentUser.username}
                </h2>
                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">Balance</span>
                  <span className="text-lg font-semibold text-primary" data-testid="profile-balance">
                    ${parseFloat(currentUser.balance).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {showAddFunds ? (
                <>
                  <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
                    <button 
                      onClick={() => handleAddFunds(5)}
                      disabled={(pendingAmount === 5) || !isRealPaymentsAvailable}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                      data-testid="button-add-5"
                    >
                      {pendingAmount === 5 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$5"}
                    </button>
                    <button 
                      onClick={() => handleAddFunds(10)}
                      disabled={(pendingAmount === 10) || !isRealPaymentsAvailable}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                      data-testid="button-add-10"
                    >
                      {pendingAmount === 10 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$10"}
                    </button>
                    <button 
                      onClick={() => handleAddFunds(25)}
                      disabled={(pendingAmount === 25) || !isRealPaymentsAvailable}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                      data-testid="button-add-25"
                    >
                      {pendingAmount === 25 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$25"}
                    </button>
                    <button 
                      onClick={() => handleAddFunds(50)}
                      disabled={(pendingAmount === 50) || !isRealPaymentsAvailable}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1 text-sm" 
                      data-testid="button-add-50"
                    >
                      {pendingAmount === 50 ? <Loader2 className="w-4 h-4 animate-spin" /> : "$50"}
                    </button>
                  </div>
                  <button 
                    onClick={() => setShowAddFunds(false)}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-4 py-2.5 rounded-lg font-semibold transition-colors text-sm"
                    data-testid="button-cancel-add-funds"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <WelcomeBonusManager />
                  
                  <button 
                    onClick={() => setShowAddFunds(true)}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-semibold transition-colors text-sm sm:text-base shadow-md hover:shadow-lg" 
                    data-testid="button-add-funds"
                  >
                    <Plus className="w-4 h-4 mr-2 inline" />
                    Deposit
                  </button>

                  <WithdrawalDialog>
                    <button 
                      className="bg-secondary hover:bg-secondary/90 text-secondary-foreground px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base shadow-md hover:shadow-lg"
                      data-testid="button-withdraw"
                    >
                      <Download className="w-4 h-4" />
                      <span>Withdraw</span>
                    </button>
                  </WithdrawalDialog>
                </>
              )}

              {!isRealPaymentsAvailable && showAddFunds && (
                <div className="text-info text-xs px-3 py-2">
                  🔄 Connecting to payment system...
                </div>
              )}
            </div>
          </div>

          {/* Performance Stats - Inline Minimalist */}
          <div className="flex flex-wrap items-center gap-8 sm:gap-12">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Total Winnings</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-green-500" data-testid="stat-total-winnings">
                ${parseFloat(currentUser.totalWinnings).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Games Played</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-primary" data-testid="stat-games-played">
                {currentUser.gamesPlayed}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Games Won</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-secondary" data-testid="stat-games-won">
                {currentUser.gamesWon}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Win Rate</p>
              <p className="text-3xl sm:text-4xl font-display font-bold text-accent" data-testid="stat-win-rate">
                {currentUser.gamesPlayed > 0 ? ((currentUser.gamesWon / currentUser.gamesPlayed) * 100).toFixed(1) : 0}%
              </p>
            </div>
          </div>
        </div>


        {/* Active Game Section */}
        <div className="mb-12 sm:mb-16">
            {activeGame ? (
              <div className="space-y-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-1" data-testid="active-game-name">
                      {activeGame.name}
                    </h2>
                    <p className="text-sm text-muted-foreground">Active Competition</p>
                  </div>
                  <div className={`px-4 py-2 text-xs font-bold uppercase tracking-wide ${
                    activeGame.status === "running" 
                      ? "text-success animate-pulse" 
                      : "text-warning"
                  }`} data-testid="active-game-status">
                    {activeGame.status === "running" ? "🔴 LIVE NOW" : "⏳ Starting Soon"}
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-8 sm:gap-12">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Entry Fee</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-accent" data-testid="active-game-entry-fee">
                      ${parseFloat(activeGame.entryFee).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Prize Pool</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-success" data-testid="active-game-prize">
                      ${parseFloat(activeGame.prizeAmount).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Players</p>
                    <p className="text-2xl sm:text-3xl font-display font-bold text-primary" data-testid="active-game-player-count">
                      {activeGame.currentPlayers}/{activeGame.maxPlayers}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xl font-display font-bold text-foreground mb-4">Battle Arena</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {participants?.map((participant, index) => (
                      <div key={participant.id} className="text-center">
                        <img 
                          src={participant.user?.profileImageUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60"} 
                          alt={`Player ${index + 1}`} 
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover mx-auto mb-2"
                          data-testid={`participant-avatar-${index}`}
                        />
                        <p className={`text-xs sm:text-sm font-medium truncate ${
                          participant.userId === currentUser?.id ? 'text-primary' : 'text-foreground'
                        }`} data-testid={`participant-name-${index}`}>
                          {participant.user?.username || "Unknown"}
                        </p>
                        {participant.userId === user?.id && (
                          <p className="text-xs text-primary font-bold mt-0.5">YOU</p>
                        )}
                      </div>
                    ))}

                    {Array.from({ length: activeGame.maxPlayers - activeGame.currentPlayers }).map((_, index) => (
                      <div key={`empty-${index}`} className="text-center">
                        <button
                          onClick={() => setIsInviteModalOpen(true)}
                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted mx-auto mb-2 flex items-center justify-center hover:bg-primary/20 transition-colors"
                        >
                          <Plus className="w-5 h-5 text-muted-foreground hover:text-primary" />
                        </button>
                        <p className="text-xs text-muted-foreground">Open Slot</p>
                      </div>
                    ))}
                  </div>
                </div>

                {activeGame.status === "running" ? (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6">
                    <div>
                      <p className="text-lg font-display font-bold text-success">Battle in Progress</p>
                      <p className="text-success text-sm">Competition is live!</p>
                    </div>
                    <div className="text-center">
                      <p className="text-4xl font-display font-bold text-success" data-testid="game-timer">
                        {formatTime(gameTimer)}
                      </p>
                      <p className="text-success text-xs">Time remaining</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 pt-6">
                    <div className="text-center py-4">
                      <p className="text-sm text-warning font-medium">Waiting for more players to join...</p>
                      <p className="text-warning text-xs mt-1">Game starts when lobby is full</p>
                    </div>
                    <button 
                      className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold py-3 px-6 transition-colors text-sm sm:text-base"
                      onClick={handleLeaveGame}
                      disabled={leaveGame.isPending}
                      data-testid="button-leave-game"
                    >
                      {leaveGame.isPending ? "Leaving Game..." : "Leave Game"}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div>
                {/* Tournaments Section */}
                <div className="mb-12 sm:mb-16">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                      Active Tournaments
                    </h2>
                    <Button
                      onClick={() => setLocation("/match-history")}
                      variant="outline"
                      className="text-primary hover:bg-primary/10"
                      size="sm"
                    >
                      <History className="w-4 h-4 mr-2" />
                      Match History
                    </Button>
                  </div>
                  
                  {activeTournaments && activeTournaments.length > 0 ? (
                    <div className="space-y-10">
                      {activeTournaments.map((tournament) => (
                        <div key={tournament.id} className="space-y-6">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                              <h3 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-1">
                                {tournament.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {tournament.gameType.charAt(0).toUpperCase() + tournament.gameType.slice(1)} Tournament
                                {tournament.description && ` • ${tournament.description}`}
                              </p>
                            </div>
                            <div className="text-xs font-bold uppercase tracking-wide text-accent animate-pulse">
                              🔥 LIVE
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-8 sm:gap-12">
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
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Players</p>
                              <p className="text-2xl sm:text-3xl font-display font-bold text-secondary">
                                {tournament.currentParticipants}/{tournament.maxParticipants}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Slots Left</p>
                              <p className="text-2xl sm:text-3xl font-display font-bold text-accent">
                                {tournament.maxParticipants - tournament.currentParticipants}
                              </p>
                            </div>
                          </div>

                          <button 
                            onClick={async () => {
                              if (isAdmin) {
                                if (tournament.gameType === 'yahtzee') {
                                  setLocation('/yahtzee');
                                } else if (tournament.gameType === 'chess') {
                                  setLocation('/chess');
                                }
                              } else if (tournament.isParticipant) {
                                // User already joined, take them to waiting room
                                setLocation(`/tournament/${tournament.id}/waiting`);
                              } else {
                                // User hasn't joined yet, join the tournament
                                setJoiningTournamentId(tournament.id);
                                try {
                                  const response = await fetch(`/api/tournaments/${tournament.id}/join`, {
                                    method: "POST",
                                    credentials: "include",
                                  });

                                  if (!response.ok) {
                                    if (response.status === 409) {
                                      toast({
                                        title: "Already Joined",
                                        description: "Taking you to the waiting room...",
                                      });
                                      setLocation(`/tournament/${tournament.id}/waiting`);
                                      return;
                                    }
                                    
                                    const error = await response.json();
                                    toast({
                                      title: "Error",
                                      description: error.message || "Failed to join tournament",
                                      variant: "destructive",
                                    });
                                    return;
                                  }

                                  toast({
                                    title: "Joined Tournament",
                                    description: `You've joined ${tournament.name}!`,
                                  });
                                  setLocation(`/tournament/${tournament.id}/waiting`);
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to join tournament. Please try again.",
                                    variant: "destructive",
                                  });
                                } finally {
                                  setJoiningTournamentId(null);
                                }
                              }
                            }}
                            disabled={joiningTournamentId === tournament.id}
                            className={`w-full font-bold py-3 px-6 rounded-lg transition-colors text-sm sm:text-base flex items-center justify-center gap-2 ${
                              tournament.isParticipant 
                                ? 'bg-success hover:bg-success/90 text-background' 
                                : 'bg-accent hover:bg-accent/90 text-accent-foreground'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {joiningTournamentId === tournament.id ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Joining...
                              </>
                            ) : (
                              <>
                                {isAdmin ? "Manage Tournament" : tournament.isParticipant ? "Go to Waiting Room" : "Join Tournament Now"}
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-16 text-center">
                      <Trophy className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                      <h3 className="text-xl font-bold text-muted-foreground mb-2">
                        No Tournaments Yet
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        Check back soon for exciting competitions or try out instant games below!
                      </p>
                    </div>
                  )}
                </div>

                {/* Instant Games Section */}
                <div className="mb-12 sm:mb-16">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                      Instant Games
                    </h2>
                    <div className="text-xs font-semibold uppercase tracking-wide text-success">
                      LIVE
                    </div>
                  </div>
                  <div className="space-y-4">
                    {/* Slots - Now First */}
                    <button 
                      onClick={() => setLocation("/slots")}
                      className="w-full flex items-center gap-6 p-5 hover:bg-muted/20 transition-colors"
                    >
                      <img src="/src/slots.png" alt="Slots" className="w-16 h-16 object-contain" />
                      <div className="flex-1 text-left">
                        <h3 className="text-2xl font-display font-bold text-foreground mb-1">Slots</h3>
                        <p className="text-muted-foreground text-sm">Spin to win big prizes!</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-2xl font-display font-bold text-accent">Up to 50x!</span>
                        <span className="text-xs text-muted-foreground">Solo Game</span>
                      </div>
                    </button>

                    {/* Plinko - Now Second */}
                    <button 
                      onClick={() => setLocation("/plinko")}
                      className="w-full flex items-center gap-6 p-5 hover:bg-muted/20 transition-colors"
                    >
                      <img src="/src/plinko.png" alt="Plinko" className="w-16 h-16 object-contain" />
                      <div className="flex-1 text-left">
                        <h3 className="text-2xl font-display font-bold text-foreground mb-1">Plinko</h3>
                        <p className="text-muted-foreground text-sm">Drop the ball & win instantly!</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-2xl font-display font-bold text-primary">Up to 3x!</span>
                        <span className="text-xs text-muted-foreground">Solo Game</span>
                      </div>
                    </button>

                    {/* Dice - Now Third */}
                    <button 
                      onClick={() => setLocation("/dice")}
                      className="w-full flex items-center gap-6 p-5 hover:bg-muted/20 transition-colors"
                    >
                      <img src="/src/dice.png" alt="Dice" className="w-16 h-16 object-contain" />
                      <div className="flex-1 text-left">
                        <h3 className="text-2xl font-display font-bold text-foreground mb-1">Dice Roll</h3>
                        <p className="text-muted-foreground text-sm">Over or under? You decide!</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-2xl font-display font-bold text-secondary">Up to 96x!</span>
                        <span className="text-xs text-muted-foreground">Solo Game</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Multiplayer Games Section - Only show if admin or there's an active tournament */}
                {shouldShowMultiplayerGames && (
                <div className="mb-12 sm:mb-16">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl sm:text-3xl font-display font-bold text-foreground">
                      Multiplayer Games
                    </h2>
                    <button
                      onClick={() => setLocation('/match-history')}
                      className="text-primary hover:opacity-80 text-xs sm:text-sm transition-opacity flex items-center gap-1.5"
                      data-testid="button-match-history"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Match History</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
                    {/* Yahtzee */}
                    <button 
                      onClick={() => setLocation("/yahtzee")}
                      className="text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="text-5xl mb-3">🎲</div>
                      <h3 className="text-xl font-display font-bold text-foreground mb-1">Yahtzee</h3>
                      <p className="text-muted-foreground text-sm mb-3">Roll dice & score strategically!</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">2-5 Players</span>
                        <span className="text-sm font-bold text-success">Winner takes all!</span>
                      </div>
                    </button>

                    {/* Chess */}
                    <button 
                      onClick={() => setLocation("/chess")}
                      className="text-left hover:opacity-80 transition-opacity"
                    >
                      <div className="text-5xl mb-3">♟️</div>
                      <h3 className="text-xl font-display font-bold text-foreground mb-1">Chess</h3>
                      <p className="text-muted-foreground text-sm mb-3">Outsmart your opponent!</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">2 Players</span>
                        <span className="text-sm font-bold text-primary">Winner takes all!</span>
                      </div>
                    </button>

                    {/* Poker - Coming Soon */}
                    <div className="text-left opacity-50">
                      <div className="text-5xl mb-3">🃏</div>
                      <h3 className="text-xl font-display font-bold text-foreground mb-1">Poker</h3>
                      <p className="text-muted-foreground text-sm mb-3">Texas Hold'em tournaments!</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">2-8 Players</span>
                        <span className="text-xs text-accent">Coming Soon</span>
                      </div>
                    </div>

                    {/* Tic-Tac-Toe - Coming Soon */}
                    <div className="text-left opacity-50">
                      <div className="text-5xl mb-3">⭕</div>
                      <h3 className="text-xl font-display font-bold text-foreground mb-1">Tic-Tac-Toe</h3>
                      <p className="text-muted-foreground text-sm mb-3">Fast-paced strategy game!</p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">2 Players</span>
                        <span className="text-xs text-accent">Coming Soon</span>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}
          </div>

      </div>

      {/* Invite Players Modal */}
      {activeGame && (
        <InvitePlayersModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          gameId={activeGame.id}
          gameName={activeGame.name}
          shareUrl={`https://whop.com/joined/compete-and-earn/compete-and-earn-dice-royale-${activeGame.id}/app/`}
        />
      )}
    </div>
  );
}