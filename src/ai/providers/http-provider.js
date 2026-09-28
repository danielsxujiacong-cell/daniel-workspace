const CHAT_ENDPOINT = "/api/chat";

export async function httpProviderChat(request, endpoint = CHAT_ENDPOINT) {
  if (endpoint !== CHAT_ENDPOINT) throw new Error("The AI endpoint must use the same-origin /api/chat route.");
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(`AI service returned HTTP ${response.status}.`);

  const result = await response.json();
  const content = result?.message?.content;
  if (result?.message?.role !== "assistant" || typeof content !== "string" || !content.trim()) {
    throw new Error("AI service response did not match the chat contract.");
  }
  if (!(["real", "mock"].includes(result.provider))) throw new Error("AI service provider was not identified.");
  return { message: { role: "assistant", content: content.trim() }, provider: result.provider };
}
