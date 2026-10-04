const MODEL = "glm-4-flash-250414";
const WORKER_CHAT_ENDPOINT = "https://daniel-workspace-api.ai-investment-dashboard.workers.dev/api/chat";

export function getAIConfig() {
  const runtimeConfig = globalThis.DANIEL_AI_CONFIG;
  const isLocalPreview = ["localhost", "127.0.0.1"].includes(globalThis.location?.hostname);
  const chatEndpoint = isLocalPreview
    ? "http://127.0.0.1:8787/api/chat"
    : typeof runtimeConfig?.chatEndpoint === "string" ? runtimeConfig.chatEndpoint : WORKER_CHAT_ENDPOINT;
  return { provider: runtimeConfig?.provider || "real", chatEndpoint, model: runtimeConfig?.model || MODEL };
}
