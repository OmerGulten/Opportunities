/**
 * Application shell: sidebar, topbar, brand and public chrome.
 *
 * `Topbar` and `CreditsPill` are async Server Components: import this barrel
 * from server code only. Client components should import the module they need
 * directly (for example `@/components/app/logo`).
 */

export { AppSidebar } from "./app-sidebar";
export type { AppSidebarProps } from "./app-sidebar";
export { CookieConsent } from "./cookie-consent";
export { CreditsPill } from "./credits-pill";
export type { CreditsPillProps } from "./credits-pill";
export { BrandLockup, Logo, Wordmark } from "./logo";
export type { BrandLockupProps, LogoProps, WordmarkProps } from "./logo";
export { MarketingFooter } from "./marketing-footer";
export { MarketingHeader } from "./marketing-header";
export type { MarketingHeaderProps } from "./marketing-header";
export { Topbar } from "./topbar";
export type { TopbarProps } from "./topbar";
export { UserMenu } from "./user-menu";
export type { UserMenuProps } from "./user-menu";
export { WorkspaceSwitcher } from "./workspace-switcher";
export type { WorkspaceOption, WorkspaceSwitcherProps } from "./workspace-switcher";
