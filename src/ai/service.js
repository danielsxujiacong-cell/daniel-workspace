import { mockProviderChat } from "./providers/mock-provider.js";
import { httpProviderChat } from "./providers/http-provider.js";

let activeProvider = "mock";
let apiUnavailable = false;
let providerResolved = false;

function configuredChatEndpoint() {
  const config = globalThis.DANIEL_AI_CONFIG;
  if (config?.provider !== "real" || config?.chatEndpoint !== "/api/chat") return null;
  return config.chatEndpoint;
}

function normalizeRequest(input = {}) {
  return {
    message: typeof input.message === "string" ? input.message.trim() : "",
    currentPage: typeof input.currentPage === "string" ? input.currentPage : "home",
    currentProject: input.currentProject && typeof input.currentProject === "object" ? input.currentProject : null,
    relevantContext: input.relevantContext && typeof input.relevantContext === "object" ? input.relevantContext : {},
    history: Array.isArray(input.history) ? input.history.slice(-10).filter((item) => ["user", "assistant"].includes(item?.role) && typeof item?.content === "string") : [],
  };
}

export function getAIStatus() {
  const realConfigured = Boolean(configuredChatEndpoint());
  if (!realConfigured) {
    activeProvider = "mock";
    apiUnavailable = false;
    providerResolved = false;
  } else if (!providerResolved) {
    activeProvider = "real";
  }
  const mode = realConfigured && activeProvider === "real" ? "real" : "mock";
  return {
    mode,
    label: mode === "real" ? "Real AI" : "Mock AI",
    hint: mode === "real" ? "服务端接口已启用" : apiUnavailable ? "接口不可用，已回退到本地 Mock" : "Real AI（以后启用）",
  };
}

export async function chat(input) {
  const request = normalizeRequest(input);
  if (!request.message) return { message: { role: "assistant", content: "请先输入你想了解的内容。" }, provider: "mock" };

  const endpoint = configuredChatEndpoint();
  if (!endpoint) {
    activeProvider = "mock";
    providerResolved = false;
    return mockProviderChat(request);
  }

  try {
    const response = await httpProviderChat(request, endpoint);
    activeProvider = response.provider;
    apiUnavailable = false;
    providerResolved = true;
    return response;
  } catch {
    activeProvider = "mock";
    apiUnavailable = true;
    providerResolved = true;
    return mockProviderChat(request);
  }
}
