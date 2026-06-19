import React from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// ponytail: Feather has no piggy-bank glyph. Map the few icons we want that
// Feather lacks to MaterialCommunityIcons; everything else stays Feather.
const MCI_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  'piggy-bank': 'piggy-bank',
};

type Props = {
  name: string;
  size?: number;
  color?: string;
};

export function CategoryIcon({ name, size = 20, color }: Props) {
  const mci = MCI_ICONS[name];
  if (mci) {
    return <MaterialCommunityIcons name={mci} size={size} color={color} />;
  }
  return (
    <Feather
      name={name as React.ComponentProps<typeof Feather>['name']}
      size={size}
      color={color}
    />
  );
}
