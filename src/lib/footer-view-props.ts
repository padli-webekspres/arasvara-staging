import type { Configuration } from "@/types/configuration";

export const DEFAULT_FOOTER_COPYRIGHT =
  "© 2025 Arasvara Media. All rights reserved. Arasvara may earn a commission from purchases made through links on this site as part of our affiliate partnerships with selected retailers. The material on this site may not be reproduced, distributed, transmitted, cached, or otherwise used, except with prior written permission from Arasvara Media.";

export type FooterSocialIconId =
  | "instagram"
  | "x"
  | "facebook"
  | "threads"
  | "whatsapp"
  | "telegram";

export type FooterSocialItem = {
  name: string;
  href: string;
  icon: FooterSocialIconId;
};

export type FooterViewProps = {
  copyrightText: string;
  socialLinks: FooterSocialItem[];
  isLoading?: boolean;
};

function configString(
  configs: Pick<Configuration, "key" | "value">[],
  key: string,
  fallback = "",
): string {
  const item = configs.find((c) => c.key === key);
  if (item?.value == null || item.value === "") return fallback;
  if (typeof item.value === "string") return item.value;
  if (typeof item.value === "number" || typeof item.value === "boolean") {
    return String(item.value);
  }
  return fallback;
}

export function footerViewPropsFromConfigs(
  configs: Pick<Configuration, "key" | "value">[],
): FooterViewProps {
  const socialLinks: FooterSocialItem[] = [];
  const instagram = configString(configs, "social_instagram_link");
  const twitter = configString(configs, "social_twitter_link");
  const facebook = configString(configs, "social_facebook_link");
  const threads = configString(configs, "social_threads_link");
  const whatsapp = configString(configs, "whatsapp_channel");
  const telegram = configString(configs, "telegram_group");

  if (instagram) {
    socialLinks.push({
      name: "Instagram",
      href: instagram,
      icon: "instagram",
    });
  }
  if (twitter) {
    socialLinks.push({ name: "X (Twitter)", href: twitter, icon: "x" });
  }
  if (facebook) {
    socialLinks.push({ name: "Facebook", href: facebook, icon: "facebook" });
  }
  if (threads) {
    socialLinks.push({ name: "Threads", href: threads, icon: "threads" });
  }
  if (whatsapp) {
    socialLinks.push({
      name: "WhatsApp Channel",
      href: whatsapp,
      icon: "whatsapp",
    });
  }
  if (telegram) {
    socialLinks.push({ name: "Telegram", href: telegram, icon: "telegram" });
  }

  return {
    copyrightText: configString(
      configs,
      "copyright_text",
      DEFAULT_FOOTER_COPYRIGHT,
    ),
    socialLinks,
  };
}
