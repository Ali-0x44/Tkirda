/**
 * Send-side flow control for the DataChannel.
 *
 * WebRTC DataChannels expose an unbounded bufferedAmount once they are open —
 * feeding the native socket faster than the receiver drains it can balloon
 * memory. We therefore pause sending while `bufferedAmount` is above a high
 * water mark and resume once it drops below a low water mark.
 */

export const FLOW = {
  HIGH_WATER: 1024 * 1024, // pause above 1 MiB
  LOW_WATER: 256 * 1024, // resume below 256 KiB
  POLL_MS: 100,
} as const;

export type FlowChannel = {
  bufferedAmount: number;
  readyState: string;
};

/**
 * Resolve as soon as the channel buffer is below the low water mark (or if
 * the buffer is not measurable). The caller must re-check channel readiness
 * after resuming — a channel can close while we wait.
 */
export function waitForBuffer(channel: FlowChannel): Promise<void> {
  const amount = channel.bufferedAmount;
  if (!Number.isFinite(amount) || amount <= FLOW.LOW_WATER) {
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    const timer = setInterval(() => {
      if (channel.readyState !== 'open') {
        clearInterval(timer);
        resolve();
        return;
      }
      if (channel.bufferedAmount <= FLOW.LOW_WATER) {
        clearInterval(timer);
        resolve();
      }
    }, FLOW.POLL_MS);
  });
}

/** True while `bufferedAmount` is above the high water mark. */
export function isThrottled(channel: FlowChannel): boolean {
  return Number.isFinite(channel.bufferedAmount) && channel.bufferedAmount > FLOW.HIGH_WATER;
}