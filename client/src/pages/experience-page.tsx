import { useEffect, useState, useCallback } from "react";
import { useRoute } from "wouter";
import Game from "../components/game/Game";
import { AlertCircle, Smartphone, Monitor, Bell, CheckCircle } from "lucide-react";

export interface UserProfile {
  id: string;
  username: string;
  name: string | null;
  profilePicture: string | null;
}

interface DeviceClassification {
  decision: "allow" | "block";
  reason: string;
  capabilities: {
    userAgent: string;
    platform: string;
    isMobileUA: boolean;
    isDesktopPlatform: boolean;
    maxTouchPoints: number;
    hasFinePointer: boolean;
    hasCoarsePointer: boolean;
    screenWidth: number;
  };
}

function classifyDevice(): DeviceClassification {
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const platform = navigator.platform || "";
  
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const isMobileUA = mobileRegex.test(userAgent.toLowerCase());
  
  const desktopPlatformRegex = /win|mac|linux/i;
  const isDesktopPlatform = desktopPlatformRegex.test(platform) || 
    /windows|macintosh|linux/i.test(userAgent);
  
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  const hasTouchCapability = maxTouchPoints > 0;
  const hasFinePointer = window.matchMedia?.("(pointer: fine)")?.matches || false;
  const hasCoarsePointer = window.matchMedia?.("(any-pointer: coarse)")?.matches || false;
  const screenWidth = window.innerWidth;
  
  const capabilities = {
    userAgent: userAgent.substring(0, 100),
    platform,
    isMobileUA,
    isDesktopPlatform,
    maxTouchPoints,
    hasFinePointer,
    hasCoarsePointer,
    screenWidth,
  };
  
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("force-desktop") === "true") {
    return { decision: "allow", reason: "Override: force-desktop flag", capabilities };
  }
  
  if (isMobileUA) {
    return { decision: "block", reason: "Mobile/tablet user agent detected", capabilities };
  }
  
  if (hasFinePointer) {
    return { decision: "allow", reason: "Device has fine pointer (mouse/trackpad)", capabilities };
  }
  
  if (hasTouchCapability || hasCoarsePointer) {
    return { decision: "block", reason: "Touch-capable device without mouse", capabilities };
  }
  
  if (!hasTouchCapability && !hasCoarsePointer) {
    return { decision: "allow", reason: "No touch capability detected", capabilities };
  }
  
  return { decision: "block", reason: "Unknown device type (conservative block)", capabilities };
}

function isMobileDevice(): boolean {
  const classification = classifyDevice();
  
  console.log(`[Device Detection] ${classification.decision.toUpperCase()}: ${classification.reason}`, classification.capabilities);
  
  return classification.decision === "block";
}

function getDeviceInfo() {
  const fingerprint = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
  ].join("|");
  
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    deviceFingerprint: `device_${Math.abs(hash).toString(36)}`,
  };
}

export default function ExperiencePage() {
  const [match, params] = useRoute("/experiences/:experienceId");
  const [matchWildcard, paramsWildcard] = useRoute("/experiences/:experienceId/*");
  
  const experienceId = params?.experienceId || paramsWildcard?.experienceId || "";
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [notifySubmitting, setNotifySubmitting] = useState(false);
  const [notifySuccess, setNotifySuccess] = useState<string | null>(null);

  const handleNotifyMe = useCallback(async () => {
    setNotifySubmitting(true);
    try {
      const response = await fetch("/api/mobile-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ deviceInfo: getDeviceInfo() }),
      });
      
      const data = await response.json();
      if (data.success) {
        setNotifySuccess(data.message);
      }
    } catch (err) {
      console.error("Failed to register for notification:", err);
    } finally {
      setNotifySubmitting(false);
    }
  }, []);

  useEffect(() => {
    const mobile = isMobileDevice();
    setIsMobile(mobile);
    
    if (mobile) {
      setIsVerifying(false);
      return;
    }

    async function verifyAccess() {
      if (!experienceId) {
        console.log("Waiting for experienceId...");
        return;
      }

      sessionStorage.removeItem("session_token");
      sessionStorage.removeItem("user_id");

      try {
        const response = await fetch("/api/check-access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ experienceId }),
        });

        if (response.status === 401) {
          setError("Authentication required. Please access this app through Whop.");
          setIsVerifying(false);
          return;
        }

        if (response.status === 400) {
          const data = await response.json();
          setError(data.error || "Invalid request");
          setIsVerifying(false);
          return;
        }

        if (!response.ok) {
          throw new Error("Access verification failed");
        }

        const data = await response.json();
        
        if (data.hasAccess) {
          setHasAccess(true);
          setUserToken(data.sessionToken || "authenticated");
          sessionStorage.setItem("user_id", data.userId);
          sessionStorage.setItem("session_token", data.sessionToken || "");
          
          if (data.userProfile) {
            setUserProfile(data.userProfile);
            sessionStorage.setItem("user_profile", JSON.stringify(data.userProfile));
          }
        } else {
          setError("You don't have access to this experience. Please purchase access through Whop.");
        }
      } catch (err) {
        console.error("Access verification error:", err);
        setError("Failed to verify access. Please try again or contact support.");
      } finally {
        setIsVerifying(false);
      }
    }

    verifyAccess();
  }, [experienceId]);

  if (isVerifying) {
    return (
      <div 
        className="h-screen w-full flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0f1a3d 100%)"
        }}
      >
        <div className="flex flex-col items-center gap-4">
          <div 
            className="w-10 h-10 rounded-full animate-spin-smooth"
            style={{
              border: "3px solid rgba(79, 209, 255, 0.2)",
              borderTopColor: "rgba(79, 209, 255, 0.8)",
            }}
          />
          <p className="text-sm text-cyan-400/80 font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div 
        className="h-screen w-full flex items-center justify-center p-6"
        style={{
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0f1a3d 100%)"
        }}
      >
        <div className="text-center max-w-md">
          <div className="relative mb-6">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center border border-violet-500/30">
              <Smartphone className="h-10 w-10 text-violet-400" />
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center border border-red-500/30">
              <AlertCircle className="h-4 w-4 text-red-400" />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">Not Available on Mobile</h1>
          <p className="text-gray-400 mb-6 leading-relaxed">
            This game requires a keyboard and mouse to play. 
            Please visit on a computer for the best experience.
          </p>
          
          <div className="flex items-center justify-center gap-3 mb-8 text-sm">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Monitor className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">Desktop</span>
            </div>
            <span className="text-gray-600">or</span>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Monitor className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400">Laptop</span>
            </div>
          </div>

          {notifySuccess ? (
            <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
              <span className="text-emerald-400 text-sm">{notifySuccess}</span>
            </div>
          ) : (
            <button
              onClick={handleNotifyMe}
              disabled={notifySubmitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                boxShadow: "0 4px 20px rgba(139, 92, 246, 0.3)",
              }}
            >
              {notifySubmitting ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Bell className="h-4 w-4" />
                  <span>Let me know when it's ready</span>
                </>
              )}
            </button>
          )}

          <p className="mt-4 text-xs text-gray-500">
            We're working on mobile support. Click above to get notified!
          </p>
        </div>
      </div>
    );
  }

  if (error && !hasAccess) {
    return (
      <div 
        className="h-screen w-full flex items-center justify-center p-4"
        style={{
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0f1a3d 100%)"
        }}
      >
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-sm text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  return <Game experienceId={experienceId} userToken={userToken} userProfile={userProfile} />;
}
