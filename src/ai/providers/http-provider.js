function timeoutSignal(milliseconds) {
  if (typeof AbortSignal.timeout === "function") return { signal: AbortSignal.timeout(milliseconds), cleanup() {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(Object.assign(new Error("AI request timed out."), { name: "TimeoutError" })), milliseconds);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

export async function httpProviderChat(request, endpoint, { timeoutMs } = {}) {
  const requestTimeout = timeoutMs ?? (request.currentPage === "home-daily-brief" ? 60_000 : 50_000);
  const { signal, cleanup } = timeoutSignal(requestTimeout);
  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal,
      body: JSON.stringify(request),
    });
  } catch (error) {
    cleanup();
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
    const failure = new Error(timedOut ? "AI Worker 请求超过等待时限，未生成简报；可重试。" : "无法连接 AI Worker，请检查网络后重试。");
    failure.code = timedOut ? "ai_timeout" : "ai_unavailable";
    throw failure;
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError" || signal.aborted;
    const failure = new Error(timedOut ? "AI Worker 响应内容读取超时，未生成简报；可重试。" : "AI Worker 返回的响应内容无法读取。");
    failure.code = timedOut ? "ai_timeout" : "ai_invalid_response";
    failure.status = response.status;
    cleanup();
    throw failure;
  }
  cleanup();
  if (!response.ok) {
    const failure = new Error(typeof result?.error?.message === "string" ? result.error.message : `AI service returned HTTP ${response.status}.`);
    failure.code = typeof result?.error?.code === "string" ? result.error.code : "ai_unavailable";
    failure.status = response.status;
    throw failure;
  }

  const content = result?.message?.content;
  if (result?.message?.role !== "assistant" || typeof content !== "string" || !content.trim() || result.provider !== "real") {
    const failure = new Error("AI service response did not match the GLM chat contract.");
    failure.code = "ai_invalid_response";
    throw failure;
  }
  return { message: { role: "assistant", content: content.trim() }, provider: "real", model: typeof result.model === "string" ? result.model : "glm-4-flash-250414" };
}
