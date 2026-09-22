import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import type { MediaMessage } from '../../services/mediaStore';
import AudioBubble from './AudioBubble';
import FileBubble from './FileBubble';
import ImageBubble from './ImageBubble';

type MediaMessageRowProps = {
  media: MediaMessage;
  mine: boolean;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onOpen?: (media: MediaMessage) => void;
};

const timeLabel = (ts: number): string =>
  new Date(ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});

const MediaMessageRow = ({media, mine, onCancel, onRetry, onOpen}: MediaMessageRowProps) => {
  const cancel = () => onCancel?.(media.id);
  const retry = () => onRetry?.(media.id);
  const frame = media.kind === 'image' ? styles.imageFrame : styles.frame;
  const bubbleStyle = mine ? styles.bubbleRight : styles.bubbleLeft;

  return (
    <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
      <View style={[frame, bubbleStyle]}>
        {media.kind === 'audio' ? (
          <AudioBubble media={media} mine={mine} onCancel={cancel} onRetry={retry} />
        ) : media.kind === 'image' ? (
          <ImageBubble media={media} mine={mine} onCancel={cancel} onRetry={retry} onOpen={onOpen} />
        ) : (
          <FileBubble media={media} mine={mine} onCancel={cancel} onRetry={retry} onOpen={onOpen} />
        )}
        <View style={styles.metaRow}>
          <Text style={styles.time}>{timeLabel(media.createdAt)}</Text>
          {mine && media.status === 'delivered' ? (
            <Ionicons name="checkmark-done" size={14} color={COLORS.brand.teal} />
          ) : null}
        </View>
      </View>
    </View>
  );
};

export default MediaMessageRow;

const styles = StyleSheet.create({
  row: {
    marginVertical: 3,
    flexDirection: 'row',
  },
  rowLeft: {
    justifyContent: 'flex-start',
  },
  rowRight: {
    justifyContent: 'flex-end',
  },
  frame: {
    maxWidth: '82%',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  imageFrame: {
    borderRadius: 16,
    overflow: 'hidden',
    maxWidth: '82%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
    elevation: 4,
  },
  bubbleLeft: {
    backgroundColor: COLORS.chat.left,
    borderBottomLeftRadius: 7,
  },
  bubbleRight: {
    backgroundColor: COLORS.chat.right,
    borderBottomRightRadius: 7,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingHorizontal: 2,
    marginTop: 4,
  },
  time: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.sub,
    paddingRight: 1,
  },
});