'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { buttonVariants } from '@/components/ui/button-variants';
import { JUP_REFERRAL_ACCOUNT, JUP_REFERRAL_FEE_BPS, SOL_MINT, TRADING_ENABLED } from '@/lib/trade';
import { cn } from '@/lib/cn';

const PLUGIN_SRC = 'https://plugin.jup.ag/plugin-v1.js';

type JupiterPlugin = {
  init: (props: {
    displayMode: 'modal';
    formProps: { initialInputMint: string; initialOutputMint: string; referralAccount: string; referralFee: number };
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
 * Opens Jupiter's swap window with SOL in and this token out. The visitor connects and signs
 * in their own wallet; the referral fee goes to FOMOMETER. Renders nothing until a referral
 * account is configured.
 */
export function BuyButton({
  address,
  label,
  size = 'lg',
  quiet = false,
  className
}: {
  address: string;
  label: string;
  size?: 'sm' | 'lg';
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
      jup.init({
        displayMode: 'modal',
        formProps: {
          initialInputMint: SOL_MINT,
          initialOutputMint: address,
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
