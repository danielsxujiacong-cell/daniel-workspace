import { httpProviderChat } from './providers/http-provider.js?v=4.5.2';
export function getAIStatus() { return {mode:'real',label:'GLM-4-Flash',hint:'仅依据已发布公开项目 · 对话不保存'}; }
export function getAIErrorMessage(error) { return error?.message || '访客 AI 暂不可用，请重试。'; }
export async function chat(input) {
  return httpProviderChat({message:input.message,currentPage:'public-projects',publishedAt:globalThis.DANIEL_WORKSPACE_PUBLIC_SNAPSHOT?.publishedAt,history:input.history?.slice(-6)||[]},
    new URL('../../api/public/chat',import.meta.url).href);
}
