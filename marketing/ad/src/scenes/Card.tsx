/** Beat 3: text only, the problem in one line. */

import { Beat } from '../components/Beat';

export function Card() {
  return <Beat card headline={<>You watched it.<br />Can you trace it?</>} />;
}
