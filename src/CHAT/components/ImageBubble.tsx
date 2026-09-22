import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import COLORS from '../../AUTH/styles/colors';
import FONTFAMILY from '../../AUTH/styles/fonts';
import { formatBytes } from '../../services/filePickerService';
import type { MediaMessage } from '../../services/mediaStore';
import TransferProgress from './TransferProgress';

type ImageBubbleProps = {
  media: MediaMessage;
  mine: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onOpen?: (media: MediaMessage) => void;
};

const THUMB = {width: 220, height: 220};

const ImageBubble = ({media, mine, onCancel, onRetry, onOpen}: ImageBubbleProps) => {
  const [open, setOpen] = useState(false);
  const hasImage = !!media.path;
  const showPreview = hasImage && ['ready', 'delivered', 'queued', 'connecting', 'sending', 'failed'].includes(media.status);

  return (
    <View style={styles.wrapper}>
      {showPreview ? (
        <TouchableOpacity
          onPress={() => {
            if (media.status === 'ready' || media.status === 'delivered') {
              setOpen(true);
              onOpen?.(media);
            }
          }}
          accessibilityLabel="View image"
          activeOpacity={0.9}
          style={styles.imageWrap}>
          <Image
            source={{uri: media.path}}
            style={[THUMB, {resizeMode: 'cover'}]}
            testID="image-bubble"
          />
          {media.status === 'failed' && onRetry ? (
            <View style={styles.overlay} pointerEvents="box-none">
              <TouchableOpacity onPress={onRetry} style={styles.overlayButton}>
                <Ionicons name="refresh" size={18} color={COLORS.secondary.white} />
              </TouchableOpacity>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : (
        <View style={[THUMB, styles.placeholder]}>
          <Ionicons name="image-outline" size={40} color={COLORS.brand.sub} />
          <TransferProgress media={media} onCancel={onCancel} onRetry={onRetry} />
        </View>
      )}
      {mine && media.status === 'delivered' ? (
        <View style={styles.sizeRow}>
          <Ionicons name="checkmark-done" size={14} color={COLORS.brand.sub} />
          <Text style={styles.size}>{formatBytes(media.size)}</Text>
        </View>
      ) : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.fullscreen} activeOpacity={1} onPress={() => setOpen(false)}>
          <Image
            source={{uri: media.path}}
            style={styles.fullImage}
            resizeMode="contain"
          />
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

export default ImageBubble;

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
    overflow: 'hidden',
    borderRadius: 16,
  },
  imageWrap: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.brand.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    backgroundColor: COLORS.brand.inputBack,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 12,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  size: {
    ...FONTFAMILY.POPPINS.reg.pt12,
    color: COLORS.brand.sub,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
});