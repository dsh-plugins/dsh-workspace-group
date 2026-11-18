export const css = `
[data-wg-tree]{display:flex!important;flex-direction:column;gap:2px}
[data-wg-mount],[data-wg-section],[data-wg-section]>[role=group]{display:contents!important}
[data-wg-section]>:not([role=group]){order:var(--dsh-wg-order);flex-shrink:0;margin-left:16px;margin-right:4px}
[data-wg-section] [data-row-key^="workspace:"]{cursor:grab}
[data-wg-section][data-wg-hidden=true]>:not([role=group]){display:none!important}
[data-dshl-slot="workspace-group:create"]{display:flex;align-items:center;flex:none;margin-left:auto}
[data-dshl-slot="workspace-group:create"]+*{margin-left:0!important}
[data-sidebar-workspace-header]:has(input[tabindex="0"]) [data-dshl-slot="workspace-group:create"]{display:none}
.dsh-wg-header{display:flex;align-items:center;gap:2px;flex-shrink:0;min-height:32px;margin:10px 0 4px;padding:2px 6px;border:1px solid transparent;border-radius:8px;color:var(--color-text-3);font-size:12px}
.dsh-wg-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-wg-count{font-variant-numeric:tabular-nums;color:var(--color-text-4)}
.dsh-wg-header[data-wg-over]{border-color:rgb(var(--primary-6));background:var(--color-primary-light-1);color:rgb(var(--primary-6))}
[data-wg-dragging] .dsh-wg-header{outline:1px dashed var(--color-border-3);outline-offset:-2px}
[data-wg-dragging],[data-wg-dragging] *{cursor:grabbing!important;user-select:none!important}
.dsh-wg-drag-preview{position:fixed!important;top:0;left:0;z-index:10000;pointer-events:none!important;margin:0!important;opacity:.9;border-radius:8px;background:var(--color-bg-3);box-shadow:var(--shadow-2)}
.dsh-wg-status{order:0;color:var(--color-text-3);padding:8px;font-size:12px;display:flex;gap:6px;align-items:center;overflow-wrap:anywhere}
.dsh-wg-status[role=alert]{color:rgb(var(--danger-6))}
.dsh-wg-dialog p{font-size:13px;color:var(--color-text-3);line-height:1.6;margin:0 0 12px}
.dsh-wg-dialog .arco-input-wrapper{width:100%}
.dsh-wg-dialog .dsh-wg-error{color:rgb(var(--danger-6))}
`;
