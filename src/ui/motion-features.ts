/** Motion's DOM animation features, split into their own chunk and loaded by
 *  the root LazyMotion (./MotionRoot) on the first interaction (motion.dev
 *  "LazyMotion" → async loading). Pages that are only looked at never pay for it. */

import { domAnimation } from 'motion/react';

export default domAnimation;
