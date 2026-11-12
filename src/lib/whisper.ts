import "server-only";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

const MODEL = "onnx-community/whisper-base";

// Carrega o modelo uma única vez por processo (fica em memória pelo resto da
// vida do servidor) — a primeira transcrição depois de cada deploy/restart
// baixa o modelo (~76MB) e demora alguns segundos a mais que as seguintes.
let transcriberPromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", MODEL, { dtype: "q8" });
  }
  return transcriberPromise;
}

/** Converte qualquer áudio (o Telegram manda OGG/Opus) pra PCM float32 16kHz mono, que o Whisper espera. */
function convertToPcm(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpegPath as unknown as string, ["-i", "pipe:0", "-f", "f32le", "-ar", "16000", "-ac", "1", "pipe:1"]);
    const chunks: Buffer[] = [];
    ff.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    ff.on("error", reject);
    ff.on("close", (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg saiu com código ${code}.`));
      resolve(Buffer.concat(chunks));
    });
    ff.stdin.write(input);
    ff.stdin.end();
  });
}

/** Transcreve um áudio de voz (buffer no formato original, ex.: OGG/Opus) pra texto em português. */
export async function transcribeAudio(input: Buffer): Promise<string> {
  const pcm = await convertToPcm(input);
  const audioData = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.length / Float32Array.BYTES_PER_ELEMENT);

  const transcriber = await getTranscriber();
  const result = await transcriber(audioData, { language: "portuguese" });
  const text = Array.isArray(result) ? result[0]?.text : result.text;
  return (text ?? "").trim();
}
