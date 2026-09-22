import Ionicons from '@expo/vector-icons/Ionicons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import { formatDuration } from '../../services/audioService';
import type { MediaMessage } from '../../services/mediaStore';
import TransferProgress from './TransferProgress';

type AudioBubbleProps = {
  media: MediaMessage;
  mine: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
};

const AudioBubble = ({media, mine, onCancel, onRetry}: AudioBubbleProps) => {
  const playable =
    media.direction === 'out'
      ? !!media.path && media.status !== 'cancelled'
      : media.status === 'ready';
  const player = useAudioPlayer(playable ? media.path : null);
  const status = useAudioPlayerStatus(player);

  if (!playable) {
    return (
      <View style={styles.notReady}>
        <View style={styles.micWrap}>
          <Ionicons name="mic" size={18} color={COLORS.brand.sub} />
        </View>
        <TransferProgress media={media} onCancel={onCancel} onRetry={onRetry} />
      </View>
    );
  }

  const duration = media.durationMs ?? status.duration * 1000;
  const position = status.currentTime * 1000;
  const playing = status.playing;
  const pending = media.status !== 'ready' && media.status !== 'delivered';
  const failed = media.status === 'failed' && media.direction === 'out' && !!onRetry;

  return (
    <View style={styles.col}>
      <View style={styles.player}>
        <TouchableOpacity
          onPress={() => (playing ? player.pause() : player.play())}
          accessibilityLabel={playing ? 'Pause voice message' : 'Play voice message'}
          style={styles.playWrap}>
          <Ionicons name={playing ? 'pause' : 'play'} size={24} color={COLORS.secondary.white} />
        </TouchableOpacity>
        <View style={styles.meta}>
          <View style={styles.wave}>
            {[14, 22, 30, 18, 8, 24, 16, 30, 12, 20, 26, 10, 18, 28, 14].map((h, i) => (
              <View
                key={i}
                style={[
                  styles.bar,
                  {
                    height: h,
                    opacity: position === 0 || (position / Math.max(duration, 1)) > i / 15 ? 1 : 0.5,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.duration, failed && styles.errorText]}>
            {failed
              ? 'Couldn\u2019t send'
              : formatDuration(playing || position > 0 ? position : duration)}
          </Text>
        </View>
        <View style={styles.flags}>
          {failed ? (
            <TouchableOpacity
              onPress={onRetry}
              hitSlop={10}
              accessibilityLabel="Resend voice message"
              style={styles.resend}>
              <Ionicons name="refresh" size={18} color={COLORS.secondary.white} />
            </TouchableOpacity>
          ) : mine && media.status === 'delivered' ? (
            <Ionicons name="checkmark-done" size={15} color={COLORS.brand.sub} />
          ) : null}
        </View>
      </View>
      {pending && !failed ? (
        <View style={styles.statusRow}>
          <TransferProgress media={media} onCancel={onCancel} onRetry={onRetry} />
        </View>
      ) : null}
    </View>
  );
};

export default AudioBubble;

const styles = StyleSheet.create({
  notReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 160,
  },
  micWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.secondary.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  col: {
    flexDirection: 'column',
    gap: 6,
    minWidth: 220,
    maxWidth: 260,
  },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusRow: {
    flexDirection: 'row',
  },
  errorText: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.danger,
  },
  resend: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.brand.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.brand.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  wave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: COLORS.brand.teal,
  },
  duration: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.sub,
  },
  flags: {
    flexDirection: 'row',
  },
});