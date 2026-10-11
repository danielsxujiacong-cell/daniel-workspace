import { parsePublicGitHubRepository } from "../github/public-api.js";

const text = (value, limit = 240) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const isGenericNextStep = (value) => /^(?:创建(?:一个)?(?:任务|待办)|继续推进|进一步优化|持续优化|继续开发|继续完善|create (?:a )?task|keep progressing|further optimize)/i.test(text(value, 300));

function verifiedCommitRecords(project) {
  const repository = parsePublicGitHubRepository(project?.github);
  const records = Array.isArray(project?.githubData?.recentCommits)
    ? project.githubData.recentCommits
    : [project?.githubData?.latestCommit].filter(Boolean);
  const snapshot = project?.githubData;
  const trustedSnapshot = snapshot?.isPublic === true || (snapshot?.isPublic === false && snapshot?.source === "github-app");
  if (!repository || !trustedSnapshot
    || String(snapshot.repositoryName || "").toLowerCase() !== repository.fullName.toLowerCase()
    || !Number.isFinite(new Date(snapshot.refreshedAt || "").getTime())) return [];
  const verified = records.map((commit) => {
    const sha = typeof commit?.sha === "string" ? commit.sha : "";
    const message = text(commit?.message, 240);
    const committedAt = typeof commit?.committedAt === "string" ? commit.committedAt : "";
    const timestamp = new Date(committedAt).getTime();
    const urlPrefix = `${repository.url}/commit/`;
    const urlSha = typeof commit?.url === "string" && commit.url.startsWith(urlPrefix) ? commit.url.slice(urlPrefix.length) : "";
    if (!/^[a-f0-9]{7,40}$/i.test(sha) || !/^[a-f0-9]{7,40}$/i.test(urlSha)
      || !urlSha.toLowerCase().startsWith(sha.toLowerCase()) || !message || !Number.isFinite(timestamp)) return null;
    return { message, committedAt, timestamp };
  }).filter(Boolean);
  const unique = new Map(verified.map((commit) => [commit.committedAt + commit.message, commit]));
  return [...unique.values()].sort((left, right) => right.timestamp - left.timestamp);
}

export function buildDailyBriefContext(projects = [], { now = Date.now(), localProgressByProject = {} } = {}) {
  const nowMs = typeof now === "number" ? now : new Date(now).getTime();
  const day = 24 * 60 * 60 * 1000;
  return (Array.isArray(projects) ? projects : [])
    .filter((project) => project?.isPinned === true)
    .slice(0, 5)
    .map((project) => {
      const commits = verifiedCommitRecords(project).filter((commit) => commit.timestamp <= nowMs && commit.timestamp >= nowMs - 7 * day);
      const confirmedNextStep = text(project.next, 300);
      const local = localProgressByProject?.[project.id];
      const localCommitTime = local?.committedAt ? new Date(local.committedAt).getTime() : NaN;
      const localAgeMs = nowMs - localCommitTime;
      return {
        name: text(project.name, 120),
        status: text(project.status, 80),
        stage: text(project.stage, 120),
        confirmedNextStep: isGenericNextStep(confirmedNextStep) ? "" : confirmedNextStep,
        githubSource: project.githubData?.source === "github-app" ? "GitHub App 授权只读仓库" : project.githubData?.isPublic === true ? "公开 GitHub 仓库" : "GitHub 暂无可验证快照",
        githubBranch: text(project.githubData?.defaultBranch, 120),
        commitsLast24Hours: commits.filter((commit) => commit.timestamp >= nowMs - day).slice(0, 3).map(({ message, committedAt }) => ({ message, committedAt })),
        commitsDays1To7: commits.filter((commit) => commit.timestamp < nowMs - day).slice(0, 2).map(({ message, committedAt }) => ({ message, committedAt })),
        localProgress: local ? {
          branch: text(local.branch, 120),
          clean: typeof local.clean === "boolean" ? local.clean : null,
          committedAt: text(local.committedAt, 40),
          commitPeriod: Number.isFinite(localAgeMs) && localAgeMs >= 0 && localAgeMs <= day ? "last24Hours"
            : Number.isFinite(localAgeMs) && localAgeMs > day && localAgeMs <= 7 * day ? "days1To7" : "outsideWindow",
          scannedAt: text(local.scannedAt, 40),
          source: "Local Companion",
        } : null,
      };
    });
}

