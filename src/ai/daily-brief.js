import { verifiedProjectGitHubCommit } from "./project-next-step.js";

const text = (value, limit = 240) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export function buildDailyBriefContext(projects = []) {
  return (Array.isArray(projects) ? projects : [])
    .filter((project) => project?.isPinned === true)
    .slice(0, 5)
    .map((project) => {
      const commit = verifiedProjectGitHubCommit(project);
      return {
        name: text(project.name, 120),
        status: text(project.status, 80),
        stage: text(project.stage, 120),
        confirmedNextStep: text(project.next, 300),
        latestCommit: commit ? {
          message: text(commit.message, 240),
          committedAt: commit.committedAt,
          snapshotFresh: commit.fresh,
        } : null,
      };
    });
}

export function buildDailyBriefPrompt(context) {
  return [
    "根据下面仅含已确认字段的置顶项目 JSON，生成中文 AI 今日工作简报。不要使用外部知识、猜测进度或泛化建议。",
    "只返回 JSON，格式：{\"completed\":[{\"project\":\"项目名\",\"text\":\"最近完成事项\",\"basis\":\"真实提交摘要及时间\"}],\"recommendations\":[{\"project\":\"项目名\",\"text\":\"具体可执行的一件事\",\"basis\":\"状态/下一步/提交依据\"}],\"watch\":[{\"project\":\"项目名\",\"text\":\"值得关注的问题\",\"basis\":\"具体资料依据\"}]}。每部分可以为空；recommendations 最多 3 条。每条必须引用输入中存在的项目名并写清依据。",
    "completed 只能描述有真实 GitHub 最近提交支持的工作，提交不等于发布。推荐事项必须承接真实提交、已确认下一步或项目状态，不能只说继续推进、优化或创建任务。watch 只写资料能支持的问题；没有证据时返回空数组。缺少足够资料时相应部分留空，不要编造。",
    `项目资料：${JSON.stringify(context)}`,
  ].join("\n");
}

export function parseDailyBriefResponse(content, projects) {
  if (typeof content !== "string") throw new Error("GLM 未返回简报内容。");
  const stripped = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  let parsed;
  try { parsed = JSON.parse(stripped.slice(start, end + 1)); }
  catch { throw new Error("GLM 返回格式无法识别，请重试。"); }
  const allowed = new Set(projects.map((project) => project.name));
  const section = (key, limit) => {
    if (!Array.isArray(parsed?.[key])) throw new Error("GLM 返回的简报缺少必要部分，请重试。");
    return parsed[key].slice(0, limit).map((item) => {
      const project = text(item?.project, 120);
      const detail = text(item?.text, 300);
      const basis = text(item?.basis, 300);
      if (!allowed.has(project) || !detail || !basis) throw new Error("简报条目缺少有效项目或依据，请重试。");
      return { project, text: detail, basis };
    });
  };
  return {
    completed: section("completed", 5),
    recommendations: section("recommendations", 3),
    watch: section("watch", 5),
  };
}
