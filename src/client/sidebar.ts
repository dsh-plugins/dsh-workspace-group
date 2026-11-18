import type { DshLoaderUi } from '@dsh-plugin/dsh-loader/client';
import { groupFor, type GroupState } from '../model.js';
import { groupAt } from './drop-target.js';

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
  let active: { id: string; row: HTMLElement; pointerId: number; startX: number; startY: number; x: number; y: number; dragging: boolean } | undefined;
  let preview: HTMLElement | undefined;
  let frame = 0;
  let suppressClick = false;
  let disposed = false;
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
  const scroller = (tree: HTMLElement): HTMLElement | undefined => {
    for (let element = tree.parentElement; element; element = element.parentElement) {
      if (/(auto|scroll)/.test(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight) {
        return element;
      }
    }
    return undefined;
  };
  const targetGroup = (x: number, y: number): HTMLElement | undefined => {
    for (const list of lists) {
      const tree = list.tree.getBoundingClientRect();
      const bounds = {
        left: Math.max(tree.left, 0), right: Math.min(tree.right, innerWidth),
        top: Math.max(tree.top, 0), bottom: Math.min(tree.bottom, innerHeight),
      };
      for (let element = list.tree.parentElement; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (style.display === 'contents') {
          continue;
        }
        const rect = element.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          bounds.left = Math.max(bounds.left, rect.left + element.clientLeft);
          bounds.right = Math.min(bounds.right, rect.left + element.clientLeft + element.clientWidth);
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          bounds.top = Math.max(bounds.top, rect.top + element.clientTop);
          bounds.bottom = Math.min(bounds.bottom, rect.top + element.clientTop + element.clientHeight);
        }
      }
      const headers = [...list.mount.querySelectorAll<HTMLElement>('[data-wg-header]')];
      const id = groupAt({ x, y }, bounds, headers.map(header => {
        const rect = header.getBoundingClientRect();
        return { id: header.dataset.wgHeader!, top: rect.top, bottom: rect.bottom };
      }));
      if (id !== undefined) {
        return headers.find(header => header.dataset.wgHeader === id);
      }
    }
    return undefined;
  };
  const clear = (): void => {
    const pointerId = active?.pointerId;
    active = undefined;
    cancelAnimationFrame(frame);
    preview?.remove();
    preview = undefined;
    if (pointerId !== undefined && document.documentElement.hasPointerCapture(pointerId)) {
      document.documentElement.releasePointerCapture(pointerId);
    }
    for (const element of document.querySelectorAll('[data-wg-over]')) {
      element.removeAttribute('data-wg-over');
    }
    document.documentElement.removeAttribute('data-wg-dragging');
  };
  const down = (event: PointerEvent): void => {
    suppressClick = false;
    if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch') {
      return;
    }
    const row = findRow(event.target);
    const entry = lists.flatMap(list => list.rows).find(item => item.row === row);
    if (!entry || (event.target instanceof Element && event.target.closest('button,a,input,textarea,select'))) {
      return;
    }
    // 阻止原生拖动接管指针；捕获稳定的根节点，折叠工作区后仍可继续接收移动和松开事件。
    event.preventDefault();
    entry.row.focus({ preventScroll: true });
    active = { id: entry.id, row: entry.row, pointerId: event.pointerId,
      startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false };
  };
  const paint = (): void => {
    if (!active?.dragging) {
      return;
    }
    for (const list of lists) {
      const scroll = scroller(list.tree);
      if (!scroll) {
        continue;
      }
      const rect = scroll.getBoundingClientRect();
      if (active.x >= rect.left && active.x < rect.right && active.y >= rect.top && active.y < rect.bottom) {
        if (active.y < rect.top + 28) {
          scroll.scrollTop -= 10;
        } else if (active.y > rect.bottom - 28) {
          scroll.scrollTop += 10;
        }
      }
    }
    const header = targetGroup(active.x, active.y);
    for (const element of document.querySelectorAll('[data-wg-over]')) {
      if (element !== header) {
        element.removeAttribute('data-wg-over');
      }
    }
    if (header) {
      if (!header.hasAttribute('data-wg-over')) {
        header.setAttribute('data-wg-over', '');
      }
    }
    if (preview) {
      preview.style.transform = `translate(${active.x + 14}px,${active.y + 10}px)`;
    }
    frame = requestAnimationFrame(paint);
  };
  const move = (event: PointerEvent): void => {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }
    active.x = event.clientX;
    active.y = event.clientY;
    if (!active.dragging) {
      if (Math.hypot(active.x - active.startX, active.y - active.startY) < 6) {
        return;
      }
      active.dragging = true;
      suppressClick = true;
      preview = active.row.cloneNode(true) as HTMLElement;
      preview.removeAttribute('data-row-key');
      preview.removeAttribute('tabindex');
      preview.setAttribute('aria-hidden', 'true');
      preview.classList.add('dsh-wg-drag-preview');
      preview.style.width = `${active.row.getBoundingClientRect().width}px`;
      document.body.appendChild(preview);
      document.documentElement.setAttribute('data-wg-dragging', '');
      document.documentElement.setPointerCapture(event.pointerId);
      if (active.row.getAttribute('aria-expanded') === 'true') {
        active.row.click();
      }
      paint();
    }
    event.stopImmediatePropagation();
    event.preventDefault();
  };
  const up = (event: PointerEvent): void => {
    if (!active || event.pointerId !== active.pointerId) {
      return;
    }
    const source = active.id;
    const dragging = active.dragging;
    const header = dragging ? targetGroup(event.clientX, event.clientY) : undefined;
    clear();
    if (dragging) {
      event.stopImmediatePropagation();
      event.preventDefault();
      if (header && groupFor(options.read(), source) !== header.dataset.wgHeader) {
        options.move(source, header.dataset.wgHeader!);
      }
    }
  };
  const click = (event: MouseEvent): void => {
    if (suppressClick && event.detail > 0) {
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const nativeStart = (event: DragEvent): void => {
    const row = findRow(event.target);
    if (lists.some(list => list.rows.some(item => item.row === row))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
  const key = (event: KeyboardEvent): void => {
    if (active && event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      clear();
    }
  };
  document.addEventListener('pointerdown', down, true);
  document.addEventListener('pointermove', move, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', clear, true);
  document.addEventListener('click', click, true);
  document.addEventListener('dragstart', nativeStart, true);
  document.addEventListener('keydown', key, true);
  window.addEventListener('blur', clear);
  const off = options.ui.onDomSettled(scan);
  scan();
  return {
    update,
    dispose() {
      disposed = true;
      off();
      clear();
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
      document.removeEventListener('pointercancel', clear, true);
      document.removeEventListener('click', click, true);
      document.removeEventListener('dragstart', nativeStart, true);
      document.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', clear);
      for (const list of lists) {
        list.mount.remove();
      }
      for (const element of marked) {
        for (const key of ['data-wg-tree', 'data-wg-section', 'data-wg-hidden']) {
          element.removeAttribute(key);
        }
        element.style.removeProperty('--dsh-wg-order');
      }
      marked.clear();
    },
  };
}
