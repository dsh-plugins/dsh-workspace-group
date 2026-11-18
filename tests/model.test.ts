import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { changeState, groupFor, validateState, type GroupState } from '../src/model.js';

function initial(): GroupState {
  return { groups: [], assignments: [], defaultCollapsed: false };
}

test('创建分区并移动工作区属于同一次状态变更，输入保持不变', () => {
  const before = initial();
  const after = changeState(before, { type: 'create', id: 'a', title: ' 开发 ', workspaceId: 'workspace-a' });
  assert.equal(after.groups[0]?.title, '开发');
  assert.equal(groupFor(after, 'workspace-a'), 'a');
  assert.deepEqual(before, initial());
});

test('移动只替换目标工作区的归属，相同名称的其他工作区保持独立', () => {
  let state = changeState(initial(), { type: 'create', id: 'a', title: '开发', workspaceId: 'workspace-a' });
  state = changeState(state, { type: 'create', id: 'b', title: '学习', workspaceId: 'workspace-b' });
  state = changeState(state, { type: 'move', workspaceId: 'workspace-a', groupId: 'b' });
  assert.deepEqual(state.assignments, [
    { workspaceId: 'workspace-b', groupId: 'b' }, { workspaceId: 'workspace-a', groupId: 'b' },
  ]);
  state = changeState(state, { type: 'move', workspaceId: 'workspace-a', groupId: '' });
  assert.equal(groupFor(state, 'workspace-a'), '');
  assert.equal(groupFor(state, 'workspace-b'), 'b');
});

test('重复移动不会生成重复归属', () => {
  const state = changeState(initial(), { type: 'create', id: 'a', title: '开发', workspaceId: 'workspace-a' });
  assert.deepEqual(changeState(state, { type: 'move', workspaceId: 'workspace-a', groupId: 'a' }), state);
});

test('删除分区会移除全部关联，其他分区不变', () => {
  let state = changeState(initial(), { type: 'create', id: 'a', title: '开发', workspaceId: 'workspace-a' });
  state = changeState(state, { type: 'move', workspaceId: 'workspace-b', groupId: 'a' });
  state = changeState(state, { type: 'create', id: 'b', title: '学习', workspaceId: 'workspace-c' });
  state = changeState(state, { type: 'delete', id: 'a' });
  assert.equal(groupFor(state, 'workspace-a'), '');
  assert.equal(groupFor(state, 'workspace-b'), '');
  assert.equal(groupFor(state, 'workspace-c'), 'b');
  assert.equal(state.assignments.length, 1);
});

test('重命名不改变归属，折叠自定义分区与默认分区相互独立', () => {
  let state = changeState(initial(), { type: 'create', id: 'a', title: '开发', workspaceId: 'workspace-a' });
  state = changeState(state, { type: 'rename', id: 'a', title: '工作' });
  state = changeState(state, { type: 'collapse', id: 'a', collapsed: true });
  assert.equal(state.defaultCollapsed, false);
  state = changeState(state, { type: 'collapse', id: '', collapsed: true });
  assert.equal(state.groups[0]?.title, '工作');
  assert.equal(state.groups[0]?.collapsed, true);
  assert.equal(state.defaultCollapsed, true);
  assert.equal(groupFor(state, 'workspace-a'), 'a');
});

test('空白、超长、重复、默认分区名称及重复 ID 被拒绝', () => {
  const state = changeState(initial(), { type: 'create', id: 'a', title: '开发' });
  for (const title of [' ', 'x'.repeat(61), '开发', ' 项目 ']) {
    assert.throws(() => changeState(state, { type: 'create', id: 'b', title }));
  }
  assert.throws(() => changeState(state, { type: 'create', id: 'a', title: '学习' }));
});

test('引用已删除分区的移动和编辑被拒绝，状态保持不变', () => {
  const state = initial();
  for (const change of [
    { type: 'move', workspaceId: 'workspace-a', groupId: 'missing' },
    { type: 'rename', id: 'missing', title: '开发' },
    { type: 'delete', id: 'missing' },
  ] as const) {
    assert.throws(() => changeState(state, change));
  }
  assert.deepEqual(state, initial());
});

test('未知归属展示在默认分区，重复及悬空归属数据校验失败', () => {
  const state = changeState(initial(), { type: 'create', id: 'a', title: '开发' });
  assert.equal(groupFor(state, 'new-workspace'), '');
  state.assignments = [{ workspaceId: 'workspace-a', groupId: 'missing' }];
  assert.equal(groupFor(state, 'workspace-a'), '');
  assert.throws(() => validateState(state));
  state.assignments = [
    { workspaceId: 'workspace-a', groupId: 'a' }, { workspaceId: 'workspace-a', groupId: 'a' },
  ];
  assert.throws(() => validateState(state));
});
