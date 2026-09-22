import {PeerLink, type PeerLinkEvents, type DataChannelLike} from './PeerLink';
import type {Uid} from '../models';

/**
 * Registry of live PeerLinks. Guarantees a single link per peer — if a
 * channel arrives for a peer that already has a link (e.g. a race where both
 * sides offered), the newcomer channel is closed and the existing link kept.
 */
export class PeerLinkManager {
  private links = new Map<Uid, PeerLink>();

  constructor(readonly myUid: Uid) {}

  get size(): number {
    return this.links.size;
  }

  get(peerId: Uid): PeerLink | undefined {
    return this.links.get(peerId);
  }

  has(peerId: Uid): boolean {
    return this.links.has(peerId);
  }

  attach(
    peerId: Uid,
    channel: DataChannelLike,
    events: PeerLinkEvents,
    opts: {idleMs?: number; heartbeatMs?: number} = {},
  ): PeerLink {
    const existing = this.links.get(peerId);
    if (existing) {
      try {
        channel.close();
      } catch {
        // already closed
      }
      return existing;
    }
    const link = new PeerLink(this.myUid, peerId, channel, events, opts);
    this.links.set(peerId, link);
    return link;
  }

  remove(peerId: Uid): void {
    this.links.delete(peerId);
  }

  closeAll(reason = 'manager_close'): void {
    for (const link of this.links.values()) link.close(reason);
    this.links.clear();
  }
}