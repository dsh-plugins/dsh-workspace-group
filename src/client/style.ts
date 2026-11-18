export const css = `
[data-wg-tree]{display:flex!important;flex-direction:column;gap:2px}
[data-wg-mount],[data-wg-section],[data-wg-section]>[role=group]{display:contents!important}
[data-wg-section]>:not([role=group]){order:var(--dsh-wg-order);flex-shrink:0;margin-left:16px;margin-right:4px}
[data-wg-section] [data-row-key^="workspace:"]{cursor:grab}
[data-wg-section][data-wg-hidden=true]>:not([role=group]){display:none!important}
[data-dshl-slot="workspace-group:create"]{display:flex;align-items:center;flex:none;margin-left:auto}
[data-dshl-slot="workspace-group:create"]+*{margin-left:0!important}
[data-sidebar-workspace-header]:has(input[tabindex="0"]) [data-dshl-slot="workspace-group:create"]{display:none}
.dsh-wg-create{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:6px;padding:0;background:transparent;color:var(--color-text-3);cursor:pointer}
.dsh-wg-create:hover{background:var(--color-fill-2);color:var(--color-text-1)}
.dsh-wg-create:focus-visible{outline:2px solid rgb(var(--primary-6));outline-offset:-2px}
.dsh-wg-create:disabled{opacity:.5;cursor:not-allowed}
.dsh-wg-header{display:flex;align-items:center;gap:2px;flex-shrink:0;min-height:32px;margin:10px 0 4px;padding:2px 6px;border:1px solid transparent;border-radius:8px;color:var(--color-text-3);font-size:12px}
.dsh-wg-header button{display:flex;align-items:center;justify-content:center;gap:6px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer;min-height:26px;padding:4px}
.dsh-wg-header button:hover{background:var(--color-fill-2);color:var(--color-text-1)}
.dsh-wg-header button:focus-visible{outline:2px solid rgb(var(--primary-6));outline-offset:1px}
.dsh-wg-header .dsh-wg-toggle{flex:1;min-width:0;justify-content:flex-start;text-align:left}
.dsh-wg-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsh-wg-count{font-variant-numeric:tabular-nums;color:var(--color-text-4)}
.dsh-wg-header[data-wg-over]{border-color:rgb(var(--primary-6));background:var(--color-primary-light-1);color:rgb(var(--primary-6))}
[data-wg-dragging] .dsh-wg-header{outline:1px dashed var(--color-border-3);outline-offset:-2px}
[data-wg-dragging],[data-wg-dragging] *{cursor:grabbing!important;user-select:none!important}
.dsh-wg-drag-preview{position:fixed!important;top:0;left:0;z-index:10000;pointer-events:none!important;margin:0!important;opacity:.9;border-radius:8px;background:var(--color-bg-3);box-shadow:var(--shadow-2)}
.dsh-wg-status{order:0;color:var(--color-text-3);padding:8px;font-size:12px;display:flex;gap:6px;align-items:center;overflow-wrap:anywhere}
.dsh-wg-status[role=alert]{color:rgb(var(--danger-6))}
.dsh-wg-status button{color:inherit;border:0;background:var(--color-fill-2);border-radius:4px;cursor:pointer;padding:4px;white-space:nowrap}
.dsh-wg-dialog{box-sizing:border-box;width:min(440px,calc(100vw - 32px));max-height:calc(100dvh - 240px);margin:120px auto;border:1px solid var(--color-border-2);border-radius:12px;padding:20px;background:var(--color-bg-2);color:var(--color-text-1);box-shadow:var(--shadow-3);display:flex;flex-direction:column;gap:16px}
.dsh-wg-dialog::backdrop{background:rgba(0,0,0,.4)}
.dsh-wg-dialog h2{margin:0;font-size:17px;font-weight:600}
.dsh-wg-dialog label{display:flex;flex-direction:column;gap:8px;font-size:13px}
.dsh-wg-dialog p{font-size:13px;color:var(--color-text-3);line-height:1.6;margin:12px 0 0}
.dsh-wg-dialog .arco-input-wrapper{width:100%}
.dsh-wg-dialog .dsh-wg-error{color:rgb(var(--danger-6))}
.dsh-wg-actions{display:flex;flex-shrink:0;justify-content:flex-end;gap:8px}
`;
