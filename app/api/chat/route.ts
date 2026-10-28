export async function POST(req: Request) {
  const reply = (msg: string) =>
    new Response(msg, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  try {
    const { messages } = await req.json();

    const key = (process.env.GROQ_API_KEY ?? "").trim();
    if (!key) {
      return reply("Setup error: GROQ_API_KEY is missing in this Vercel project. Add it in Settings → Environment Variables, then redeploy.");
    }

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: (process.env.GROQ_MODEL ?? "llama-3.1-8b-instant").trim(),
        messages: [
          { role: "system", content: "You are Faith AI, a helpful, concise and friendly assistant." },
          ...messages,
        ],
        temperature: 0.3,
      }),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return reply(`Groq error ${upstream.status}: ${JSON.stringify(data).slice(0, 300)}`);
    }

    return reply(data?.choices?.[0]?.message?.content ?? "Empty reply from Groq.");
  } catch (e) {
    return reply(`Server error: ${e instanceof Error ? e.message : String(e)}`);
  }
}
