export function renderDashboardLayout(sections = []) {
  return `<div class="dashboard-home"><div class="dashboard-grid">${sections.filter((section) => typeof section === "string").join("")}</div></div>`;
}
