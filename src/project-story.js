import { parsePublicGitHubRepository } from "./github/public-api.js";

const PROJECT_INTROS = {
  "ai-investment-dashboard": "整合真实行情、个人持仓和 AI 研究，帮助投资者集中跟踪组合并做决策。",
  "daniel-project-hub": "集中展示 AI 产品、网站和实验作品，让访客快速找到并体验每个项目。",
  "personal-portfolio": "用滚动交互和 3D 动画展示个人作品，帮助访客直观了解设计与开发能力。",
  "daniel-workspace": "集中管理项目、待办和工作记录，并用 AI 整理进展与下一步。",
  "n8n-ai-automation-lab": "在本机搭建采购审批自动化流程，让已批准申请生成工单并补充 AI 分析。",
};

const COMMIT_STORIES = {
  "daniel-project-hub": {
    "add dify knowledge demo to flowops": "加入可体验的企业知识库问答入口，让访客直接查询采购制度和申请流程。",
    "record flowops deployment verification": "完成 FlowOps 上线检查，确认展示页及静态资源均已正常发布。",
  },
  "ai-investment-dashboard": {
    "map ai chat route to edgeone directory root": "调整 AI 对话接口文件位置，使它匹配 EdgeOne 的线上路由规则。",
  },
  "n8n-ai-automation-lab": {
    "chore: archive safe workflows for steps 01-03d": "整理并归档采购审批与 AI 分析流程配置，方便在新环境安全复用；归档不含凭据或运行数据。",
  },
  "personal-portfolio": {
    "add portfolio footer copyright": "为个人作品集补充页脚版权信息。",
  },
  "daniel-workspace": {
    "v3.7 精简 workspace 全站 ui": "精简首页与项目页的信息层级，让重点项目、进展和待办更容易查看。",
  },
};

function repoKey(project) {
  return parsePublicGitHubRepository(project?.github)?.repository?.toLowerCase() || "";
}

function normalizedMessage(value) {
  return String(value || "").trim().replace(/[–—]/g, "-").replace(/\s+/g, " ").toLocaleLowerCase();
}

function looksLikeScanMetadata(value) {
  const text = String(value || "").trim();
  return /扫描时.{0,50}(?:README|标记|版本)|README\s*(?:标记|版本|扫描)|\bStep\s*0?\d+(?:[.-][A-Z\d]+)?\s*(?:已导入|完成|进行中)?|(?:HANDOFF|PROJECT_STATUS)\s*(?:标记|扫描)/i.test(text);
}

export function projectIntroduction(project) {
  const description = typeof project?.description === "string" ? project.description.trim() : "";
  if (description && !looksLikeScanMetadata(description)) return description;
  return PROJECT_INTROS[repoKey(project)] || "";
}

export function projectDescriptionForEdit(project) {
  return projectIntroduction(project) || (typeof project?.description === "string" ? project.description : "");
}

export function projectDescriptionAfterEdit(project, editedDescription) {
  return editedDescription === projectIntroduction(project)
    ? (typeof project?.description === "string" ? project.description : "")
    : editedDescription;
}

export function humanizeProjectCommit(project, commit) {
  const repository = repoKey(project);
  const message = typeof commit?.message === "string" ? commit.message.trim() : "";
  if (!repository || !message) return "";
  const exact = COMMIT_STORIES[repository]?.[normalizedMessage(message)];
  if (exact) return exact;
  if (/\p{Script=Han}/u.test(message) && !/^(?:docs|chore|test|style|refactor)(?:\(|:)/i.test(message)) {
    return message.replace(/^(?:feat|fix|chore|docs|refactor)(?:\([^)]*\))?:\s*/i, "").trim();
  }
  return "";
}
