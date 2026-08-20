# dsh-bg-image

DeepSeek Harness 背景美化插件 —— 多图源壁纸、不透明度/模糊调节、localStorage 持久化。

![docs/screenshot-settings.png](docs/screenshot-settings.png)

## 功能

- **7 个图源**：动漫横屏、二次元插画、随机摄影、Bing 每日壁纸、艺术壁纸、自定义 URL、本地上传
- **实时预览**：不透明度与模糊滑块实时生效
- **自动持久化**：所有设置保存至 `localStorage`，DSH 重启后自动恢复
- **手动 / 自动刷新**：支持定时自动更换背景

## 安装

```sh
dsh plugin --profile <name> add dsh-bg-image
```

## 使用

1. 打开 WebUI → 侧栏「设置」→ 找到 **Background**
2. 选择图源 → 点击 **立即刷新**
3. 拖动「不透明度」和「模糊」滑块调节效果
4. 关闭设置面板后再次进入，设置自动保留

## 图源

| 名称 | 来源 | 内容 |
|------|------|------|
| 动漫横屏 | `loliapi.com/acg/pc/` | 动漫横屏壁纸 |
| 二次元插画 | `api.yujn.cn/api/ecy.php` | 二次元插画图 |
| 随机摄影 | `picsum.photos/1920/1080` | 随机风景摄影 |
| Bing 每日 | `api.yujn.cn/api/bing.php` | Bing 每日壁纸 |
| 艺术壁纸 | `api.yujn.cn/api/heisi.php` | 艺术风格壁纸 |
| 自定义链接 | 直接输入 URL | 任意图片 |
| 本地上传 | 文件选择器 | 本地图像 |

## 卸载

```sh
dsh plugin --profile <name> remove dsh-bg-image
```

## License

MIT
