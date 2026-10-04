import { mockProviderChat } from "./providers/mock-provider.js";
import { httpProviderChat } from "./providers/http-provider.js?v=2.7.0";
import { getAIConfig } from "./config.js?v=2.7.0";

let apiUnavailable = false;
let lastModel = "glm-4-flash-250414";

function configuredChatEndpoint() {
  const config = getAIConfig();
  try {
    const endpoint = new URL(config.chatEndpoint);
    const localWorker = endpoint.protocol === "http:" && endpoint.hostname === "127.0.0.1" && endpoint.port === "8787";
    const cloudflareWorker = endpoint.protocol === "https:" && endpoint.hostname.endsWith(".workers.dev");
    if (config.provider !== "real" || endpoint.pathname !== "/api/chat" || (!localWorker && !cloudflareWorker)) return null;
    return config;
  } catch {
    return null;
  }
}

function normalizeRequest(input = {}) {
  return {
    message: typeof input.message === "string" ? input.message.trim() : "",
    currentPage: typeof input.currentPage === "string" ? input.currentPage : "home",
    currentProject: input.currentProject && typeof input.currentProject === "object" ? input.currentProject : null,
    relevantContext: input.relevantContext && typeof input.relevantContext === "object" ? input.relevantContext : {},
    history: Array.isArray(input.history) ? input.history.slice(-20).filter((item) => ["user", "assistant"].includes(item?.role) && typeof item?.content === "string").map((item) => ({ role: item.role, content: item.content.slice(0, 1_200) })) : [],
  };
}

export function getAIStatus() {
  const mode = configuredChatEndpoint() ? "real" : "mock";
  return {
    mode,
    label: mode === "real" ? "GLM-4-Flash" : "本地 Mock",
    hint: mode === "real" ? apiUnavailable ? "智谱 BigModel · 上次请求失败，可重试" : `智谱 BigModel · ${lastModel}` : "仅本地生成，不会请求 AI 服务",
  };
}

export function getAIErrorMessage(error) {
  const messages = {
    ai_not_configured: "智谱服务尚未配置 AI_API_KEY，请设置 Worker Secret 后重试。",
    ai_rate_limited: "AI 请求较多，请稍后重试。",
    ai_timeout: "AI 服务响应超时，请重试。",
    ai_auth_failed: "Worker 的智谱 Key 未通过验证，请更新 AI_API_KEY Secret。",
    ai_request_too_large: "本次发送内容较多，请缩小问题范围后重试。",
    ai_context_too_large: "Workspace 上下文较多，请缩小问题范围后重试。",
    ai_invalid_request: "AI 请求格式无效，请重新发送。",
  };
  return messages[error?.code] || "AI 服务暂时不可用，请重试。";
}

export async function chat(input) {
  const request = normalizeRequest(input);
  if (!request.message) return { message: { role: "assistant", content: "请先输入你想了解的内容。" }, provider: "mock" };

  const config = configuredChatEndpoint();
  if (!config) return mockProviderChat(request);

  try {
    const response = await httpProviderChat(request, config.chatEndpoint);
    apiUnavailable = false;
    lastModel = response.model || config.model || lastModel;
    return response;
  } catch (error) {
    apiUnavailable = true;
    throw error;
  }
}
