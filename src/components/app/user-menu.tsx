"use client";

import { Check, ChevronsUpDown, Languages, LogOut, Monitor, Moon, Settings, ShieldCheck, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { useTransition } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { signOut } from "@/features/auth/actions";
import { useLocalePreference } from "@/hooks/use-locale-preference";
import { LOCALE_LABELS } from "@/lib/i18n";
import { useT } from "@/lib/i18n/client";
import { initials } from "@/lib/utils/format";
import { LOCALES } from "@/types/common";

const THEME_OPTIONS = [
  { value: "light", icon: Sun, labelKey: "themeLight" },
  { value: "dark", icon: Moon, labelKey: "themeDark" },
  { value: "system", icon: Monitor, labelKey: "themeSystem" },
] as const;

export interface UserMenuProps {
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isPlatformAdmin?: boolean;
  /** `sidebar` renders as a sidebar footer row; `compact` as an avatar button. */
  variant?: "sidebar" | "compact";
}

export function UserMenu({ displayName, email, avatarUrl, isPlatformAdmin = false, variant = "sidebar" }: UserMenuProps) {
  const t = useT("nav");
  const tc = useT("common");
  const { theme, setTheme } = useTheme();
  const { locale, setLocale } = useLocalePreference();
  const [pending, startTransition] = useTransition();
  const name = displayName ?? email ?? "";

  const menu = (
    <DropdownMenuContent align="end" side={variant === "sidebar" ? "top" : "bottom"} className="w-60">
      <DropdownMenuLabel className="flex items-center gap-2 py-1.5">
        <Avatar size="sm">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback className="text-[0.7rem]">{initials(name)}</AvatarFallback>
        </Avatar>
        <span className="grid min-w-0 flex-1 leading-tight">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          {email ? <span className="truncate text-xs font-normal">{email}</span> : null}
        </span>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem render={<Link href="/settings/profile" />}>
        <Settings />
        {t("profile")}
      </DropdownMenuItem>
      {isPlatformAdmin ? (
        <DropdownMenuItem render={<Link href="/admin" />}>
          <ShieldCheck />
          {t("admin")}
        </DropdownMenuItem>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Languages />
          <span className="flex-1">{t("language")}</span>
          <span className="text-xs text-muted-foreground">{LOCALE_LABELS[locale]}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-36">
          {LOCALES.map((option) => (
            <DropdownMenuItem key={option} onClick={() => setLocale(option)}>
              <span className="flex-1">{LOCALE_LABELS[option]}</span>
              {option === locale ? <Check className="size-3.5" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
          <span className="flex-1">{t("theme")}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="w-40">
          {THEME_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <DropdownMenuItem key={option.value} onClick={() => setTheme(option.value)}>
                <Icon className="size-3.5" />
                <span className="flex-1">{t(option.labelKey)}</span>
                {theme === option.value ? <Check className="size-3.5" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            await signOut();
          });
        }}
      >
        {pending ? <Spinner /> : <LogOut />}
        {tc("actions.signOut")}
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (variant === "compact") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={t("openUserMenu")}
              className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <Avatar size="sm">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-[0.7rem]">{initials(name)}</AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" aria-label={t("openUserMenu")} />}>
            <Avatar size="sm">
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
              <AvatarFallback className="text-[0.7rem]">{initials(name)}</AvatarFallback>
            </Avatar>
            <span className="grid min-w-0 flex-1 text-left leading-tight">
              <span className="truncate text-sm font-medium">{name}</span>
              {email ? <span className="truncate text-xs text-muted-foreground">{email}</span> : null}
            </span>
            <ChevronsUpDown className="ml-auto opacity-60" />
          </DropdownMenuTrigger>
          {menu}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
