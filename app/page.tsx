"use client";

import { useEffect } from 'react';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { base } from 'viem/chains';
import { useMiniKit } from '@farcaster/miniapp-sdk';
import CryptoTerminal from '../bloomberg-terminal';
import "../app/globals.css";

export default function Page() {
  const { setFrameReady } = useMiniKit();

  useEffect(() => {
    setFrameReady();
  }, [setFrameReady]);

  return (
    <OnchainKitProvider apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY} chain={base} miniKit={{ enabled: true }}>
      <CryptoTerminal />
    </OnchainKitProvider>
  );
}
