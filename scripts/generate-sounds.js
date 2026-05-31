const fs = require("fs");
const path = require("path");

const sampleRate = 44100;
const outDir = path.join(__dirname, "..", "assets", "sounds");

let seed = 891734;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

const clamp = (value) => Math.max(-1, Math.min(1, value));
const sine = (frequency, time) => Math.sin(Math.PI * 2 * frequency * time);
const triangle = (frequency, time) => (2 / Math.PI) * Math.asin(sine(frequency, time));
const square = (frequency, time) => (sine(frequency, time) >= 0 ? 1 : -1);
const noise = () => random() * 2 - 1;

const envelope = (index, total, attack = 0.01, release = 0.05) => {
  const t = index / sampleRate;
  const duration = total / sampleRate;
  const attackGain = attack <= 0 ? 1 : Math.min(1, t / attack);
  const releaseGain = release <= 0 ? 1 : Math.min(1, (duration - t) / release);
  return Math.max(0, Math.min(attackGain, releaseGain));
};

const writeWav = (name, samples) => {
  fs.mkdirSync(outDir, { recursive: true });
  const dataSize = samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  samples.forEach((sample, index) => {
    buffer.writeInt16LE(Math.round(clamp(sample) * 32767), 44 + index * 2);
  });

  fs.writeFileSync(path.join(outDir, `${name}.wav`), buffer);
};

const render = (duration, synth) => {
  const total = Math.max(1, Math.floor(duration * sampleRate));
  const samples = new Array(total);

  for (let index = 0; index < total; index += 1) {
    samples[index] = synth(index / sampleRate, index, total);
  }

  return samples;
};

const note = (frequency, start, duration, gain = 0.45, wave = sine) => (time, index, total) => {
  if (time < start || time > start + duration) {
    return 0;
  }

  const localIndex = Math.floor((time - start) * sampleRate);
  const noteTotal = Math.floor(duration * sampleRate);
  return wave(frequency, time - start) * envelope(localIndex, noteTotal, 0.008, 0.05) * gain;
};

const chord = (...notes) => (time, index, total) =>
  notes.reduce((sum, current) => sum + current(time, index, total), 0);

const sweep = (from, to, duration, gain = 0.45, wave = sine) => (time, index, total) => {
  const progress = Math.min(1, time / duration);
  const frequency = from + (to - from) * progress;
  return wave(frequency, time) * envelope(index, total, 0.006, 0.06) * gain;
};

const burst = (duration, gain = 0.25, lowpass = 0.35) => {
  let last = 0;
  return render(duration, (time, index, total) => {
    last += (noise() - last) * lowpass;
    return last * envelope(index, total, 0.002, 0.08) * gain;
  });
};

const mix = (duration, ...layers) =>
  render(duration, (time, index, total) =>
    layers.reduce((sum, layer) => sum + layer(time, index, total), 0)
  );

const withNoise = (duration, tonal, noiseGain = 0.04) =>
  render(duration, (time, index, total) =>
    tonal(time, index, total) + noise() * envelope(index, total, 0.001, 0.04) * noiseGain
  );

