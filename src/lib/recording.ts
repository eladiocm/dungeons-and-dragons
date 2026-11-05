/** PCM16 mono WAV; shared with the server's duration validation. */
export function encodeWav(
  samples: Float32Array,
  sampleRate = 16000,
): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2),
    v = new DataView(buffer);
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      v.setUint8(offset + i, text.charCodeAt(i));
  };
  write(0, 'RIFF');
  v.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, 'data');
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 32768 : s * 32767, true);
  }
  return buffer;
}
export async function recordingToWav(blob: Blob): Promise<string> {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (audio.duration > 45.5)
      throw new Error('La grabación supera los 45 segundos.');
    const count = Math.floor(Math.min(45, audio.duration) * 16000),
      samples = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const position = (i * audio.sampleRate) / 16000,
        left = Math.floor(position),
        weight = position - left;
      let value = 0;
      for (let c = 0; c < audio.numberOfChannels; c++) {
        const data = audio.getChannelData(c);
        value +=
          (data[left] || 0) * (1 - weight) +
          (data[Math.min(left + 1, data.length - 1)] || 0) * weight;
      }
      samples[i] = value / audio.numberOfChannels;
    }
    const bytes = new Uint8Array(encodeWav(samples));
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  } finally {
    await context.close();
  }
}
