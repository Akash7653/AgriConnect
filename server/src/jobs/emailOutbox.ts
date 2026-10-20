import { processEmailOutbox } from '../services/email.js';

export function startEmailOutboxJob(): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    void processEmailOutbox().catch(() => {
      console.error('Email outbox worker failed.');
    });
  }, 15_000);
  timer.unref();
  return timer;
}
