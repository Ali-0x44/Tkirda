import Constants from 'expo-constants';

/**
 * ICE configuration from `app.config.ts` extras (ENV-driven) with sensible
 * defaults. TURN/STUN are optional: host candidates work on local networks.
 */
export type IceConfig = {
  stunServer: string;
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
};

const DEFAULTS: IceConfig = {
  stunServer: 'stun:stun.l.google.com:19302',
  turnUrl: '',
  turnUsername: '',
  turnCredential: '',
};

export function iceConfig(): IceConfig {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return {
    stunServer: typeof extra.stunServer === 'string' && extra.stunServer ? extra.stunServer : DEFAULTS.stunServer,
    turnUrl: typeof extra.turnUrl === 'string' ? extra.turnUrl : '',
    turnUsername: typeof extra.turnUsername === 'string' ? extra.turnUsername : '',
    turnCredential: typeof extra.turnCredential === 'string' ? extra.turnCredential : '',
  };
}

export type RtcIceServer = {urls: string | string[]; username?: string; credential?: string};

export function rtcIceServers(cfg: IceConfig = iceConfig()): RtcIceServer[] {
  const servers: RtcIceServer[] = [];
  if (cfg.stunServer) servers.push({urls: cfg.stunServer});
  if (cfg.turnUrl) {
    const turn: RtcIceServer = {urls: cfg.turnUrl};
    if (cfg.turnUsername) turn.username = cfg.turnUsername;
    if (cfg.turnCredential) turn.credential = cfg.turnCredential;
    servers.push(turn);
  }
  return servers;
}