export { colors } from './colors';
export { typography } from './typography';
export { spacing, radius } from './spacing';
export { shadows } from './shadows';
export { motion } from './motion';
export type { ColorKey } from './colors';
export type { TypographyKey } from './typography';

import { colors } from './colors';
import { typography } from './typography';
import { spacing, radius } from './spacing';
import { shadows } from './shadows';
import { motion } from './motion';

export const theme = { colors, typography, spacing, radius, shadows, motion } as const;
