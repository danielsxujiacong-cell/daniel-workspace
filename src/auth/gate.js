import { resolveEntryMode } from "./entry-mode.js";

const app = document.querySelector("#app");
const entryMode = resolveEntryMode(window.location.search);
const colorScheme = window.matchMedia("(prefers-color-scheme: light)");
const AUTH_STORAGE_KEY = "daniel-workspace-auth-v1";
let authClient = null;
let supabaseConfigPromise = null;
let authConfig = { SUPABASE_ALLOWED_USER: "" };
let workspaceModule = null;
let workspaceVisible = false;
let signInBusy = false;
let signOutBusy = false;
let authInitializationError = "";

document.documentElement.dataset.theme = colorScheme.matches ? "light" : "dark";

function loginMarkup() {
  return `<main class="login-screen"><section class="login-card" aria-labelledby="login-title"><div class="login-mark" aria-hidden="true">D</div><h1 id="login-title">Daniel Workspace</h1><p class="login-subtitle">私人 AI 工作台</p><form id="login-form" class="login-form"><label for="login-email">邮箱</label><input id="login-email" name="email" type="email" autocomplete="username" inputmode="email" required /><label for="login-password">密码</label><input id="login-password" name="password" type="password" autocomplete="current-password" required /><button class="login-submit" type="submit">登录</button><p id="login-status" class="login-status" role="status" aria-live="polite"></p></form><div class="login-divider"><span>或</span></div><a class="guest-entry" href="?mode=guest">访客演示 <span>浏览模拟企业运营工作区</span></a></section></main>`;
}

function showLogin(message = "") {
  app.innerHTML = loginMarkup();
  const status = app.querySelector("#login-status");
  if (status) status.textContent = message;
}

function setLoginStatus(message, isError = true) {
  const status = app.querySelector("#login-status");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function getSupabaseConfig() {
  if (!supabaseConfigPromise) supabaseConfigPromise = import("./config.js");
  return supabaseConfigPromise;
}

async function isConfigured() {
  const config = await getSupabaseConfig();
  authConfig = config;
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = config;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const url = new URL(SUPABASE_URL);
    return url.protocol === "https:" && Boolean(url.hostname) && SUPABASE_ANON_KEY.trim().length >= 20;
  } catch {
    return false;
  }
}

async function initializeAuthClient() {
  if (authClient) return authClient;
  const { SUPABASE_ANON_KEY, SUPABASE_URL } = await getSupabaseConfig();
  const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2?target=es2022");
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      storageKey: AUTH_STORAGE_KEY,
    },
  });
  client.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT" && workspaceVisible) lockWorkspace("已退出登录。");
  });
  authClient = client;
  authInitializationError = "";
  return client;
}

function isAllowedUser(user) {
  const allowedUser = authConfig.SUPABASE_ALLOWED_USER.trim();
  if (!allowedUser || !user) return false;
  if (allowedUser.includes("@")) {
    return typeof user.email === "string" && user.email.toLowerCase() === allowedUser.toLowerCase();
  }
  return typeof user.id === "string" && user.id.toLowerCase() === allowedUser.toLowerCase();
}

function unauthorizedMessage() {
  return authConfig.SUPABASE_ALLOWED_USER.trim()
    ? "此 Supabase 账号没有进入工作台的权限。"
    : "登录配置尚未指定唯一允许账号，工作台保持锁定。";
}

function loginErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  const status = Number(error?.status) || 0;
  if (/invalid login credentials|invalid credentials/i.test(message)) return "邮箱或密码不正确，请检查后重试。";
  if (/failed to fetch|networkerror|load failed|fetch failed/i.test(message)) return "无法连接 Supabase Auth。请检查网络和 Supabase 项目 URL 后重试。";
  if (/invalid api key/i.test(message)) return "Supabase 公共 API key 无效，请检查前端配置。";
  if (status === 429) return "登录尝试过多，请稍后再试。";
  if (message) return `登录失败：${message}`;
  return status ? `登录失败（HTTP ${status}），请稍后重试。` : "登录过程中发生意外错误，请刷新页面后重试。";
}

async function enterWorkspace(user) {
  if (workspaceVisible) return;
  if (!isAllowedUser(user)) throw new Error("Unauthorized user");
  globalThis.DANIEL_WORKSPACE_AUTHENTICATED = true;
  globalThis.DANIEL_WORKSPACE_AUTH = { client: authClient, userId: user.id };
  try {
    workspaceModule = await import("../app.js?v=3.3.1");
    workspaceVisible = true;
  } catch (error) {
    globalThis.DANIEL_WORKSPACE_AUTHENTICATED = false;
    globalThis.DANIEL_WORKSPACE_AUTH = null;
    throw error;
  }
}

