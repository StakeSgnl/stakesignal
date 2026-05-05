'use client'

import { useMemo, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { RPC_URL } from '@/lib/constants'

import '@solana/wallet-adapter-react-ui/styles.css'

// Type assertions to fix React 18/19 type incompatibility with wallet adapter
const Connection = ConnectionProvider as any
const Wallet = WalletProvider as any
const WalletModal = WalletModalProvider as any

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], [])

  return (
    <Connection endpoint={RPC_URL}>
      <Wallet wallets={wallets} autoConnect>
        <WalletModal>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WalletModal>
      </Wallet>
    </Connection>
  )
}
