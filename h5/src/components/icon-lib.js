/**
 * 图标库入口：数据由 vite 插件在启动时用 Node fs 读取仓库根 icons/*.svg，
 * 通过虚拟模块 virtual:icon-lib 提供——dev/build 行为一致，不受项目外目录限制。
 * 数据库存储格式：icon:coffee。
 */
export { ICON_MAP, ICON_NAMES } from 'virtual:icon-lib';
