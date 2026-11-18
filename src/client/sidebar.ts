import type { DshLoaderUi } from '@dsh-plugin/dsh-loader/client';
import { groupFor, type GroupState } from '../model.js';

const rowSelector = '[data-row-key^="workspace:"][role="treeitem"]';

/** 宿主渲染的工作区列表；节点留在原 React 父级中，仅调整展示顺序。 */
export interface SidebarList {
  tree: HTMLElement;
  mount: HTMLElement;
  rows: { id: string; row: HTMLElement; section: HTMLElement }[];
}

/** 观察宿主列表并绑定拖动手势，卸载时复原所有属性和样式。 */
export function attachSidebar(options: {
  ui: DshLoaderUi;
  read(): GroupState;
  move(workspaceId: string, groupId: string): void;
  changed(lists: SidebarList[]): void;
}): { update(): void; dispose(): void } {
  let lists: SidebarList[] = [];
  let active: string | undefined;
  let disposed = false;
  const restored = new Map<HTMLElement, { draggable: string | null }>();
  const marked = new Set<HTMLElement>();
  const stamp = (element: HTMLElement, key: string, value: string): void => {
    if (element.getAttribute(key) !== value) {
      element.setAttribute(key, value);
    }
    marked.add(element);
  };
  const update = (): void => {
    const state = options.read();
    for (const list of lists) {
      const groups = [...state.groups, { id: '', title: '项目', collapsed: state.defaultCollapsed }];
      list.rows.forEach(({ id, section }, index) => {
        const groupId = groupFor(state, id);
        const groupIndex = groups.findIndex(group => group.id === groupId);
        const order = (groupIndex + 1) * 100000 + index + 1;
        stamp(section, 'data-wg-section', '');
        stamp(section, 'data-wg-hidden', String(groups[groupIndex]!.collapsed));
        if (section.style.getPropertyValue('--dsh-wg-order') !== String(order)) {
          section.style.setProperty('--dsh-wg-order', String(order));
        }
      });
    }
  };
  const scan = (): void => {
    if (disposed) {
      return;
    }
    const byTree = new Map<HTMLElement, SidebarList['rows']>();
    for (const empty of document.querySelectorAll('#root [data-slot="sidebar.workspaces"] [role="tree"] :is([data-row-key="empty"],[data-row-key="workspace:"])')) {
      const tree = empty.closest<HTMLElement>('[role="tree"]');
      if (tree) {
        byTree.set(tree, []);
      }
    }
    for (const row of document.querySelectorAll<HTMLElement>(`#root [data-slot="sidebar.workspaces"] ${rowSelector}`)) {
      const tree = row.closest<HTMLElement>('[role="tree"]');
      const section = row.closest<HTMLElement>('[style*="--dsh-workspace-indent"]');
      if (!tree || !section) {
        continue;
      }
      const id = row.dataset.rowKey!.slice('workspace:'.length);
      // 无归属会话也使用 workspace: 前缀，但宿主没有为它提供菜单和拖动。
      if (!id) {
        continue;
      }
      if (!restored.has(row)) {
        restored.set(row, { draggable: row.getAttribute('draggable') });
      }
      if (!row.draggable) {
        row.draggable = true;
      }
      const rows = byTree.get(tree) ?? [];
      rows.push({ id, row, section });
      byTree.set(tree, rows);
    }
    const next: SidebarList[] = [];
    for (const [tree, rows] of byTree) {
      const previous = lists.find(list => list.tree === tree);
      const mount = previous?.mount ?? document.createElement('div');
      if (!previous) {
        mount.dataset.wgMount = '';
        stamp(tree, 'data-wg-tree', '');
      }
      if (mount.parentElement !== tree) {
        tree.appendChild(mount);
      }
      next.push({ tree, mount, rows });
    }
    for (const list of lists) {
      if (!byTree.has(list.tree)) {
        list.mount.remove();
        list.tree.removeAttribute('data-wg-tree');
      }
    }
    const changed = next.length !== lists.length || next.some((list, index) => {
      const previous = lists[index];
      return !previous || list.tree !== previous.tree || list.rows.length !== previous.rows.length
        || list.rows.some((item, row) => item.row !== previous.rows[row]?.row || item.id !== previous.rows[row]?.id);
    });
    lists = next;
    update();
    for (const element of restored.keys()) {
      if (!element.isConnected) {
        restored.delete(element);
      }
    }
    for (const element of marked) {
      if (!element.isConnected) {
        marked.delete(element);
      }
    }
    if (changed) {
      options.changed(lists);
    }
  };
  const findRow = (target: EventTarget | null): HTMLElement | null => target instanceof Element
    ? target.closest<HTMLElement>(rowSelector) : null;
  const clear = (): void => {
    active = undefined;
    for (const element of document.querySelectorAll('[data-wg-over]')) {
      element.removeAttribute('data-wg-over');
    }
    document.documentElement.removeAttribute('data-wg-dragging');
  };
  const start = (event: DragEvent): void => {
    const row = findRow(event.target);
    const entry = lists.flatMap(list => list.rows).find(item => item.row === row);
    if (!entry || !event.dataTransfer) {
      return;
    }
    active = entry.id;
    event.stopImmediatePropagation();
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-dsh-workspace-group', entry.id);
    event.dataTransfer.setData('text/plain', entry.id);
    document.documentElement.setAttribute('data-wg-dragging', '');
    if (row!.getAttribute('aria-expanded') === 'true') {
      row!.click();
    }
  };
  const targetGroup = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) {
      return null;
    }
    const header = target.closest<HTMLElement>('[data-wg-header]');
    if (header) {
      return header;
    }
    const row = findRow(target);
    const list = lists.find(item => item.rows.some(entry => entry.row === row));
    const id = row?.dataset.rowKey?.slice('workspace:'.length);
    return list && id ? [...list.mount.querySelectorAll<HTMLElement>('[data-wg-header]')]
      .find(item => item.dataset.wgHeader === groupFor(options.read(), id)) ?? null : null;
  };
  const over = (event: DragEvent): void => {
    if (!active) {
      return;
    }
    const header = targetGroup(event.target);
    event.stopImmediatePropagation();
    for (const element of document.querySelectorAll('[data-wg-over]')) {
      if (element !== header) {
        element.removeAttribute('data-wg-over');
      }
    }
    if (header) {
      event.preventDefault();
      header.setAttribute('data-wg-over', '');
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'move';
      }
    }
  };
  const drop = (event: DragEvent): void => {
    if (!active) {
      return;
    }
    const header = targetGroup(event.target);
    event.stopImmediatePropagation();
    event.preventDefault();
    const source = active;
    clear();
    if (header) {
      options.move(source, header.dataset.wgHeader!);
    }
  };
  const end = (event: DragEvent): void => {
    if (active) {
      event.stopImmediatePropagation();
      clear();
    }
  };
  document.addEventListener('dragstart', start, true);
  document.addEventListener('dragover', over, true);
  document.addEventListener('drop', drop, true);
  document.addEventListener('dragend', end, true);
  const off = options.ui.onDomSettled(scan);
  scan();
  return {
    update,
    dispose() {
      disposed = true;
      off();
      clear();
      document.removeEventListener('dragstart', start, true);
      document.removeEventListener('dragover', over, true);
      document.removeEventListener('drop', drop, true);
      document.removeEventListener('dragend', end, true);
      for (const list of lists) {
        list.mount.remove();
      }
      for (const [row, attributes] of restored) {
        if (attributes.draggable === null) {
          row.removeAttribute('draggable');
        } else {
          row.setAttribute('draggable', attributes.draggable);
        }
      }
      for (const element of marked) {
        for (const key of ['data-wg-tree', 'data-wg-section', 'data-wg-hidden']) {
          element.removeAttribute(key);
        }
        element.style.removeProperty('--dsh-wg-order');
      }
      restored.clear();
      marked.clear();
    },
  };
}
