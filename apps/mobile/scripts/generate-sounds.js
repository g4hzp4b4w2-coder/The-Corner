// Generates the round-cue WAV assets under ../assets/sounds/.
//
// Web's lib/gongSound.js synthesizes these tones live with the Web Audio
// API (no file to bundle/license) -- React Native has no equivalent
// synthesis API, so instead this script bakes the exact same partials/
// envelope into static WAV files once, checked into the repo like any
// other asset. Re-run with `node scripts/generate-sounds.js` if the tone
// design ever needs to change; nothing at runtime depends on this script.
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

function writeWav(filePath, samples) {
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }
  fs.writeFileSync(filePath, buffer);
}

function silence(durationSec) {
  return new Float32Array(Math.round(SAMPLE_RATE * durationSec));
}

function addOscillator(target, freq, peak, attackSec, decaySec, startSec) {
  const startSample = Math.round(startSec * SAMPLE_RATE);
  const totalSec = attackSec + decaySec;
  const n = Math.round(totalSec * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let env;
    if (t < attackSec) {
      env = peak * (t / attackSec);
    } else {
      // exponentialRampToValueAtTime(0.001, ...) equivalent decay curve
      const dt = (t - attackSec) / decaySec;
      env = peak * Math.pow(0.001 / peak, dt);
    }
    const sample = env * Math.sin(2 * Math.PI * freq * t);
    const idx = startSample + i;
    if (idx < target.length) target[idx] += sample;
  }
}

function makeGong() {
  const partials = [110, 164, 220, 330];
  const buf = silence(1.9);
  partials.forEach((freq, i) => {
    const peak = 0.3 / (i + 1);
    addOscillator(buf, freq, peak, 0.02, 1.78, 0);
  });
  return buf;
}

function makeHitTone(success) {
  const buf = silence(0.13);
  addOscillator(buf, success ? 880 : 220, 0.25, 0.01, 0.11, 0);
  return buf;
}

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });
writeWav(path.join(outDir, 'gong.wav'), makeGong());
writeWav(path.join(outDir, 'hit_success.wav'), makeHitTone(true));
writeWav(path.join(outDir, 'hit_fail.wav'), makeHitTone(false));
console.log('Wrote gong.wav, hit_success.wav, hit_fail.wav to', outDir);
