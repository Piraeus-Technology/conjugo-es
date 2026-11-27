import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { LayoutChangeEvent, StyleProp, TextStyle } from 'react-native';

interface Props {
  children: string;
  style: StyleProp<TextStyle>;
}

export default function WordFittingText({ children, style }: Props) {
  const { fontScale } = useWindowDimensions();
  const { fontSize = 14, marginBottom, ...textStyle } = StyleSheet.flatten(style) ?? {};
  const [width, setWidth] = useState(0);

  return (
    <View
      style={[styles.container, { marginBottom }]}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    >
      <FittedText key={JSON.stringify([children, width, fontSize, fontScale])} width={width} fontSize={fontSize} style={textStyle}>
        {children}
      </FittedText>
    </View>
  );
}

function FittedText({ children, style, width, fontSize }: Props & { width: number; fontSize: number }) {
  const [size, setSize] = useState(fontSize);
  const [fits, setFits] = useState(false);
  const sizedStyle = [style, { fontSize: size }];

  const fitLongestWord = ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (layout.width <= width || size <= 1) {
      setFits(true);
    } else {
      setSize(Math.max(1, Math.min(size - 0.5, size * width / layout.width)));
    }
  };

  return (
    <>
      <Text style={[sizedStyle, !fits && styles.invisible]} textBreakStrategy="simple" android_hyphenationFrequency="none">
        {children}
      </Text>
      {!fits && width > 0 && (
        // The horizontal scroll content gives each word its intrinsic width.
        // Measure with native font scaling, then remeasure at the fitted size.
        <ScrollView
          horizontal
          scrollEnabled={false}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[StyleSheet.absoluteFill, styles.invisible]}
        >
          <Text key={size} style={sizedStyle} onLayout={fitLongestWord}>
            {children.split(/\s+/).join('\n')}
          </Text>
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { alignSelf: 'stretch' },
  invisible: { opacity: 0 },
});