export function buildDailyBriefPrompt() {
  return [
    "根据置顶项目资料生成中文 AI 今日工作简报。可使用真实、已验证的 GitHub 提交（包括用户授权读取的私有仓库）、项目状态，以及 Local Companion 提供的本机 Git 元数据（分支、提交时间、工作区状态、扫描时间）。不使用外部知识或猜测。",
    "时间必须分层：commitsLast24Hours 是优先依据；commitsDays1To7 是 24 小时至 7 天的补充依据。只有前者可表述为“过去 24 小时”；后者必须明确写“过去 1–7 天”。较早提交没有提供，不得把它描述成近期成果，也不能把旧提交改写成今天完成。",
    "只返回 JSON：{\"completed\":[{\"project\":\"项目名\",\"period\":\"last24Hours 或 days1To7\",\"text\":\"开发变化\",\"basis\":\"GitHub 证据逐字引用摘要和 ISO 时间，或本机证据逐字引用来源、分支、状态和 ISO 时间\"}],\"recommendations\":[{\"project\":\"项目名\",\"text\":\"具体开发行动\",\"acceptance\":\"可观察、可验收的结果\",\"basis\":\"GitHub 证据逐字引用摘要和 ISO 时间，或本机证据逐字引用来源、分支、状态和 ISO 时间\"}],\"watch\":[{\"project\":\"项目名\",\"text\":\"需要关注的问题\",\"basis\":\"具体资料依据\"}]}。每部分可为空；recommendations 为 1–3 条（证据不足时可为空）。每条必须使用输入中的项目名并给出依据。",
    "建议必须从真实开发变化推导，优先承接过去 24 小时提交，其次才用过去 1–7 天提交；结合项目状态，给出具体代码/功能验证或后续开发动作，并写可验收结果。不得把项目 next_step 直接复制成建议；它只能在与近期提交相符时作补充。若 next_step 空泛（如“创建一个任务”“继续推进”“进一步优化”），忽略它，不得复述或仅凭它推荐创建任务。不要建议创建任务、待办或计划来代替实际开发行动。",
    "Local Companion 数据只含本机 Git 元数据，不含提交说明、代码、路径或仓库 URL。引用本机进展时，必须明确标注“本机 Companion”，依据可引用 branch、clean 状态、committedAt 和 scannedAt；不得把本机状态说成 GitHub 证据。若 GitHub 项目为私有仓库，其提交摘要仅来自用户授权的 GitHub App 只读快照。若缺少近期提交或其他具体开发证据，明确返回空建议，并在 watch 说明具体缺少的证据；不要为满足条数编造。completed 只写提交明确支持的变更，不等于发布或完成整个项目。项目资料只从 Workspace Context 读取。",
    "Local Companion 数据只含本机 Git 元数据，不含提交说明、代码、路径或仓库 URL。引用本机进展时，必须明确标注“本机 Companion”，依据可引用 branch、clean 状态、committedAt 和 scannedAt；不得把本机状态说成 GitHub 证据。若 GitHub 项目为私有仓库，其提交摘要仅来自用户授权的 GitHub App 只读快照；有 githubBranch 时可注明仓库默认分支。若缺少近期提交或其他具体开发证据，明确返回空建议，并在 watch 说明具体缺少的证据；不要为满足条数编造。completed 只写提交明确支持的变更，不等于发布或完成整个项目。项目资料只从 Workspace Context 读取。",
  ].join("\n");
}

export function parseDailyBriefResponse(content, projects, context = buildDailyBriefContext(projects)) {
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
      if (!allowed.has(project) || !detail || !basis) return null;
      const projectEvidence = context.find((entry) => entry.name === project);
      const localEvidence = projectEvidence?.localProgress;
      const localBasisMatches = Boolean(localEvidence && basis.includes("本机 Companion")
        && (!localEvidence.branch || basis.includes(localEvidence.branch))
        && (localEvidence.clean === null || basis.includes(localEvidence.clean ? "Clean" : "未提交修改"))
        && (!localEvidence.committedAt || basis.includes(localEvidence.committedAt))
        && (!localEvidence.scannedAt || basis.includes(localEvidence.scannedAt)));
      if (key === "completed") {
        const period = item?.period;
        const commits = period === "last24Hours" ? projectEvidence?.commitsLast24Hours
          : period === "days1To7" ? projectEvidence?.commitsDays1To7 : null;
        const citedCommit = commits?.find((commit) => basis.includes(commit.message) && basis.includes(commit.committedAt));
        if (!citedCommit && (!localBasisMatches || localEvidence.commitPeriod !== period || !["last24Hours", "days1To7"].includes(period))) return null;
        return { project, text: `${period === "last24Hours" ? "过去 24 小时" : "过去 1–7 天"}：${detail}`, basis };
      }
      if (key === "recommendations") {
        const acceptance = text(item?.acceptance, 240);
        const recentCommits = [...(projectEvidence?.commitsLast24Hours || []), ...(projectEvidence?.commitsDays1To7 || [])];
        if (!acceptance || (!recentCommits.some((commit) => basis.includes(commit.message) && basis.includes(commit.committedAt))
          && (!localBasisMatches || !["last24Hours", "days1To7"].includes(localEvidence.commitPeriod)))
          || /创建(?:一个)?(?:任务|待办)|继续推进|进一步优化|持续优化/i.test(`${detail} ${acceptance}`)) return null;
        return { project, text: `${detail}；验收：${acceptance}`, basis };
      }
      if (key === "watch") {
        const sourceText = [projectEvidence?.status, projectEvidence?.stage, projectEvidence?.confirmedNextStep,
          ...(projectEvidence?.commitsLast24Hours || []).map((commit) => commit.message),
          ...(projectEvidence?.commitsDays1To7 || []).map((commit) => commit.message),
          localEvidence?.branch, localEvidence?.committedAt, localEvidence?.scannedAt,
          localEvidence?.clean === true ? "Clean" : localEvidence?.clean === false ? "未提交修改" : ""].filter(Boolean);
        if (!sourceText.some((source) => basis.includes(source)) && !localBasisMatches) return null;
      }
      return { project, text: detail, basis };
    }).filter(Boolean);
  };
  const brief = {
    completed: section("completed", 5),
    recommendations: section("recommendations", 3),
    watch: section("watch", 5),
  };
  if (!brief.completed.length && !brief.recommendations.length && !brief.watch.length) {
    throw new Error("GLM 未返回带有可验证项目依据的简报内容，请重试。");
  }
  return brief;
}
