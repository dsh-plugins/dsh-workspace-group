import type { CordisContext, HostAPI } from '@dsh-plugin/dsh-loader';
import { defineConfig } from '@dsh-plugin/dsh-loader/config';

export const name = '@dsh-plugin/dsh-workspace-group';
export const inject = ['dshLoader'];

/** 交由 loader 管理当前配置档案的分区数据、鉴权和修订号。 */
export async function apply(ctx: CordisContext & { dshLoader: HostAPI }): Promise<void> {
  await ctx.dshLoader.config.register(ctx, defineConfig({
    id: 'dsh-workspace-group', packageName: name, title: '工作区分区',
    description: '在侧边栏点击“新建分区”，或通过工作区右键菜单管理归属。删除分区后，工作区会返回“项目”。',
    fields: [
      {
        type: 'array', key: 'groups', label: '分区', hidden: true, default: [],
        item: { type: 'object', label: '分区', fields: [
          { type: 'text', key: 'id', label: 'ID', required: true },
          { type: 'text', key: 'title', label: '名称', required: true, min: 1, max: 60 },
          { type: 'boolean', key: 'collapsed', label: '折叠', default: false },
        ] },
      },
      {
        type: 'array', key: 'assignments', label: '工作区归属', hidden: true, default: [],
        item: { type: 'object', label: '归属', fields: [
          { type: 'text', key: 'workspaceId', label: '工作区 ID', required: true },
          { type: 'text', key: 'groupId', label: '分区 ID', required: true },
        ] },
      },
      { type: 'boolean', key: 'defaultCollapsed', label: '折叠默认分区', hidden: true, default: false },
    ],
  }));
}
