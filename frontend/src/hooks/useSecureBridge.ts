// src/hooks/useSecureBridge.ts
import { useEffect, useState } from "react";
import { SecureBridge } from "@/lib/secureBridge"; // Matches your file structure
import { SecureIdentitiesService } from "@/client"; // Assuming you generate this service

// Singleton instance
const bridgeInstance = new SecureBridge();
let isInitialized = false;

export function useSecureBridge() {
  const [ready, setReady] = useState(isInitialized);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (isInitialized) {
        setReady(true);
        return;
      }

      try {
        // Fetch public key from your Python backend
        // Adjust this call based on your actual generated client
        const response = await SecureIdentitiesService.getPublicKey();
        await bridgeInstance.initialize(response.public_key);
        
        isInitialized = true;
        setReady(true);
      } catch (err) {
        console.error("SecureBridge Init Failed:", err);
        setError("Encryption service unavailable.");
      }
    }

    init();
  }, []);

  return { bridge: bridgeInstance, ready, error };
}