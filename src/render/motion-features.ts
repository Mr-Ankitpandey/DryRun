/** Motion's DOM animation features, split into their own chunk and loaded by
 *  LazyMotion when the first stage mounts (motion.dev "LazyMotion" → async
 *  loading). Pages that only show stills never need to wait for it. */

import { domAnimation } from 'motion/react';

export default domAnimation;
