import React from 'react';
import { DimensionProps, EntranceDimensionProps } from '../types/BannerConfig';

// Background
import { GradientBg }   from './background/GradientBg';
import { BlocksBg }     from './background/BlocksBg';
import { AuroraBg }     from './background/AuroraBg';
import { BalatrosBg }   from './background/BalatrosBg';
import { BallpitBg }    from './background/BallpitBg';
import { BeamsBg }      from './background/BeamsBg';
import { DotFieldBg }   from './background/DotFieldBg';
import { DotGridBg }    from './background/DotGridBg';
import { WavesBg }      from './background/WavesBg';
import { SilkBg }       from './background/SilkBg';
import { ThreadsBg }    from './background/ThreadsBg';
import { LineWavesBg }  from './background/LineWavesBg';
import { RippleGridBg } from './background/RippleGridBg';
import { GalaxyBg }     from './background/GalaxyBg';

// Text effects
import { StaticText }    from './textEffect/StaticText';
import { FadeText }      from './textEffect/FadeText';
import { BlurText }      from './textEffect/BlurText';
import { GradientText }  from './textEffect/GradientText';
import { ShinyText }     from './textEffect/ShinyText';
import { SplitText }     from './textEffect/SplitText';
import { CircularText }  from './textEffect/CircularText';
import { TextType }      from './textEffect/TextType';
import { ShuffleText }   from './textEffect/ShuffleText';
import { FuzzyText }     from './textEffect/FuzzyText';
import { RotatingText }  from './textEffect/RotatingText';
import { GlitchText }    from './textEffect/GlitchText';
import { CountUpText }   from './textEffect/CountUpText';

// Decorations
import { CircleDots }         from './decoration/CircleDots';
import { LineStrokes }        from './decoration/LineStrokes';
import { GlowRing }           from './decoration/GlowRing';
import { CircularTextDecor }  from './decoration/CircularTextDecor';

// Entrance (wrapper components with children)
import { FadeSlideUp } from './entrance/FadeSlideUp';
import { ScaleIn }     from './entrance/ScaleIn';
import { FloatIn }     from './entrance/FloatIn';
import { BlurIn }      from './entrance/BlurIn';

// ── Registry ──────────────────────────────────────────────────────────────────
// To add a new option: import the component, add a key here.
// Nothing else needs to change.

export const DIMENSIONS = {
  background: {
    gradient:   GradientBg,
    blocks:     BlocksBg,
    aurora:     AuroraBg,
    balatro:    BalatrosBg,
    ballpit:    BallpitBg,
    beams:      BeamsBg,
    dotField:   DotFieldBg,
    dotGrid:    DotGridBg,
    waves:      WavesBg,
    silk:       SilkBg,
    threads:    ThreadsBg,
    lineWaves:  LineWavesBg,
    rippleGrid: RippleGridBg,
    galaxy:     GalaxyBg,
  } as Record<string, React.FC<DimensionProps>>,

  textEffect: {
    static:        StaticText,
    fade:          FadeText,
    blurText:      BlurText,
    gradientText:  GradientText,
    shinyText:     ShinyText,
    splitText:     SplitText,
    circularText:  CircularText,
    textType:      TextType,
    shuffleText:   ShuffleText,
    fuzzyText:     FuzzyText,
    rotatingText:  RotatingText,
    glitchText:    GlitchText,
    countUp:       CountUpText,
  } as Record<string, React.FC<DimensionProps>>,

  decoration: {
    circles:      CircleDots,
    lines:        LineStrokes,
    glowRing:     GlowRing,
    circularText: CircularTextDecor,
  } as Record<string, React.FC<DimensionProps>>,

  entrance: {
    fadeSlideUp: FadeSlideUp,
    scaleIn:     ScaleIn,
    floatIn:     FloatIn,
    blurIn:      BlurIn,
  } as Record<string, React.FC<EntranceDimensionProps>>,
};
