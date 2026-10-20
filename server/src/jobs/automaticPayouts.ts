import { processAutomaticPayouts } from '../services/automaticPayouts.js';

export function startAutomaticPayoutJob(): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    void processAutomaticPayouts().catch((error: unknown) => {
      console.error('Automatic payout worker failed:', error instanceof Error ? error.message : 'Unknown error');
    });
  }, 60_000);
  timer.unref();
  return timer;
}
