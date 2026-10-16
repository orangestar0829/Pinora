import { ShieldCheck } from "lucide-react";
import { version } from "../../../package.json";

export function AboutSettings() {
  return (
    <section className="settings-section about-panel">
      <img src="/logo.svg" width="52" height="52" alt="" />
      <h3>
        Pinora <span>{version}</span>
      </h3>
      <p>
        本地优先的新标签页，以浏览器原生书签为中心，也可展示最近访问的网页和热门网站。
      </p>
      <div className="privacy-note">
        <ShieldCheck size={23} />
        <div>
          <strong>数据留在本机</strong>
          <p>
            无账户、无广告、无分析统计。设置、图标和壁纸保存在本机；历史记录和热门网站列表仅从本机浏览器读取，不另行保存，也不上报。
          </p>
        </div>
      </div>
      <p>
        基础功能使用书签、存储和本地网站图标权限。书签直接由浏览器管理，浏览器自身的书签同步仍由浏览器负责。
      </p>
      <p>
        历史记录和热门网站均为可选功能。在「布局 →
        主页内容」中，可分别获取权限、控制是否展示，并设置展示行数。
      </p>
    </section>
  );
}
