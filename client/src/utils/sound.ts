/**
 * AgriConnect Audio Synthesizer
 * Generates an authentic, crisp success payment chime using Web Audio API
 */
export const playPaymentSuccessSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Elegant 4-note ascending payment chime (C5 -> E5 -> G5 -> C6)
    const notes = [
      { freq: 523.25, time: 0.0, duration: 0.22, gain: 0.25 }, // C5
      { freq: 659.25, time: 0.09, duration: 0.25, gain: 0.28 }, // E5
      { freq: 783.99, time: 0.18, duration: 0.32, gain: 0.3 },  // G5
      { freq: 1046.5, time: 0.30, duration: 0.65, gain: 0.35 }, // C6 (crisp bell finish)
    ];

    notes.forEach(({ freq, time, duration, gain: targetGain }) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      // Rich bell-like overtone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

      // Smooth attack and natural exponential decay
      gainNode.gain.setValueAtTime(0.0001, ctx.currentTime + time);
      gainNode.gain.exponentialRampToValueAtTime(targetGain, ctx.currentTime + time + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + time + duration);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime + time);
      osc.stop(ctx.currentTime + time + duration);
    });
  } catch (err) {
    console.warn('Payment success audio error:', err);
  }
};
