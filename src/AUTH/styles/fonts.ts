const FONT_FAMILY = {
  COM_BD: 'Comfortaa-Bold',
  COM_MD: 'Comfortaa-Medium',
  COM_RG: 'Comfortaa-Regular',
  COM_SB: 'Comfortaa-SemiBold',
  MON_XB: 'Montserrat-ExtraBold',
  MON_BD: 'Montserrat-Bold',
  MON_MD: 'Montserrat-Medium',
  MON_RG: 'Montserrat-Regular',
  MON_SB: 'Montserrat-SemiBold',
  POP_BD: 'Poppins-Bold',
  POP_XB: 'Poppins-ExtraBold',
  POP_MD: 'Poppins-Medium',
  POP_RG: 'Poppins-Regular',
  POP_SB: 'Poppins-SemiBold',
} as const;

const SIZE = {
  pt12: 12,
  pt13: 13,
  pt14: 14,
  pt16: 16,
  pt18: 18,
  pt20: 20,
  pt24: 24,
  pt32: 32,
} as const;

type FontStyle = {fontSize: number; fontFamily: string};

const build = (family: string): Record<keyof typeof SIZE, FontStyle> =>
  Object.fromEntries(
    Object.entries(SIZE).map(([key, size]) => [key, {fontSize: size, fontFamily: family}]),
  ) as Record<keyof typeof SIZE, FontStyle>;

const COMFORTAA = {
  b: build(FONT_FAMILY.COM_BD),
  reg: build(FONT_FAMILY.COM_RG),
  sb: build(FONT_FAMILY.COM_SB),
  md: build(FONT_FAMILY.COM_MD),
};

const MONTSERRAT = {
  b: build(FONT_FAMILY.MON_BD),
  xb: build(FONT_FAMILY.MON_XB),
  reg: build(FONT_FAMILY.MON_RG),
  sb: build(FONT_FAMILY.MON_SB),
  md: build(FONT_FAMILY.MON_MD),
};

const POPPINS = {
  b: build(FONT_FAMILY.POP_BD),
  xb: build(FONT_FAMILY.POP_XB),
  reg: build(FONT_FAMILY.POP_RG),
  sb: build(FONT_FAMILY.POP_SB),
  md: build(FONT_FAMILY.POP_MD),
};

const FONTFAMILY = {
  COMFORTAA,
  MONTSERRAT,
  POPPINS,
} as const;

export default FONTFAMILY;
export type {FontStyle};