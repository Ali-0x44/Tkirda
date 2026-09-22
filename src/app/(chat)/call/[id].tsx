import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RTCView } from 'react-native-webrtc';

import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import Avatar from '@/CHAT/components/Avatar';
import { callManager } from '@/P2P/callManager';
import { callService, type Call } from '@/services/callService';
import { performEndCall } from '@/services/callKeepService';

const { width, height } = Dimensions.get('window');

export default function ActiveCallScreen() {
  const params = useLocalSearchParams<{ id: string; name: string; callId: string }>();
  const contactName = params.name || 'Unknown';
  const callId = params.callId;
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [call, setCall] = useState<Call | null>(null);
  const [duration, setDuration] = useState(0);
  const [micEnabled, setMicEnabled] = useState(true);
  const [speakerEnabled, setSpeakerEnabled] = useState(true);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);

  useEffect(() => {
    let hadCall = false;
    const unsub = callService.subscribe(c => {
      setCall(c);
      if (c) {
        hadCall = true;
      } else if (hadCall) {
        // The call ended (in-app button, native UI, or remote end) — leave the
        // screen. `hadCall` guards against popping a deep-linked screen that
        // never had an active call.
        try {
          if (router.canGoBack()) router.back();
        } catch {
          // ignore — nothing worth doing if navigation is not ready
        }
      }
    });
    return unsub;
  }, [router]);

  // Mark the call as active when the peer connection actually connects
  useEffect(() => {
    const unsub = callManager.subscribeConnectionState(callId, (state) => {
      if (state === 'connected' || state === 'completed') {
        callService.updateCallState('active');
      }
    });
    return unsub;
  }, [callId]);

  useEffect(() => {
    if (call?.state !== 'active' || !call.startedAt) return;
    const startedAt = call.startedAt;
    const updateDuration = () => {
      setDuration(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    };
    const timer = setTimeout(updateDuration, 0);
    const interval = setInterval(updateDuration, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [call?.state, call?.startedAt]);

  useEffect(() => {
    const unsub = callManager.subscribeStreams((id, stream) => {
      if (id === callId) {
        setRemoteStream(stream);
      }
    });

    let mounted = true;

    // Get streams immediately (deferred to avoid synchronous setState in effect)
    const timer = setTimeout(() => {
      if (!mounted) return;
      const local = callManager.getLocalStream(callId);
      if (local) {
        setLocalStream(local);
      }

      const remote = callManager.getRemoteStream(callId);
      if (remote) {
        setRemoteStream(remote);
      }
    }, 0);

    // Poll for streams in case they're not immediately available
    const checkStreamsInterval = setInterval(() => {
      const updatedLocal = callManager.getLocalStream(callId);
      if (updatedLocal && !localStream) {
        setLocalStream(updatedLocal);
      }

      const updatedRemote = callManager.getRemoteStream(callId);
      if (updatedRemote && !remoteStream) {
        setRemoteStream(updatedRemote);
      }
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(timer);
      clearInterval(checkStreamsInterval);
      unsub();
    };
  }, [callId, localStream, remoteStream]);

  const onToggleMic = () => {
    const local = callManager.getLocalStream(callId);
    if (local) {
      local.getAudioTracks().forEach((track: any) => {
        track.enabled = !micEnabled;
      });
      setMicEnabled(!micEnabled);
    }
  };

  const onToggleSpeaker = () => {
    setSpeakerEnabled(!speakerEnabled);
  };

  const onEndCall = async () => {
    try {
      // Teardown everywhere (app state, WebRTC, Firestore, native telecom UI).
      // The subscription above detects the ended call and pops this screen.
      await performEndCall(callId);
    } catch (err) {
      console.error('End call error:', err);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const hasVideo = call?.mediaType === 'audio-video' || call?.mediaType === 'video';

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Remote Video - Full Screen Background */}
      {hasVideo && remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <Avatar name={contactName} size={100} />
        </View>
      )}

      {/* Local Video - Picture in Picture */}
      {hasVideo && localStream && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror={true}
        />
      )}

      {/* Header with Name and Duration */}
      <View style={styles.header}>
        <Text style={styles.name}>{contactName}</Text>
        {call && call.state !== 'active' ? (
          <Text style={styles.status}>
            {call.state === 'connecting' ? 'Connecting…' : 'Ringing…'}
          </Text>
        ) : (
          <Text style={styles.duration}>{formatDuration(duration)}</Text>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, !micEnabled && styles.controlBtnActive]}
          onPress={onToggleMic}
          accessibilityLabel={micEnabled ? 'Mute' : 'Unmute'}>
          <Ionicons
            name={micEnabled ? 'mic' : 'mic-off'}
            size={24}
            color={COLORS.secondary.white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, speakerEnabled && styles.controlBtnActive]}
          onPress={onToggleSpeaker}
          accessibilityLabel="Speaker">
          <Ionicons
            name={speakerEnabled ? 'volume-high' : 'volume-off'}
            size={24}
            color={COLORS.secondary.white}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={onEndCall}
          accessibilityLabel="End call">
          <Ionicons name="close" size={28} color={COLORS.secondary.white} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary.blue,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
  },
  remoteVideoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width,
    height,
    backgroundColor: COLORS.primary.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  localVideo: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: COLORS.primary.blue,
    borderWidth: 3,
    borderColor: COLORS.secondary.white,
  },
  header: {
    position: 'absolute',
    top: 60,
    left: 16,
    zIndex: 10,
  },
  name: {
    ...FONTFAMILY.MONTSERRAT.reg.pt18,
    color: COLORS.secondary.white,
  },
  duration: {
    ...FONTFAMILY.POPPINS.reg.pt14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  status: {
    ...FONTFAMILY.POPPINS.reg.pt14,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderColor: 'rgba(255,255,255,0.6)',
  },
  endCallBtn: {
    backgroundColor: COLORS.brand.danger,
    borderColor: COLORS.brand.danger,
  },
});
