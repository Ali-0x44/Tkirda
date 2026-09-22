import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import type {ReactNode} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import type {MediaMessage} from '../../services/mediaStore';

import MediaMessageRow from './MediaMessageRow';

const READ_BLUE = '#34B7F1';

export type ChatBubble = {
  _id: string;
  text: string;
  createdAt: Date;
  mine: boolean;
  status?: 'sent' | 'read';
  media?: MediaMessage;
};

const timeLabel = (d: Date): string =>
  d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

type MessageBubbleProps = {
  message: ChatBubble;
  selected?: boolean;
  selectable?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onCancelMedia?: (id: string) => void;
  onRetryMedia?: (id: string) => void;
  onOpenMedia?: (media: MediaMessage) => void;
};

const MessageBubble = ({
  message,
  selected = false,
  selectable = false,
  onPress,
  onLongPress,
  onCancelMedia,
  onRetryMedia,
  onOpenMedia,
}: MessageBubbleProps) => {
  const {mine, text, createdAt, status} = message;

  const row = (children: ReactNode) => (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={250}
      activeOpacity={selectable ? 0.7 : 1}
      style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
      {selected ? (
        <View style={[styles.check, mine ? styles.checkMine : styles.checkOther]}>
          <Ionicons name="checkmark" size={13} color={COLORS.secondary.white} />
        </View>
      ) : null}
      {children}
    </TouchableOpacity>
  );

  if (message.media) {
    return row(
      <MediaMessageRow
        media={message.media}
        mine={mine}
        onCancel={onCancelMedia}
        onRetry={onRetryMedia}
        onOpen={onOpenMedia}
      />,
    );
  }

  return row(
    <View style={[styles.bubble, mine ? styles.bubbleRight : styles.bubbleLeft]}>
      <Text style={styles.text}>{text}</Text>
      {mine ? (
        <View style={styles.meta}>
          <Text style={styles.time}>{timeLabel(createdAt)}</Text>
          {status === 'read' ? (
            <Ionicons name="checkmark-done" size={15} color={READ_BLUE} />
          ) : (
            <Text style={styles.status}>Sent</Text>
          )}
        </View>
      ) : (
        <Text style={styles.time}>{timeLabel(createdAt)}</Text>
      )}
    </View>
  );
};

export default MessageBubble;

const styles = StyleSheet.create({
  row: {
    marginVertical: 3,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    flexShrink: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleLeft: {
    backgroundColor: COLORS.chat.left,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  bubbleRight: {
    backgroundColor: COLORS.chat.right,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  text: {
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
    color: COLORS.brand.ink,
    fontSize: 16,
    lineHeight: 22,
    flexShrink: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.brand.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  checkMine: {
    marginRight: 6,
  },
  checkOther: {
    marginLeft: -6,
    marginRight: 8,
  },
  time: {
    marginTop: 2,
    ...FONTFAMILY.POPPINS.reg.pt12,
    alignSelf: 'flex-end',
    color: COLORS.brand.sub,
    flexShrink: 1,
  },
  meta: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  status: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.sub,
    flexShrink: 1,
  },
});