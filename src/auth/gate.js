import { SUPABASE_ALLOWED_USER, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config.js?v=2.5.1";

const app = document.querySelector("#app");
const colorScheme = window.matchMedia("(prefers-color-scheme: light)");
const AUTH_STORAGE_KEY = "daniel-workspace-auth-v1";
let authClient = null;
let workspaceModule = null;
let workspaceVisible = false;
let signInBusy = false;
let signOutBusy = false;

document.documentElement.dataset.theme = colorScheme.matches ? "light" : "dark";

function loginMarkup() {
  return `<main class="login-screen"><section class="login-card" aria-labelledby="login-title"><div class="login-mark" aria-hidden="true">D</div><h1 id="login-title">Daniel Workspace</h1><p class="login-subtitle">私人 AI 工作台</p><form id="login-form" class="login-form"><label for="login-email">邮箱</label><input id="login-email" name="email" type="email" autocomplete="username" inputmode="email" required /><label for="login-password">密码</label><input id="login-password" name="password" type="password" autocomplete="current-password" required /><button class="login-submit" type="submit">登录</button><p id="login-status" class="login-status" role="status" aria-live="polite"></p></form></section></main>`;
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

function isConfigured() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const url = new URL(SUPABASE_URL);
    return url.protocol === "https:" && Boolean(url.hostname) && SUPABASE_ANON_KEY.trim().length >= 20;
  } catch {
    return false;
  }
}

function isAllowedUser(user) {
  const allowedUser = SUPABASE_ALLOWED_USER.trim();
  if (!allowedUser || !user) return false;
  if (allowedUser.includes("@")) {
    return typeof user.email === "string" && user.email.toLowerCase() === allowedUser.toLowerCase();
  }
  return typeof user.id === "string" && user.id.toLowerCase() === allowedUser.toLowerCase();
}

function unauthorizedMessage() {
  return SUPABASE_ALLOWED_USER.trim()
    ? "此 Supabase 账号没有进入工作台的权限。"
    : "登录配置尚未指定唯一允许账号，工作台保持锁定。";
}

async function enterWorkspace(user) {
  if (workspaceVisible) return;
  if (!isAllowedUser(user)) throw new Error("Unauthorized user");
  globalThis.DANIEL_WORKSPACE_AUTHENTICATED = true;
  try {
    workspaceModule = await import("../app.js?v=2.5.0");
    workspaceVisible = true;
  } catch (error) {
    globalThis.DANIEL_WORKSPACE_AUTHENTICATED = false;
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

async function handleLogin(event) {
  event.preventDefault();
  if (signInBusy || signOutBusy) return;
  if (!isConfigured() || !authClient) {
    setLoginStatus("登录服务尚未配置，暂时无法登录。");
    return;
  }

  const form = event.currentTarget;
  const submit = form.querySelector("button[type=submit]");
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  signInBusy = true;
  submit.disabled = true;
  submit.textContent = "正在登录…";
  setLoginStatus("");
  try {
    const { error } = await authClient.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) throw userError || new Error("Authentication failed");
    if (!isAllowedUser(user)) {
      await authClient.auth.signOut({ scope: "local" }).catch(() => {});
      clearAuthSessionStorage();
      const passwordField = form.elements.password;
      if (passwordField) passwordField.value = "";
      setLoginStatus(unauthorizedMessage());
      submit.disabled = false;
      submit.textContent = "登录";
      return;
    }
    await enterWorkspace(user);
  } catch {
    const passwordField = form.elements.password;
    if (passwordField) passwordField.value = "";
    setLoginStatus("邮箱或密码不正确，或登录服务暂不可用。");
    submit.disabled = false;
    submit.textContent = "登录";
  } finally {
    signInBusy = false;
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
  if (event.target.id === "login-form") void handleLogin(event);
});

// Handle logout before the authenticated application's delegated click listener.
app.addEventListener("click", (event) => {
  if (!event.target.closest('[data-action="logout"]')) return;
  event.preventDefault();
  void handleLogout();
}, true);

async function boot() {
  showLogin();
  if (!isConfigured()) return;

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2?target=es2022");
    authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        storageKey: AUTH_STORAGE_KEY,
      },
    });
    authClient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && workspaceVisible) lockWorkspace("已退出登录。");
    });

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
  } catch {
    authClient = null;
    showLogin("登录服务暂不可用，请检查网络或认证配置。");
  }
}

void boot();
