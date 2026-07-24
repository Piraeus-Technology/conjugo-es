import { themes } from '../utils/theme';

function relativeLuminance(hex: string): number {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );

  return (
    0.2126 * channels[0] +
    0.7152 * channels[1] +
    0.0722 * channels[2]
  );
}

function contrast(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

describe.each(Object.entries(themes))('%s theme contrast', (_name, colors) => {
  test.each([
    ['muted text on app background', colors.textMuted, colors.bg],
    ['muted text on cards', colors.textMuted, colors.card],
    ['primary text on cards', colors.primaryText, colors.card],
    ['regular tag text', colors.regularTagText, colors.regularTag],
    ['irregular tag text', colors.irregularTagText, colors.irregularTag],
    ['high score text', colors.scoreHighText, colors.scoreHighBg],
    ['mid score text', colors.scoreMidText, colors.scoreMidBg],
    ['low score text', colors.scoreLowText, colors.scoreLowBg],
    ['success text', colors.successText, colors.successBg],
    ['error text', colors.errorText, colors.errorBg],
    ['A1 tag text', colors.levelA1Text, colors.levelA1Bg],
  ])('%s meets the 4.5:1 normal-text threshold', (_label, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  test.each([
    ['unselected control outline on cards', colors.controlBorder, colors.card],
    ['unselected control outline on app background', colors.controlBorder, colors.bg],
    ['accent indicator on cards', colors.accent, colors.card],
  ])('%s meets the 3:1 control threshold', (_label, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(3);
  });
});
