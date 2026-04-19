import React from 'react';
import { Img } from 'remotion';
import { BannerConfig } from '../types/BannerConfig';
import { MARGIN_V, IMG_OFFSET } from '../layout';

// ── Mockup frame constants (iPhone 16 Pro Max frame: 1022×2082) ───────────────
// Identical to Auto-banner-OneClick/render-engine.js lines 17-23.
const MK_W = 1022;
const MK_H = 2082;

// Screen area within the mockup PNG, as percentages of the mockup dimensions.
// Original pixel values: left=52, top=46, width=918, height=1990, cornerRadius=126.
const SC_L  = (52   / MK_W) * 100;  // 5.09%
const SC_T  = (46   / MK_H) * 100;  // 2.21%
const SC_W  = (918  / MK_W) * 100;  // 89.83%
const SC_H  = (1990 / MK_H) * 100;  // 95.58%
const SC_RX = (126  / 918)  * 100;  // 13.73% — border-radius x (% of screen width)
const SC_RY = (126  / 1990) * 100;  //  6.33% — border-radius y (% of screen height)

export const ImageLayer: React.FC<{ config: BannerConfig }> = ({ config }) => {
  const { imageUrl, mockupUrl, dimensions, height } = config;
  const isTop = dimensions.layout === 'titleTop';

  // Title takes 26% of height; image occupies the remaining space.
  const imageAreaStyle: React.CSSProperties = isTop
    ? { position: 'absolute', top: height * IMG_OFFSET, bottom: height * MARGIN_V, left: 60, right: 60 }
    : { position: 'absolute', top: height * MARGIN_V, bottom: height * IMG_OFFSET, left: 60, right: 60 };

  return (
    <div style={imageAreaStyle}>
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* Mockup wrapper — maintains the 1022:2082 aspect ratio, height-constrained */}
        <div style={{
          position:    'relative',
          height:      '92%',
          aspectRatio: `${MK_W} / ${MK_H}`,
          maxWidth:    '92%',
          flexShrink:  0,
          transform:   `scale(${config.params?.mockup?.scale ?? 1.32})`,
        }}>

          {/* Mockup frame PNG — phone bezel sits at the bottom layer */}
          <Img
            src={mockupUrl}
            style={{
              position:  'absolute',
              inset:     0,
              width:     '100%',
              height:    '100%',
              objectFit: 'contain',
              zIndex:    1,
            }}
          />

          {/* Screenshot sits ON TOP of the mockup, covering its black screen area */}
          <div style={{
            position:     'absolute',
            left:         `${SC_L}%`,
            top:          `${SC_T}%`,
            width:        `${SC_W}%`,
            height:       `${SC_H}%`,
            borderRadius: `${SC_RX}% / ${SC_RY}%`,
            overflow:     'hidden',
            zIndex:       2,
          }}>
            <Img
              src={imageUrl}
              style={{
                display:        'block',
                width:          '100%',
                height:         '100%',
                objectFit:      'cover',
                objectPosition: 'top',
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
};
