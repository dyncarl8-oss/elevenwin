import { useEffect } from "react";
import { KeyboardControls } from "@react-three/drei";
import { useGameStore } from "@/lib/stores/useGameStore";
import { useGameSocket } from "@/hooks/useGameSocket";
import { startBackgroundMusic, stopBackgroundMusic } from "@/lib/sounds";
import Lobby from "./Lobby";
import GameScene from "./GameScene";
import GameOver from "./GameOver";
import type { UserProfile } from "@/pages/experience-page";

enum Controls {
  forward = "forward",
  back = "back",
  left = "left",
  right = "right",
  jump = "jump",
  crouch = "crouch",
  shoot = "shoot",
  scope = "scope",
  weapon1 = "weapon1",
  weapon2 = "weapon2",
  reload = "reload",
}

const keyMap = [
  { name: Controls.forward, keys: ["KeyW", "ArrowUp"] },
  { name: Controls.back, keys: ["KeyS", "ArrowDown"] },
  { name: Controls.left, keys: ["KeyA", "ArrowLeft"] },
  { name: Controls.right, keys: ["KeyD", "ArrowRight"] },
  { name: Controls.jump, keys: ["Space"] },
  { name: Controls.crouch, keys: ["ShiftLeft", "ShiftRight"] },
  { name: Controls.shoot, keys: ["Mouse0"] },
  { name: Controls.scope, keys: ["Mouse2"] },
  { name: Controls.weapon1, keys: ["Digit1"] },
  { name: Controls.weapon2, keys: ["Digit2"] },
  { name: Controls.reload, keys: ["KeyR"] },
];

interface GameProps {
  experienceId: string;
  userToken: string | null;
  userProfile: UserProfile | null;
}

export default function Game({ experienceId, userToken, userProfile }: GameProps) {
  const { phase } = useGameStore();
  const { sendMessage } = useGameSocket(experienceId, userToken);

  useEffect(() => {
    const gameKeys = new Set([
      "KeyW", "KeyA", "KeyS", "KeyD",
      "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
      "Space", "KeyR",
      "Digit1", "Digit2",
      "ControlLeft", "ControlRight"
    ]);

    const preventBrowserShortcuts = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'w' || key === 'q' || key === 't' || key === 'n' || key === 'r') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          return false;
        }
      }
    };

    const preventGameKeyDefaults = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.code === "KeyW" || e.code === "KeyQ" || e.code === "KeyT" || e.code === "KeyN")) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return;
      }

      if (gameKeys.has(e.code)) {
        if (e.ctrlKey || e.code === "ControlLeft" || e.code === "ControlRight") {
          e.preventDefault();
        }
        if (e.code === "Space") {
          e.preventDefault();
        }
      }
    };

    document.addEventListener("keydown", preventBrowserShortcuts, { capture: true, passive: false });
    window.addEventListener("keydown", preventGameKeyDefaults, true);

    return () => {
      document.removeEventListener("keydown", preventBrowserShortcuts, { capture: true } as EventListenerOptions);
      window.removeEventListener("keydown", preventGameKeyDefaults, true);
    };
  }, []);

  useEffect(() => {
    if (phase === "lobby") {
      stopBackgroundMusic();
    }
  }, [phase]);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", overflow: "hidden" }}>
      <KeyboardControls map={keyMap}>
        {phase === "lobby" && <Lobby sendMessage={sendMessage} userProfile={userProfile} />}
        {(phase === "waiting" || phase === "playing") && <GameScene sendMessage={sendMessage} />}
        {phase === "finished" && <GameOver sendMessage={sendMessage} />}
      </KeyboardControls>
    </div>
  );
}

export { Controls };
