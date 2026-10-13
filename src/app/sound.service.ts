import { Injectable } from '@angular/core';
export type Sfx = 'move' | 'capture' | 'castle' | 'check' | 'end' | 'illegal';

@Injectable({ providedIn: 'root' })
export class SoundService {
  muted = false;
  private ctx?: AudioContext;

  play(k: Sfx) {
    if (this.muted) return;
    const ac = (this.ctx ??= new AudioContext());
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    const tone = (f: number, d: number, type: OscillatorType = 'sine', v = 0.3, at = 0) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f, t + at);
      o.frequency.exponentialRampToValueAtTime(f * 0.5, t + at + d);
      g.gain.setValueAtTime(v, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + d);
      o.connect(g).connect(ac.destination);
      o.start(t + at); o.stop(t + at + d);
    };
    switch (k) {
      case 'move': tone(320, 0.09, 'triangle', 0.4); break;
      case 'capture': tone(200, 0.14, 'sawtooth', 0.18); tone(90, 0.2, 'sine', 0.5); break;
      case 'castle': tone(320, 0.09, 'triangle', 0.4); tone(260, 0.09, 'triangle', 0.4, 0.11); break;
      case 'check': tone(660, 0.12, 'square', 0.1); tone(880, 0.2, 'square', 0.1, 0.1); break;
      case 'end': [523, 659, 784].forEach((f, i) => tone(f, 0.4, 'sine', 0.25, i * 0.14)); break;
      case 'illegal': tone(130, 0.12, 'square', 0.08); break;
    }
  }
}