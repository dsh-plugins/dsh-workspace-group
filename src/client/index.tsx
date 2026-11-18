import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { Arco, Icon, Scrollbar, type DshLoaderUi } from '@dsh-plugin/dsh-loader/client';
import { groupFor, type GroupChange } from '../model.js';
import { GroupStore, errorText } from './store.js';
import { attachSidebar, type SidebarList } from './sidebar.js';
import { css } from './style.js';

export const name = '@dsh-plugin/dsh-workspace-group';
export const inject = ['dshLoaderUi', 'contextMenus'];

interface DialogRequest {
  type: 'create' | 'rename' | 'delete';
  id?: string;
  title?: string;
  workspaceId?: string;
}

interface MenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  children?: MenuAction[];
  run?: () => void | Promise<void>;
  failureLabel?: string;
}

/** 宿主公开的工作区菜单注册入口，菜单的关闭和错误反馈由宿主处理。 */
interface ContextMenus {
  register(options: {
    id: string; target: 'workspace'; order: number;
    observe(): { getSnapshot(): unknown; subscribe(listener: () => void): () => void }[];
    resolve(target: { workspaceId: string }): MenuAction[];
  }): () => void;
  notify(message: string, success?: boolean): void;
}

interface ClientContext {
  dshLoaderUi: DshLoaderUi;
  contextMenus: ContextMenus;
  effect(callback: () => (() => void), label?: string): void;
}

