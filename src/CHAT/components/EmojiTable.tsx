import {useState} from 'react';
import {FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import COLORS from '@/AUTH/styles/colors';
import FONTFAMILY from '@/AUTH/styles/fonts';
import {screen_width} from '@/AUTH/utils/Dimensions';

const CATEGORIES: Record<string, string[]> = {
  Smileys: [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
    '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳',
    '😏','😒','😞','😔','😟','😕','🙁','😣','😖','😫','😩','🥺','😢','😭','😤','😠',
    '😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥',
    '😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐',
    '🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻',
    '💀','☠️','👽','👾','🤖',
  ],
  Gestures: [
    '👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
    '👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅',
    '🤳','💪','🦾','🦵','🦶','👂','👃','🧠','🦷','🦴','👀','👁','👅','👄',
  ],
  Hearts: [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖',
    '💘','💝','💟','♥️','💌','💋','💐','🌸','💮','🌹','🌺','🌻','🌷','🌼','🥀','🪻',
    '✨','🌟','⭐','💫','❤️‍🔥',
  ],
  Animals: [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈',
    '🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛',
    '🦋','🐌','🐞','🐜','🦟','🦗','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦀',
    '🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🦭','🐾',
  ],
  Food: [
    '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
    '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🌽','🥕','🥔','🍟','🍕','🌭','🍔',
    '🥪','🥙','🧆','🌮','🌯','🥗','🥘','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙',
    '🍰','🎂','🥧','🧁','🍭','🍬','🍫','🍿','🍩','🍪','☕','🍵','🧃','🥤','🍺','🍻',
    '🥂','🍷','🥃','🍸','🍹','🧊','🫖','🍦','🍨','🍧','🍡',
  ],
  Sports: [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🏓','🏸','🥊','🥋','🥅','⛳',
    '🏹','🎣','🤿','🛹','⛸','🥌','🎿','⛷','🏂','🏋️','🤼','🤸','🤺','🤾','🏌️','🏇',
    '🧘','🏄','🏊','🤽','🚣','🧗','🚵','🚴','🏆','🥇','🥈','🥉','🏅','🎖','🎽','🎯',
    '🎳','🎮','🎰','🎲','🧩','🎸','🎹','🎤','🎧','🥁','🎷','🎺',
  ],
  Travel: [
    '🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🚚','🚜','🛴','🚲','🛵','🏍',
    '🛺','🚨','🚔','🚍','🚘','🚖','🚡','🚠','🚟','🚃','🚋','🚄','🚅','🚈','🚂','🚆',
    '🚇','🚊','🚉','✈️','🛫','🛬','🛩','💺','🛰','🚀','🛸','🚁','🛶','⛵','🚤','🛥',
    '🛳','⛴','🚢','⚓','🚧','🚦','🚏','🗺','🗿','🗽','🗼','🏰','🏯','🏟','🎡','🎢',
    '🎠','⛲','🎫','🎟','🏕','🏖','🏝','🏜',
  ],
  Objects: [
    '📱','💻','⌨️','🖥','🖨','🖱','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📺',
    '📻','📞','☎️','📟','📠','⏰','🕰','⌚','🔋','🔌','💡','🔦','🕯','🔋','💰','💳',
    '💎','🧰','🔧','🔨','⚙️','🔩','🔪','🗡','⚔️','🛡','🔮','📿','🔭','🔬','💊','💉',
    '🩺','🧹','🗑','🔑','🗝','🚪','🛏','🛋','🪑','🎁','🎈','🎊','🎉','✉️','📩','📦',
    '📦','📎','📌','📍','📝','✏️','🔍','🔎','🔒','🔓','🔐','🔑','📚','📖','📄','📃',
    '🧸','🎀','🧿','🏮',
  ],
};

const CATEGORY_NAMES = Object.keys(CATEGORIES);

const NUM_COLUMNS = 7;

type EmojiTableProps = {
  onPick: (emoji: string) => void;
  testID?: string;
};

const EmojiTable = ({onPick, testID}: EmojiTableProps) => {
  const [category, setCategory] = useState(CATEGORY_NAMES[0]);

  return (
    <View style={styles.panel} testID={testID}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chips}
        contentContainerStyle={styles.chipsContent}>
        {CATEGORY_NAMES.map(name => (
          <TouchableOpacity
            key={name}
            onPress={() => setCategory(name)}
            style={[styles.chip, category === name && styles.chipActive]}>
            <Text style={[styles.chipText, category === name && styles.chipTextActive]}>
              {name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <FlatList
        data={CATEGORIES[category]}
        keyExtractor={(item, index) => `${category}-${item}-${index}`}
        numColumns={NUM_COLUMNS}
        renderItem={({item}) => (
          <TouchableOpacity
            style={styles.cell}
            onPress={() => onPick(item)}
            accessibilityLabel={`Emoji ${item}`}>
            <Text style={styles.emoji}>{item}</Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.grid}
        ListEmptyComponent={<Text style={styles.empty}>No emojis here yet.</Text>}
      />
    </View>
  );
};

export default EmojiTable;

const styles = StyleSheet.create({
  panel: {
    height: 260,
    backgroundColor: COLORS.secondary.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.brand.inputBack,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  chips: {
    flexGrow: 0,
  },
  chipsContent: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: COLORS.brand.inputBack,
  },
  chipActive: {
    backgroundColor: COLORS.brand.teal,
  },
  chipText: {
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.sb.pt12,
  },
  chipTextActive: {
    color: COLORS.secondary.white,
  },
  grid: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  cell: {
    width: screen_width / NUM_COLUMNS,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  emoji: {
    fontSize: 24,
  },
  empty: {
    textAlign: 'center',
    color: COLORS.brand.sub,
    ...FONTFAMILY.MONTSERRAT.reg.pt14,
    padding: 20,
  },
});