const sounds = {
  ui_tap: withNoise(0.06, note(660, 0, 0.05, 0.28, triangle), 0.018),
  back: mix(0.1, sweep(440, 260, 0.1, 0.3, triangle)),
  tab_switch: mix(0.09, note(520, 0, 0.045, 0.18, triangle), note(780, 0.035, 0.045, 0.18, triangle)),
  switch_on: mix(0.14, note(520, 0, 0.06, 0.22, triangle), note(880, 0.055, 0.08, 0.28, sine)),
  switch_off: mix(0.12, note(620, 0, 0.055, 0.2, triangle), note(360, 0.05, 0.07, 0.2, triangle)),
  number_key: withNoise(0.045, note(520, 0, 0.04, 0.14, triangle), 0.006),
  erase: mix(0.055, sweep(520, 380, 0.055, 0.22, square)),
  clear: mix(0.08, sweep(380, 220, 0.08, 0.26, triangle)),
  countdown_tick: mix(0.13, note(360, 0, 0.1, 0.16, triangle), note(540, 0.035, 0.08, 0.08, sine)),
  countdown_go: mix(0.3, note(392, 0, 0.14, 0.18, triangle), note(523.25, 0.08, 0.16, 0.18, triangle), note(659.25, 0.17, 0.1, 0.12, sine)),
  guess_lock: mix(0.18, note(196, 0, 0.1, 0.12, triangle), note(293.66, 0.06, 0.1, 0.14, triangle), note(440, 0.12, 0.05, 0.08, sine)),
  higher: mix(0.22, note(330, 0, 0.09, 0.14, triangle), note(440, 0.07, 0.1, 0.13, triangle), note(554.37, 0.145, 0.06, 0.07, sine)),
  lower: mix(0.22, note(554.37, 0, 0.08, 0.11, triangle), note(440, 0.065, 0.1, 0.13, triangle), note(330, 0.145, 0.07, 0.09, sine)),
  correct: mix(0.28, note(523.25, 0, 0.11, 0.24, triangle), note(659.25, 0.07, 0.13, 0.24, triangle), note(987.77, 0.14, 0.12, 0.26, sine)),
  missed: mix(0.13, note(180, 0, 0.11, 0.18, triangle), note(150, 0.025, 0.09, 0.16, triangle)),
  error: mix(0.16, note(190, 0, 0.075, 0.22, square), note(170, 0.065, 0.075, 0.22, square)),
  victory: mix(0.62, note(523.25, 0, 0.18, 0.2, triangle), note(659.25, 0.12, 0.2, 0.22, triangle), note(783.99, 0.24, 0.22, 0.24, sine), note(1046.5, 0.38, 0.2, 0.24, sine)),
  defeat: mix(0.5, note(392, 0, 0.18, 0.22, triangle), note(311.13, 0.15, 0.2, 0.22, triangle), note(220, 0.31, 0.16, 0.2, triangle)),
  tie: mix(0.34, note(440, 0, 0.14, 0.21, triangle), note(660, 0.09, 0.14, 0.21, triangle), note(440, 0.2, 0.12, 0.18, triangle)),
  round_clear: mix(0.45, note(587.33, 0, 0.14, 0.22, triangle), note(880, 0.12, 0.16, 0.24, sine), note(1174.66, 0.25, 0.16, 0.22, sine)),
  game_over: mix(0.48, sweep(260, 110, 0.42, 0.3, triangle), note(92, 0.24, 0.18, 0.14, sine)),
  coin_reward: mix(0.32, note(988, 0, 0.08, 0.2, sine), note(1320, 0.055, 0.08, 0.18, sine), note(1760, 0.115, 0.12, 0.18, sine), note(2349, 0.18, 0.08, 0.12, sine)),
  powerup: mix(0.36, sweep(330, 1200, 0.28, 0.28, triangle), note(1800, 0.2, 0.08, 0.12, sine)),
  revive: mix(0.44, note(260, 0, 0.13, 0.18, triangle), note(520, 0.1, 0.16, 0.22, triangle), note(1040, 0.25, 0.14, 0.24, sine)),
  purchase_success: mix(0.36, note(740, 0, 0.1, 0.22, triangle), note(988, 0.085, 0.12, 0.24, sine), note(1480, 0.18, 0.11, 0.2, sine)),
  purchase_fail: mix(0.28, note(210, 0, 0.12, 0.24, square), note(180, 0.11, 0.12, 0.22, square)),
  online_notify: mix(0.24, note(660, 0, 0.09, 0.2, triangle), note(990, 0.09, 0.1, 0.22, triangle)),
  timer_low: mix(0.09, note(1100, 0, 0.055, 0.28, square)),
  modal_open: mix(0.16, sweep(500, 700, 0.12, 0.18, triangle), note(900, 0.07, 0.06, 0.12, sine)),
  achievement: mix(0.7, note(659.25, 0, 0.12, 0.18, triangle), note(783.99, 0.1, 0.14, 0.19, triangle), note(987.77, 0.22, 0.16, 0.2, sine), note(1318.51, 0.38, 0.2, 0.18, sine))
};

Object.entries(sounds).forEach(([name, samples]) => {
  writeWav(name, samples);
});

writeWav("soft_noise", burst(0.12, 0.13, 0.2));

console.log(`Generated ${Object.keys(sounds).length + 1} sounds in ${outDir}`);
