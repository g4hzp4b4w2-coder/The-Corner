// Native equivalent of web's lib/gongSound.js. Web synthesizes these tones
// live with the Web Audio API; React Native has no equivalent oscillator
// API, so the exact same tone design (partials/envelope) was baked once
// into WAV files (see scripts/generate-sounds.js) and is just played back
// here.
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

const gongSource = require('../assets/sounds/gong.wav');
const hitSuccessSource = require('../assets/sounds/hit_success.wav');
const hitFailSource = require('../assets/sounds/hit_fail.wav');

let gongPlayer: AudioPlayer | null = null;
let hitSuccessPlayer: AudioPlayer | null = null;
let hitFailPlayer: AudioPlayer | null = null;

function playFromStart(getPlayer: () => AudioPlayer) {
  try {
    const player = getPlayer();
    player.seekTo(0);
    player.play();
  } catch {
    // Sound is a nice-to-have, same as the web version -- never worth
    // breaking the round flow over.
  }
}

export function playGong() {
  playFromStart(() => gongPlayer ?? (gongPlayer = createAudioPlayer(gongSource)));
}

export function playHitTone(success: boolean = true) {
  playFromStart(() =>
    success
      ? (hitSuccessPlayer ?? (hitSuccessPlayer = createAudioPlayer(hitSuccessSource)))
      : (hitFailPlayer ?? (hitFailPlayer = createAudioPlayer(hitFailSource))),
  );
}
