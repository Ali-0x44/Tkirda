import {useState} from 'react';
import {Keyboard, StyleSheet, TextInput, TouchableOpacity, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import type {VoiceMemo} from '../../services/audioService';

import AttachButton from './AttachButton';
import EmojiTable from './EmojiTable';
import VoiceRecorderButton from './VoiceRecorderButton';

type MessageComposerProps = {
  onSend: (text: string) => void;
  onVoiceRecorded?: (memo: VoiceMemo) => void;
  onPickDocument?: () => void;
  onPickImage?: () => void;
  disabled?: boolean;
};

const MessageComposer = ({
  onSend,
  onVoiceRecorded,
  onPickDocument,
  onPickImage,
  disabled = false,
}: MessageComposerProps) => {
  const [text, setText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);

  const canSend = text.trim().length > 0 && !disabled;
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  const toggleEmoji = () => {
    setShowEmoji(prev => {
      if (!prev) Keyboard.dismiss();
      return !prev;
    });
  };

  return (
    <View style={styles.wrapper}>
      {showEmoji ? <EmojiTable onPick={emoji => setText(t => t + emoji)} testID="emoji-table" /> : null}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={[styles.emojiButton, showEmoji && styles.emojiButtonActive]}
          onPress={toggleEmoji}
          accessibilityLabel="Toggle emoji picker">
          <Ionicons
            name={showEmoji ? 'happy' : 'happy-outline'}
            size={24}
            color={showEmoji ? COLORS.primary.blue : COLORS.brand.teal}
          />
        </TouchableOpacity>
        <AttachButton
          onPickDocument={onPickDocument ?? (() => {})}
          onPickImage={onPickImage ?? (() => {})}
          disabled={disabled}
        />
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Message"
          placeholderTextColor={COLORS.brand.sub}
          multiline
          editable={!disabled}
        />
        {canSend ? (
          <TouchableOpacity
            style={[styles.sendButton, !canSend && styles.sendDisabled]}
            onPress={submit}
            disabled={!canSend}>
            <Ionicons name="arrow-up" size={20} color={COLORS.secondary.white} />
          </TouchableOpacity>
        ) : onVoiceRecorded ? (
          <VoiceRecorderButton
            onComplete={onVoiceRecorded}
            disabled={disabled}
            testID="voice-recorder"
          />
        ) : null}
      </View>
    </View>
  );
};

export default MessageComposer;

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.chat.back,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 8,
    gap: 8,
    backgroundColor: COLORS.chat.back,
  },
  emojiButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  emojiButtonActive: {
    backgroundColor: COLORS.brand.inputBack,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 22,
    backgroundColor: COLORS.brand.bubbleOther,
    color: COLORS.brand.ink,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.brand.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendDisabled: {
    backgroundColor: COLORS.secondary.greyThree,
  },
});