/** 安装侧边栏分区与宿主右键菜单，所有资源随 Cordis 作用域清理。 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => {
    const store = new GroupStore();
    const style = document.createElement('style');
    style.dataset.pluginCss = name;
    style.textContent = css;
    document.head.appendChild(style);
    const container = document.createElement('div');
    container.dataset.wgApp = '';
    document.body.appendChild(container);
    const root = createRoot(container);
    let lists: SidebarList[] = [];
    let request: DialogRequest | undefined;
    const render = (): void => {
      root.render(<App store={store} lists={lists} request={request} open={open} close={close} />);
    };
    function open(next: DialogRequest): void {
      request = next;
      render();
    }
    function close(): void {
      request = undefined;
      render();
    }
    const attach = () => {
      const sidebar = attachSidebar({
        ui: ctx.dshLoaderUi,
        read: () => store.getSnapshot().value,
        move: (workspaceId, groupId) => {
          if (!store.getSnapshot().ready) {
            ctx.contextMenus.notify('分区尚未加载，请稍后重试。');
            return;
          }
          void store.change({ type: 'move', workspaceId, groupId }).catch(error => {
            ctx.contextMenus.notify(`移动工作区失败：${errorText(error)}`);
          });
        },
        changed: next => { lists = next; render(); },
      });
      const offAnchor = ctx.dshLoaderUi.defineAnchor('workspace-group.toolbar', {
        describe: '工作区标题工具栏中的搜索入口',
        find: () => [...document.querySelectorAll('[data-sidebar-workspace-header] input')]
          .map(input => input.parentElement!.parentElement!),
        insert: 'before',
      });
      const offToolbar = ctx.dshLoaderUi.mountReact('workspace-group.toolbar', {
        id: 'workspace-group:create',
        component: () => <CreateGroupButton store={store} open={open} />,
      });
      return {
        update: sidebar.update,
        dispose() {
          offToolbar();
          offAnchor();
          sidebar.dispose();
        },
      };
    };
    const registerMenu = () => ctx.contextMenus.register({
      id: name, target: 'workspace', order: 200,
      observe: () => [store],
      resolve: ({ workspaceId }) => {
        const state = store.getSnapshot();
        const selected = groupFor(state.value, workspaceId);
        return [{
          id: 'group', label: '分区', disabled: !state.ready,
          children: [
            ...[...state.value.groups, { id: '', title: '项目' }].map(group => ({
              id: `move:${group.id}`, label: `${group.id === selected ? '✓ ' : ''}${group.title}`,
              disabled: group.id === selected || state.saving,
              failureLabel: '移动工作区失败，请重试。',
              run: () => store.change({ type: 'move', workspaceId, groupId: group.id }),
            })),
            { id: 'create', label: '新建分区…', run: () => { open({ type: 'create', workspaceId }); } },
          ],
        }];
      },
    });
    let sidebar: ReturnType<typeof attachSidebar> | undefined;
    let offMenu: (() => void) | undefined;
    let reportedError = '';
    const sync = (): void => {
      const state = store.getSnapshot();
      // 宿主可在服务停用后继续加载已安装的客户端，须以配置注册状态决定界面是否启用。
      if (state.ready && !sidebar) {
        sidebar = attach();
        offMenu = registerMenu();
      } else if (!state.ready && sidebar) {
        offMenu?.();
        offMenu = undefined;
        sidebar.dispose();
        sidebar = undefined;
        lists = [];
        close();
      }
      sidebar?.update();
      if (!state.ready && state.error && state.error !== reportedError) {
        ctx.contextMenus.notify(state.error);
      }
      reportedError = state.error;
    };
    const offStore = store.subscribe(sync);
    sync();
    render();
    return () => {
      offMenu?.();
      offStore();
      store.dispose();
      root.unmount();
      sidebar?.dispose();
      container.remove();
      style.remove();
    };
  }, 'workspace-group:client');
}

function CreateGroupButton({ store, open }: { store: GroupStore; open(request: DialogRequest): void }): React.ReactElement {
  const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
  return <button type="button" className="dsh-wg-create" aria-label="新建分区" title="新建分区"
    disabled={!state.ready || state.saving} onClick={() => { open({ type: 'create' }); }}><Icon name="Add" size={14} /></button>;
}

function App({ store, lists, request, open, close }: {
  store: GroupStore; lists: SidebarList[]; request: DialogRequest | undefined;
  open(request: DialogRequest): void; close(): void;
}): React.ReactElement {
  const state = React.useSyncExternalStore(store.subscribe, store.getSnapshot);
  const groups = [...state.value.groups, { id: '', title: '项目', collapsed: state.value.defaultCollapsed }];
  const change = (value: GroupChange): void => {
    // 保存错误通过侧边栏的 alert 提示，保持原有已保存的分区布局。
    void store.change(value).catch(() => undefined);
  };
  return <>
    {lists.map(list => createPortal(<>
      {state.error && <div className="dsh-wg-status" role="alert">{state.error}<button onClick={() => { void store.refresh(); }}>重新加载</button></div>}
      {!state.ready && !state.error && <div className="dsh-wg-status" role="status">正在加载分区…</div>}
      {groups.map((group, index) => <div className="dsh-wg-header" data-wg-header={group.id} key={group.id}
        style={{ order: (index + 1) * 100000 }}>
        <button type="button" className="dsh-wg-toggle" aria-expanded={!group.collapsed}
          aria-label={`${group.collapsed ? '展开' : '折叠'}分区 ${group.title}`} disabled={!state.ready || state.saving}
          onClick={() => { change({ type: 'collapse', id: group.id, collapsed: !group.collapsed }); }}>
          <Icon name={group.collapsed ? 'ChevronRight' : 'ChevronDown'} size={13} />
          <span className="dsh-wg-title">{group.title}</span>
          <span className="dsh-wg-count">{list.rows.filter(row => groupFor(state.value, row.id) === group.id).length}</span>
        </button>
        {group.id && <>
          <button type="button" aria-label={`重命名分区 ${group.title}`} title="重命名分区" disabled={state.saving}
            onClick={() => { open({ type: 'rename', id: group.id, title: group.title }); }}><Icon name="Edit" size={14} /></button>
          <button type="button" aria-label={`删除分区 ${group.title}`} title="删除分区" disabled={state.saving}
            onClick={() => { open({ type: 'delete', id: group.id, title: group.title }); }}><Icon name="Delete" size={14} /></button>
        </>}
      </div>)}
    </>, list.mount))}
    {request && <GroupDialog key={`${request.type}:${request.id ?? ''}:${request.workspaceId ?? ''}`} request={request} store={store} close={close} />}
  </>;
}

function GroupDialog({ request, store, close }: { request: DialogRequest; store: GroupStore; close(): void }): React.ReactElement {
  const dialog = React.useRef<HTMLDialogElement>(null);
  const input = React.useRef<React.ElementRef<typeof Arco.Input>>(null);
  const [title, setTitle] = React.useState(request.title ?? '');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const label = request.type === 'create' ? '新建分区' : request.type === 'rename' ? '重命名分区' : '删除分区';
  const titleId = React.useId();
  const inputId = React.useId();
  React.useEffect(() => {
    const previous = document.activeElement;
    dialog.current!.showModal();
    input.current?.dom.select();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) {
        previous.focus();
      }
    };
  }, []);
  const save = async (): Promise<void> => {
    setSaving(true);
    setError('');
    try {
      const change: GroupChange = request.type === 'create'
        ? { type: 'create', id: crypto.randomUUID(), title, workspaceId: request.workspaceId }
        : request.type === 'rename'
          ? { type: 'rename', id: request.id!, title }
          : { type: 'delete', id: request.id! };
      await store.change(change);
      close();
    } catch (reason) {
      setError(errorText(reason));
      setSaving(false);
    }
  };
  return <dialog className="dsh-wg-dialog" ref={dialog} aria-labelledby={titleId} aria-busy={saving}
    onCancel={event => { event.preventDefault(); if (!saving) { close(); } }}>
    <h2 id={titleId}>{label}</h2>
    <form style={{ display: 'contents' }} onSubmit={event => { event.preventDefault(); if (!saving) { void save(); } }}>
      <Scrollbar style={{ flex: '1 1 auto', minHeight: 0 }}>
        {request.type === 'delete' ? <p>删除分区“{request.title}”后，其中的工作区将移回“项目”。工作区和会话会继续保留。</p>
          : <label htmlFor={inputId}>分区名称<Arco.Input id={inputId} ref={input} value={title} onChange={setTitle}
            required maxLength={60} disabled={saving} autoFocus status={error ? 'error' : undefined}
            placeholder="例如：开发、学习" /></label>}
        {request.workspaceId && <p>创建后会将当前工作区移入此分区。</p>}
        {error && <p className="dsh-wg-error" role="alert">{error}</p>}
      </Scrollbar>
      <div className="dsh-wg-actions">
        <Arco.Button disabled={saving} onClick={close}>取消</Arco.Button>
        <Arco.Button type="primary" htmlType="submit" loading={saving} disabled={request.type !== 'delete' && !title.trim()}>{request.type === 'delete' ? '删除分区' : '保存'}</Arco.Button>
      </div>
    </form>
  </dialog>;
}
