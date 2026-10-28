export async function POST(req: Request) {
  const { messages } = await req.json();

  const text = (msg: string) =>
    new Response(msg, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  if (!process.env.GROQ_API_KEY) {
    return text("Setup error: GROQ_API_KEY is missing in Vercel. Add it under Settings → Environment Variables, then redeploy.");
  }

  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY.trim()}`,
    },
    body: JSON.stringify({
      model: (process.env.GROQ_MODEL ?? "llama-3.1-8b-instant").trim(),
      messages: [
        { role: "system", content: "You are Faith AI, a helpful, concise and friendly assistant." },
        ...messages,
      ],
      stream: true,
      temperature: 0.3,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    return text(`Groq error ${upstream.status}: ${detail.slice(0, 300)}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const token = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
              if (token) controller.enqueue(encoder.encode(token));
            } catch {}
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}