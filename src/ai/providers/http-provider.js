function timeoutSignal(milliseconds) {
  if (typeof AbortSignal.timeout === "function") return { signal: AbortSignal.timeout(milliseconds), cleanup() {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(Object.assign(new Error("AI request timed out."), { name: "TimeoutError" })), milliseconds);
  return { signal: controller.signal, cleanup: () => clearTimeout(timer) };
}

export async function httpProviderChat(request, endpoint) {
  const { signal, cleanup } = timeoutSignal(50_000);
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
    const failure = new Error(error?.name === "TimeoutError" || error?.name === "AbortError" ? "AI request timed out." : "AI service could not be reached.");
    failure.code = error?.name === "TimeoutError" || error?.name === "AbortError" ? "ai_timeout" : "ai_unavailable";
    throw failure;
  }
  cleanup();

  let result;
  try {
    result = await response.json();
  } catch {
    const failure = new Error("AI service returned an unreadable response.");
    failure.code = "ai_invalid_response";
    failure.status = response.status;
    throw failure;
  }
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