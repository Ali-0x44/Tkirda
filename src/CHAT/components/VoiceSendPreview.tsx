import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useAudioPlayer, useAudioPlayerStatus} from 'expo-audio';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import {formatDuration, type VoiceMemo} from '../../services/audioService';

type VoiceSendPreviewProps = {
  memo: VoiceMemo;
  onSend: () => void;
  onCancel: () => void;
  disabled?: boolean;
};

const WAVE = [14, 22, 30, 18, 8, 24, 16, 30, 12, 20, 26, 10, 18, 28, 14];

const VoiceSendPreview = ({memo, onSend, onCancel, disabled = false}: VoiceSendPreviewProps) => {
  const player = useAudioPlayer(memo.uri);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const position = status.currentTime * 1000;
  const duration = memo.durationMs || status.duration * 1000;

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        onPress={toggle}
        disabled={disabled}
        accessibilityLabel={playing ? 'Pause recording preview' : 'Play recording preview'}
        style={styles.play}>
        <Ionicons name={playing ? 'pause' : 'play'} size={20} color={COLORS.secondary.white} />
      </TouchableOpacity>
      <View style={styles.meta}>
        <View style={styles.wave}>
          {WAVE.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: h,
                  opacity: position === 0 || position / Math.max(duration, 1) > i / WAVE.length ? 1 : 0.5,
                },
              ]}
            />
          ))}
        </View>
        <Text style={styles.duration}>
          {formatDuration(playing || position > 0 ? position : duration)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onCancel}
        disabled={disabled}
        accessibilityLabel="Discard recording"
        style={styles.cancel}>
        <Ionicons name="trash" size={20} color={COLORS.brand.danger} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onSend}
        disabled={disabled}
        accessibilityLabel="Send recording"
        style={[styles.send, disabled && styles.sendDisabled]}>
        <Ionicons name="arrow-up" size={20} color={COLORS.secondary.white} />
      </TouchableOpacity>
    </View>
  );
};

export default VoiceSendPreview;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 8,
    marginBottom: 2,
    borderRadius: 16,
    backgroundColor: COLORS.brand.bubbleOther,
  },
  play: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  cancel: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.brand.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: COLORS.secondary.greyThree,
  },
});