"use client"

import { OnchainKitProvider } from "@coinbase/onchainkit"
import type { ReactNode } from "react"
import { base } from "wagmi/chains"

export function MiniKitContextProvider({ children, apiKey }: { children: ReactNode; apiKey?: string }) {
  return (
    <OnchainKitProvider apiKey={apiKey} chain={base} miniKit={{ enabled: true }}>
      {children}
    </OnchainKitProvider>
  )
}