function lockWorkspace(message = "") {
  if (!workspaceVisible) {
    showLogin(message);
    return;
  }
  workspaceVisible = false;
  globalThis.DANIEL_WORKSPACE_AUTHENTICATED = false;
  workspaceModule?.clearPrivateWorkspace();
  globalThis.DANIEL_WORKSPACE_AUTH = null;
  showLogin(message);
}

function clearAuthSessionStorage() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(`${AUTH_STORAGE_KEY}-code-verifier`);
  } catch {
    // The private DOM stays locked even when browser storage is unavailable.
  }
}

function recoverLoginForm(form, error) {
  signInBusy = false;
  const submit = form?.querySelector('button[type="submit"]');
  const passwordInput = form?.querySelector("#login-password");
  if (passwordInput) passwordInput.value = "";
  if (submit) {
    submit.disabled = false;
    submit.textContent = "登录";
  }
  setLoginStatus(loginErrorMessage(error));
}

async function handleLogin(form) {
  if (signInBusy || signOutBusy) {
    setLoginStatus("登录正在处理中，请稍候。", false);
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  const emailInput = form.querySelector("#login-email");
  const passwordInput = form.querySelector("#login-password");
  if (!submit || !emailInput || !passwordInput) {
    setLoginStatus("登录表单未正确加载，请刷新页面后重试。");
    return;
  }
  if (!(await isConfigured())) {
    setLoginStatus("Supabase 登录配置不完整，暂时无法登录。");
    return;
  }
  signInBusy = true;
  submit.disabled = true;
  submit.textContent = "正在登录…";
  setLoginStatus("正在连接 Supabase Auth…", false);
  try {
    const client = await initializeAuthClient();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) throw userError || new Error("Authentication failed");
    if (!isAllowedUser(user)) {
      await client.auth.signOut({ scope: "local" }).catch(() => {});
      clearAuthSessionStorage();
      passwordInput.value = "";
      setLoginStatus(unauthorizedMessage());
      return;
    }
    await enterWorkspace(user);
  } catch (error) {
    passwordInput.value = "";
    if (!authClient) authInitializationError = `登录服务初始化失败：${loginErrorMessage(error)}`;
    setLoginStatus(loginErrorMessage(error));
  } finally {
    signInBusy = false;
    if (submit.isConnected) {
      submit.disabled = false;
      submit.textContent = "登录";
    }
  }
}

async function handleLogout() {
  if (!authClient || signOutBusy) return;
  signOutBusy = true;
  const client = authClient;
  lockWorkspace("已退出登录。");
  clearAuthSessionStorage();
  try {
    await client.auth.stopAutoRefresh();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Local session storage is cleared below even when Supabase cannot be reached.
  }
  clearAuthSessionStorage();
  authClient = null;
  window.location.replace(`${window.location.pathname}${window.location.search}`);
}

app.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || form.id !== "login-form") return;
  event.preventDefault();
  void handleLogin(form).catch((error) => recoverLoginForm(form, error));
});

// Handle logout before the authenticated application's delegated click listener.
app.addEventListener("click", (event) => {
  if (!event.target.closest('[data-action="logout"]')) return;
  event.preventDefault();
  void handleLogout();
}, true);

async function boot() {
  showLogin();
  if (!(await isConfigured())) return;

  try {
    await initializeAuthClient();

    const { data: { session }, error } = await authClient.auth.getSession();
    if (error) throw error;
    if (!session) return;
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user || !isAllowedUser(user)) {
      await authClient.auth.signOut({ scope: "local" }).catch(() => {});
      clearAuthSessionStorage();
      if (user && !userError) showLogin(unauthorizedMessage());
      return;
    }
    await enterWorkspace(user);
  } catch (error) {
    authInitializationError = `登录服务初始化失败：${loginErrorMessage(error)}`;
    showLogin(authInitializationError);
  }
}

async function startGuestDemo() {
  app.innerHTML = `<main class="login-screen"><section class="login-card guest-loading"><div class="login-mark" aria-hidden="true">D</div><h1>正在打开访客演示…</h1></section></main>`;
  const { mountGuestDemo } = await import("../guest-demo.js");
  mountGuestDemo({
    root: app,
    onExit: () => window.location.replace(`${window.location.pathname}?mode=login`),
  });
}

if (entryMode === "guest") {
  void startGuestDemo();
} else if (entryMode === "login") {
  showLogin();
} else {
  void boot();
}
