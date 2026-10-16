import { readProjectProfile } from "./project-profile.js?v=4.7";
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

const PROJECT_SHOWCASES = {
  "ai-investment-dashboard": {
    features: [
      "查看市场行情、自选列表和个人持仓趋势。",
      "集中记录投资研究笔记，并按需生成 AI 市场简报。",
    ],
    outcomes: [
      "AI 对话接口已按 EdgeOne 的线上目录规则调整。",
    ],
  },
  "daniel-project-hub": {
    features: [
      "把 AI 产品、网站和实验作品整理成可浏览的作品目录。",
      "FlowOps 提供可操作的采购流程回放与知识库问答入口。",
    ],
    outcomes: [
      "FlowOps 演示覆盖正常批准、审批拒绝和重复事件三种路径。",
      "作品导航站和 FlowOps 演示均有明确的线上入口。",
    ],
  },
  "personal-portfolio": {
    features: [
      "通过随页面滚动变化的 3D 场景呈现个人作品。",
      "以单页结构串起个人介绍和作品展示。",
    ],
    outcomes: [
      "个人作品集已发布，并补齐页脚版权信息。",
    ],
  },
  "daniel-workspace": {
    features: [
      "集中查看项目、待办和工作记录。",
      "按需生成基于实际进展的 AI 总结和下一步建议。",
    ],
    outcomes: [
      "首页与项目详情已将重点项目介绍和近期进展改为易读中文。",
    ],
  },
  "n8n-ai-automation-lab": {
    features: [
      "用 n8n 串联采购审批、工单生成和 AI 分析步骤。",
      "通过流程配置演示审批通过后的自动衔接。",
    ],
    outcomes: [
      "已归档可复用的流程配置，并排除凭据与运行记录。",
    ],
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

export function projectShowcase(project) {
  const details = readProjectProfile(project?.notes).profile || PROJECT_SHOWCASES[repoKey(project)];
  return {
    purpose: projectIntroduction(project),
    features: details?.features || [],
    outcomes: details?.outcomes || [],
  };
}

export function deployedWebsiteUrl(project) {
  const value = typeof project?.url === "string" ? project.url.trim() : "";
  if (!value) return "";
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const ipv4 = hostname.split(".").map(Number);
    const isIpv4 = ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255);
    const isPrivateIpv4 = isIpv4 && (ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127
      || (ipv4[0] === 169 && ipv4[1] === 254) || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)
      || (ipv4[0] === 192 && ipv4[1] === 168) || (ipv4[0] === 100 && ipv4[1] >= 64 && ipv4[1] <= 127));
    if (!['http:', 'https:'].includes(parsed.protocol) || !hostname || parsed.username || parsed.password
      || hostname === "github.com" || hostname === "www.github.com" || hostname === "localhost"
      || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname === "127.0.0.1"
      || hostname.endsWith(".internal") || hostname.endsWith(".githubusercontent.com")
      || hostname === "0.0.0.0" || hostname === "[::1]" || hostname.startsWith("[") || isPrivateIpv4) return "";
    return parsed.href;
  } catch {
    return "";
  }
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
