'use client'

import dynamic from 'next/dynamic'

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false }
)

export function WalletButton() {
  return (
    <WalletMultiButton className="!flex !items-center !gap-3 !px-3 !py-2.5 !rounded-lg !text-sm !font-medium !transition-all !text-muted-foreground hover:!text-foreground hover:!bg-white/60 !bg-transparent !border-0 !shadow-none !h-auto !w-full !justify-start" />
  )
}
