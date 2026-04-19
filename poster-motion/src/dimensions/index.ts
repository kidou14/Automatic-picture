import React from 'react';
import { DimensionProps, EntranceDimensionProps } from '../types/BannerConfig';

// Background
import { GradientBg }   from './background/GradientBg';
import { BlocksBg }     from './background/BlocksBg';
import { AuroraBg }     from './background/AuroraBg';
import { BallpitBg }    from './background/BallpitBg';
import { DotFieldBg }   from './background/DotFieldBg';
import { DotGridBg }    from './background/DotGridBg';
import { SilkBg }       from './background/SilkBg';
import { ThreadsBg }    from './background/ThreadsBg';
import { LineWavesBg }  from './background/LineWavesBg';
import { RippleGridBg } from './background/RippleGridBg';
import { NebulaBg }     from './background/NebulaBg';
import { ShaderLinesBg } from './background/ShaderLinesBg';
import { NenoShaderBg }  from './background/NenoShaderBg';

// Text effects
import { StaticText }       from './textEffect/StaticText';
import { FadeText }         from './textEffect/FadeText';
import { BlurText }         from './textEffect/BlurText';
import { GradientText }     from './textEffect/GradientText';
import { SplitText }        from './textEffect/SplitText';
import { TextType }         from './textEffect/TextType';
import { ShuffleText }      from './textEffect/ShuffleText';
import { FuzzyText }        from './textEffect/FuzzyText';
import { RotatingText }     from './textEffect/RotatingText';
import { GlitchText }       from './textEffect/GlitchText';
import { HandwritingText }  from './textEffect/HandwritingText';

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
    gradient:    GradientBg,
    blocks:      BlocksBg,
    aurora:      AuroraBg,
    ballpit:     BallpitBg,
    dotField:    DotFieldBg,
    dotGrid:     DotGridBg,
    silk:        SilkBg,
    threads:     ThreadsBg,
    lineWaves:   LineWavesBg,
    rippleGrid:  RippleGridBg,
    nebula:      NebulaBg,
    shaderLines: ShaderLinesBg,
    nenoShader:  NenoShaderBg,
  } as Record<string, React.FC<DimensionProps>>,

  textEffect: {
    static:       StaticText,
    fade:         FadeText,
    blurText:     BlurText,
    gradientText: GradientText,
    splitText:    SplitText,
    textType:     TextType,
    shuffleText:  ShuffleText,
    fuzzyText:    FuzzyText,
    rotatingText: RotatingText,
    glitchText:   GlitchText,
    handwriting:  HandwritingText,
  } as Record<string, React.FC<DimensionProps>>,

  entrance: {
    fadeSlideUp: FadeSlideUp,
    scaleIn:     ScaleIn,
    floatIn:     FloatIn,
    blurIn:      BlurIn,
  } as Record<string, React.FC<EntranceDimensionProps>>,
};
