import { Dialog } from '../../components/Dialog';
import type { Runtime } from '../../app/runtime';
export function SettingsPanel({ runtime, onClose }: { runtime: Runtime; onClose: () => void }) {
  return <Dialog title="外观设置" onClose={onClose}><p>当前主题：{runtime.settings.value.theme}。设置面板正在接入。</p></Dialog>;
}
