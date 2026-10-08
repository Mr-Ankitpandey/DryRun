/** The two cuts of the ad from the same scenes: vertical for Reels/Shorts and
 *  wide for YouTube/LinkedIn. Fonts are local (fontsource); rendering waits
 *  until they are loaded so no frame shows a fallback face. */

import { useEffect, useState } from 'react';
import { Composition, continueRender, delayRender } from 'remotion';
import { Ad } from './Ad';
import { DURATION, FPS } from './config';

function FontGate(props: Record<string, unknown>) {
  const music = props.music === true;
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    void document.fonts.ready.then(() => continueRender(handle));
  }, [handle]);
  return <Ad music={music} />;
}

const defaults: Record<string, unknown> = { music: false };

export function Root() {
  return (
    <>
      <Composition id="DryRunAdVertical" component={FontGate} width={1080} height={1920} fps={FPS} durationInFrames={DURATION} defaultProps={defaults} />
      <Composition id="DryRunAdWide" component={FontGate} width={1920} height={1080} fps={FPS} durationInFrames={DURATION} defaultProps={defaults} />
    </>
  );
}
