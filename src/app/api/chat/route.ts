import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, model, temperature, maxTokens, thinkingEffort } = await req.json();

    // Inject "Thinking Effort" instructions silently if the user requests it
    let finalMessages = [...messages];
    if (thinkingEffort === "high") {
      finalMessages.unshift({ role: "system", content: "You must think deeply and extensively before answering. Provide a very long, detailed thought process." });
    } else if (thinkingEffort === "low") {
      finalMessages.unshift({ role: "system", content: "Keep your thought process extremely brief and answer immediately." });
    }

    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'gpt-oss:20b',
        messages: finalMessages,
        stream: false, 
        options: {
          temperature: temperature || 0.7,
          num_ctx: maxTokens || 8192 // This applies the Context Length slider to Ollama
        }
      }),
    });

    if (!response.ok) throw new Error(`Ollama returned status: ${response.status}`);

    const data = await response.json();
    return NextResponse.json(data.message);
    
  } catch (error) {
    console.error("Local AI Engine Error:", error);
    return NextResponse.json({ error: "Failed to connect to local AI engine." }, { status: 500 });
  }
}