import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import { startBackgroundMusic } from "@/lib/sounds";

interface LoadingScreenProps {
  onLoaded: () => void;
}

export default function LoadingScreen({ onLoaded }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing...");
  const [isReady, setIsReady] = useState(false);

  const handleStartClick = useCallback(() => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.requestPointerLock();
    }
    onLoaded();
  }, [onLoaded]);

  useEffect(() => {
    const assets = [
      { path: "/textures/grass.jpg", name: "Terrain" },
      { path: "/textures/wood.jpg", name: "Environment" },
    ];

    let loaded = 0;
    const total = assets.length + 2;

    const loadAsset = async (asset: { path: string; name: string }) => {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          loaded++;
          setProgress(Math.floor((loaded / total) * 100));
          setStatus(`Loading ${asset.name}...`);
          resolve();
        };
        img.onerror = () => {
          loaded++;
          setProgress(Math.floor((loaded / total) * 100));
          resolve();
        };
        img.src = asset.path;
      });
    };

    const loadAll = async () => {
      setStatus("Loading assets...");
      setProgress(10);
      
      await new Promise(resolve => setTimeout(resolve, 80));
      
      setStatus("Creating weapons...");
      setProgress(30);
      loaded++;
      
      await new Promise(resolve => setTimeout(resolve, 80));
      
      await Promise.all(assets.map((asset) => loadAsset(asset)));
      
      setStatus("Setting up arena...");
      setProgress(80);
      loaded++;
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      setStatus("Ready!");
      setProgress(100);
      
      setTimeout(() => {
        setIsReady(true);
        startBackgroundMusic();
      }, 300);
    };

    loadAll();
  }, []);

  return (
    <AnimatePresence>
      <motion.div 
        className="h-screen w-full flex flex-col items-center justify-center"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          zIndex: 9999,
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 50%, #0f1a3d 100%)"
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="text-center mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 p-0.5">
              <div className="w-full h-full rounded-lg bg-gray-900 flex items-center justify-center">
                <Gamepad2 className="h-5 w-5 text-cyan-400" />
              </div>
            </div>
            <h1 className="text-2xl font-black">
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-500 bg-clip-text text-transparent">
                ARENA SHOOTER
              </span>
            </h1>
          </div>
        </motion.div>

        {!isReady ? (
          <motion.div 
            className="w-64 sm:w-80"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
              <motion.div 
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #06b6d4, #3b82f6, #8b5cf6)",
                }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
            
            <div className="flex justify-between items-center text-xs">
              <motion.span 
                className="text-cyan-400/80"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {status}
              </motion.span>
              <span className="text-gray-500 font-mono">{progress}%</span>
            </div>
          </motion.div>
        ) : (
          <motion.button
            onClick={handleStartClick}
            className="px-8 py-4 rounded-xl font-bold text-lg text-white cursor-pointer border-none"
            style={{
              background: "linear-gradient(135deg, #06b6d4, #3b82f6, #8b5cf6)",
              boxShadow: "0 0 30px rgba(59, 130, 246, 0.5)",
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            CLICK TO START
          </motion.button>
        )}

        <motion.div 
          className="mt-6 flex flex-wrap justify-center gap-3 text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {[
            { key: "WASD", action: "Move" },
            { key: "Mouse", action: "Aim" },
            { key: "Click", action: "Shoot" },
            { key: "Right Click", action: "Scope" },
            { key: "Shift", action: "Crouch" },
            { key: "R", action: "Reload" },
          ].map(({ key, action }) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-gray-800 text-cyan-400 font-mono text-[10px]">{key}</span>
              <span className="text-gray-500">{action}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
