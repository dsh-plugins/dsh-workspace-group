/** 分区和工作区归属使用宿主工作区 ID，避免同名目录相互覆盖。 */
export interface GroupState {
  groups: { id: string; title: string; collapsed: boolean }[];
  assignments: { workspaceId: string; groupId: string }[];
  defaultCollapsed: boolean;
}

/** 一次分区变更；删除分区会同时移除其归属。 */
export type GroupChange =
  | { type: 'create'; id: string; title: string; workspaceId?: string }
  | { type: 'rename'; id: string; title: string }
  | { type: 'delete'; id: string }
  | { type: 'collapse'; id: string; collapsed: boolean }
  | { type: 'move'; workspaceId: string; groupId: string };

/** 未归类和目标分区已删除的工作区均显示在默认分区。 */
export function groupFor(state: GroupState, workspaceId: string): string {
  const id = state.assignments.find(item => item.workspaceId === workspaceId)?.groupId;
  return id && state.groups.some(group => group.id === id) ? id : '';
}

/** 校验分区状态中的唯一身份和引用，拒绝会丢失工作区归属的数据。 */
export function validateState(state: GroupState): void {
  const ids = new Set<string>();
  const titles = new Set<string>(['项目']);
  for (const group of state.groups) {
    if (!group.id || ids.has(group.id)) {
      throw new Error('分区 ID 不能为空或重复。');
    }
    const title = group.title.trim();
    if (!title || title.length > 60 || titles.has(title)) {
      throw new Error('分区名称须为 1 至 60 个字符，且不能重复或使用“项目”。');
    }
    ids.add(group.id);
    titles.add(title);
  }
  const workspaces = new Set<string>();
  for (const item of state.assignments) {
    if (!item.workspaceId || workspaces.has(item.workspaceId) || !ids.has(item.groupId)) {
      throw new Error('工作区归属存在重复或引用了不存在的分区。');
    }
    workspaces.add(item.workspaceId);
  }
}

/** 以不可变方式应用变更，供保存前校验与并发重试共用。 */
export function changeState(state: GroupState, change: GroupChange): GroupState {
  const next = structuredClone(state);
  if (change.type === 'create') {
    next.groups.push({ id: change.id, title: change.title.trim(), collapsed: false });
    if (change.workspaceId) {
      next.assignments = next.assignments.filter(item => item.workspaceId !== change.workspaceId);
      next.assignments.push({ workspaceId: change.workspaceId, groupId: change.id });
    }
  } else if (change.type === 'move') {
    if (change.groupId && !next.groups.some(group => group.id === change.groupId)) {
      throw new Error('目标分区已删除，请重新选择。');
    }
    next.assignments = next.assignments.filter(item => item.workspaceId !== change.workspaceId);
    if (change.groupId) {
      next.assignments.push({ workspaceId: change.workspaceId, groupId: change.groupId });
    }
  } else if (change.type === 'collapse' && change.id === '') {
    next.defaultCollapsed = change.collapsed;
  } else {
    const group = next.groups.find(item => item.id === change.id);
    if (!group) {
      throw new Error('分区已删除，请刷新后重试。');
    }
    if (change.type === 'rename') {
      group.title = change.title.trim();
    } else if (change.type === 'collapse') {
      group.collapsed = change.collapsed;
    } else {
      next.groups = next.groups.filter(item => item.id !== change.id);
      next.assignments = next.assignments.filter(item => item.groupId !== change.id);
    }
  }
  validateState(next);
  return next;
}
