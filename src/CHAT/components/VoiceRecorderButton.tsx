import {useState} from 'react';
import {Alert, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useAudioRecorder, useAudioRecorderState} from 'expo-audio';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import {
  AUDIO_RECORDING_OPTIONS,
  activateRecordingMode,
  ensureRecordingPermissions,
  formatDuration,
  releaseRecordingMode,
  type VoiceMemo,
} from '../../services/audioService';
import {LIMITS} from '../../services/mediaStore';

const MAX_RECORD_SECONDS = Math.floor(LIMITS.MAX_AUDIO_DURATION_MS / 1000);

type VoiceRecorderButtonProps = {
  onComplete: (memo: VoiceMemo) => void;
  disabled?: boolean;
  testID?: string;
};

const VoiceRecorderButton = ({onComplete, disabled = false, testID}: VoiceRecorderButtonProps) => {
  const recorder = useAudioRecorder(AUDIO_RECORDING_OPTIONS);
  const state = useAudioRecorderState(recorder);
  const [recording, setRecording] = useState(false);
  const [armed, setArmed] = useState(false);

  const start = async () => {
    if (disabled || recording || armed) return;
    try {
      const granted = await ensureRecordingPermissions();
      if (!granted) {
        Alert.alert('Microphone denied', 'Allow the microphone to record voice messages.');
        return;
      }
      setArmed(true);
      await activateRecordingMode();
      await recorder.prepareToRecordAsync();
      recorder.record({forDuration: MAX_RECORD_SECONDS});
      setRecording(true);
    } catch {
      setArmed(false);
      await releaseRecordingMode().catch(() => {});
    }
  };

  const finish = async () => {
    if (!recording && !armed) return;
    const uri = recorder.uri;
    const durationMs = state.durationMillis;
    try {
      await recorder.stop();
    } catch {
      // stop failure — nothing to send
    }
    await releaseRecordingMode().catch(() => {});
    setRecording(false);
    setArmed(false);
    if (uri && durationMs >= 300) {
      onComplete({uri, durationMs});
    }
  };

  const active = recording;

  return (
    <View style={styles.wrapper}>
      {active ? (
        <Text style={styles.timer} testID="recording-timer">
          {formatDuration(state.durationMillis)}
        </Text>
      ) : null}
      <TouchableOpacity
        onPressIn={start}
        onPressOut={finish}
        disabled={disabled}
        testID={testID}
        accessibilityLabel="Hold to record a voice message"
        style={[
          styles.button,
          active ? styles.buttonRecording : null,
          disabled ? styles.buttonDisabled : null,
        ]}>
        <Ionicons
          name={active ? 'stop' : 'mic'}
          size={22}
          color={active ? COLORS.secondary.white : COLORS.brand.teal}
        />
      </TouchableOpacity>
    </View>
  );
};

export default VoiceRecorderButton;

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.brand.bubbleOther,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.brand.inputBack,
  },
  buttonRecording: {
    backgroundColor: COLORS.brand.danger,
    borderColor: COLORS.brand.danger,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  timer: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.danger,
  },
});