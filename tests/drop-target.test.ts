import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { groupAt } from '../src/client/drop-target.js';

const bounds = { left: 10, right: 300, top: 100, bottom: 500 };
const headers = [{ id: 'a', top: 120, bottom: 152 }, { id: '', top: 300, bottom: 332 }];

test('标题、工作区内容和分区之间的空白均归属其上方最近的分区', () => {
  for (const y of [120, 140, 180, 299]) {
    assert.equal(groupAt({ x: 100, y }, bounds, headers), 'a');
  }
  assert.equal(groupAt({ x: 100, y: 400 }, bounds, headers), '');
});

test('列表外部及首个分区上方不会接受放置', () => {
  for (const point of [{ x: 9, y: 180 }, { x: 300, y: 180 }, { x: 100, y: 99 }, { x: 100, y: 500 }, { x: 100, y: 110 }]) {
    assert.equal(groupAt(point, bounds, headers), undefined);
  }
});

test('折叠后按新的标题坐标判定，默认分区的空 ID 仍是有效目标', () => {
  assert.equal(groupAt({ x: 100, y: 280 }, bounds, headers), 'a');
  assert.equal(groupAt({ x: 100, y: 280 }, bounds, [headers[0]!, { id: '', top: 240, bottom: 272 }]), '');
});

test('目标按视觉位置识别，忽略隐藏的标题和 DOM 顺序', () => {
  assert.equal(groupAt({ x: 100, y: 200 }, bounds, [headers[1]!, { id: 'hidden', top: 0, bottom: 0 }, headers[0]!]), 'a');
  assert.equal(groupAt({ x: 100, y: 200 }, bounds, []), undefined);
});
