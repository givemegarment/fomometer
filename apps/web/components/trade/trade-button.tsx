'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button-variants';
import { JUP_REFERRAL_ACCOUNT, JUP_REFERRAL_FEE_BPS, LAMPORTS_PER_SOL, SOL_MINT, TRADING_ENABLED } from '@/lib/trade';
import { cn } from '@/lib/cn';

const PLUGIN_SRC = 'https://plugin.jup.ag/plugin-v1.js';

type JupiterPlugin = {
  init: (props: {
    displayMode: 'modal';
    formProps: {
      initialInputMint: string;
      initialOutputMint: string;
      /** In the input token's smallest unit (lamports for SOL). */
      initialAmount?: string;
      referralAccount: string;
      referralFee: number;
    };
  }) => void;
};

declare global {
  interface Window {
    Jupiter?: JupiterPlugin;
  }
}

let loading: Promise<JupiterPlugin> | null = null;

/** Loads the Jupiter Plugin script once, on the first click, so pages without a click pay nothing. */
function loadPlugin(): Promise<JupiterPlugin> {
  if (window.Jupiter) return Promise.resolve(window.Jupiter);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PLUGIN_SRC;
    s.async = true;
    s.onload = () => (window.Jupiter ? resolve(window.Jupiter) : reject(new Error('Jupiter missing')));
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error('Jupiter failed to load'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Opens Jupiter's swap window: SOL into this token to buy, the token into SOL to sell. The
 * visitor connects and signs in their own wallet; the referral fee goes to FOMOMETER. Renders
 * nothing until a referral account is configured.
 */
export function TradeButton({
  address,
  label,
  side = 'buy',
  amountSol,
  size = 'lg',
  quiet = false,
  className
}: {
  address: string;
  label: string;
  side?: 'buy' | 'sell';
  /** Prefills the SOL amount of a buy. */
  amountSol?: number;
  size?: 'sm' | 'md' | 'lg';
  /** Secondary look, for rows where a column of green buttons would shout. */
  quiet?: boolean;
  className?: string;
}) {
  const t = useTranslations('trade');
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  if (!TRADING_ENABLED) return null;

  const open = async () => {
    setState('loading');
    try {
      const jup = await loadPlugin();
      const buy = side === 'buy';
      jup.init({
        displayMode: 'modal',
        formProps: {
          initialInputMint: buy ? SOL_MINT : address,
          initialOutputMint: buy ? address : SOL_MINT,
          initialAmount: buy && amountSol ? String(Math.round(amountSol * LAMPORTS_PER_SOL)) : undefined,
          referralAccount: JUP_REFERRAL_ACCOUNT,
          referralFee: JUP_REFERRAL_FEE_BPS
        }
      });
      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={state === 'loading'}
        aria-busy={state === 'loading'}
        className={buttonVariants({ variant: quiet ? 'secondary' : 'primary', size, className: cn(size === 'lg' && 'w-full', className) })}
      >
        {state === 'loading' ? t('opening') : label}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {t('load_error')}
        </p>
      )}
    </>
  );
}
