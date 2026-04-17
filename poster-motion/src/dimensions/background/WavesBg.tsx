import React, { useRef, useEffect } from 'react';
import { AbsoluteFill } from 'remotion';
import { DimensionProps } from '../../types/BannerConfig';
import { hexToRgba } from '../../utils/webgl';

// Faithful Remotion port of reactbits.dev Waves.
// Perlin-noise grid of vertical lines, deformed by noise over time.
// Mouse interaction omitted — pure noise-driven animation.

// ── Perlin noise (verbatim from reactbits Waves.jsx) ─────────────────────────
class Grad { constructor(public x:number,public y:number,public z:number){}
  dot2(x:number,y:number){return this.x*x+this.y*y;} }
const GRAD3=[new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
  new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
  new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];
const P=[151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,
  99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,
  57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,
  54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,
  86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,
  212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,
  70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,
  104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,
  239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,
  236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];

class Noise {
  perm:number[]=new Array(512); gradP:Grad[]=new Array(512);
  constructor(seed=0){
    if(seed>0&&seed<1)seed*=65536; seed=Math.floor(seed);
    if(seed<256)seed|=seed<<8;
    for(let i=0;i<256;i++){
      const v=i&1?P[i]^(seed&255):P[i]^((seed>>8)&255);
      this.perm[i]=this.perm[i+256]=v;
      this.gradP[i]=this.gradP[i+256]=GRAD3[v%12];
    }
  }
  fade(t:number){return t*t*t*(t*(t*6-15)+10);}
  lerp(a:number,b:number,t:number){return(1-t)*a+t*b;}
  perlin2(x:number,y:number){
    let X=Math.floor(x),Y=Math.floor(y);
    x-=X; y-=Y; X&=255; Y&=255;
    const n00=this.gradP[X+this.perm[Y]].dot2(x,y);
    const n01=this.gradP[X+this.perm[Y+1]].dot2(x,y-1);
    const n10=this.gradP[X+1+this.perm[Y]].dot2(x-1,y);
    const n11=this.gradP[X+1+this.perm[Y+1]].dot2(x-1,y-1);
    const u=this.fade(x);
    return this.lerp(this.lerp(n00,n10,u),this.lerp(n01,n11,u),this.fade(y));
  }
}

interface Point { x:number; y:number; wave:{x:number;y:number} }

export const WavesBg: React.FC<DimensionProps> = ({ frame, fps, palette, config }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const linesRef  = useRef<Point[][]>([]);
  const noiseRef  = useRef<Noise | null>(null);

  const W = config.width;
  const H = config.height;
  const X_GAP = 20;
  const Y_GAP = 72;
  const WAVE_SPD_X = 0.0125;
  const WAVE_SPD_Y = 0.005;
  const WAVE_AMP_X = 42;
  const WAVE_AMP_Y = 22;

  // Build grid once
  useEffect(() => {
    noiseRef.current = new Noise(0.42);
    const oW = W + 200, oH = H + 30;
    const totalLines  = Math.ceil(oW / X_GAP);
    const totalPoints = Math.ceil(oH / Y_GAP);
    const xStart = (W - X_GAP * totalLines)  / 2;
    const yStart = (H - Y_GAP * totalPoints) / 2;
    const lines: Point[][] = [];
    for (let i = 0; i <= totalLines; i++) {
      const pts: Point[] = [];
      for (let j = 0; j <= totalPoints; j++)
        pts.push({ x: xStart + X_GAP * i, y: yStart + Y_GAP * j, wave: { x: 0, y: 0 } });
      lines.push(pts);
    }
    linesRef.current = lines;
  }, [W, H]); // eslint-disable-line

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || linesRef.current.length === 0 || !noiseRef.current) return;
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const noise = noiseRef.current;

    // time in ms-equivalent (matches original: tick(t) where t is RAF ms)
    const timeMs = (frame / fps) * 1000;

    // Update wave offsets
    for (const pts of linesRef.current) {
      for (const p of pts) {
        const move = noise.perlin2(
          (p.x + timeMs * WAVE_SPD_X) * 0.002,
          (p.y + timeMs * WAVE_SPD_Y) * 0.0015
        ) * 12;
        p.wave.x = Math.cos(move) * WAVE_AMP_X;
        p.wave.y = Math.sin(move) * WAVE_AMP_Y;
      }
    }

    // Draw
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.strokeStyle = hexToRgba(palette.accent, 0.55);
    ctx.lineWidth   = 1.2;

    for (const points of linesRef.current) {
      const p0 = points[0];
      ctx.moveTo(p0.x + p0.wave.x, p0.y + p0.wave.y);
      for (let idx = 1; idx < points.length; idx++) {
        const p = points[idx];
        ctx.lineTo(p.x + p.wave.x, p.y + p.wave.y);
      }
    }
    ctx.stroke();
  }, [frame, fps, palette, W, H]); // eslint-disable-line

  return (
    <AbsoluteFill>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </AbsoluteFill>
  );
};
