export default async function handler(req, res) {
  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGIN || "https://stock-app-gray-seven.vercel.app").split(",");
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GOOGLE_TTS_API_KEY not configured" });

  try {
    const { text, lang, speed, voice } = req.body;
    const isEn = lang === "en";
    const voiceName = voice || (isEn ? "en-US-Neural2-J" : "th-TH-Neural2-C");
    const languageCode = voiceName.startsWith("en") ? "en-US" : "th-TH";

    const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: {
          languageCode,
          name: voiceName,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: speed || 1.0,
          pitch: 0,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    res.status(200).json({ audio: data.audioContent });
  } catch (e) {
    console.error("TTS error:", e.message);
    res.status(500).json({ error: "Internal server error" });
  }
}
