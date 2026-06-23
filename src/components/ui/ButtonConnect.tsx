import React from "react";

interface ButtonConnectProps {
  app: "whatsapp" | "telegram";
  href?: string; // Channel link, boleh kosong
  children?: React.ReactNode;
}

// Icon SVG path murni (tanpa background rect kaku) untuk tampilan modern & minimalis
const icons = {
  whatsapp: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110"
    >
      <path d="M12.012 2c-5.506 0-9.989 4.478-9.99 9.984a9.96 9.96 0 001.333 4.982L2 22l5.233-1.371a9.994 9.994 0 004.778 1.209c5.505 0 9.989-4.478 9.99-9.984C22.007 6.48 17.521 2 12.012 2zm6.787 14.177c-.297.834-1.44 1.533-2.39 1.637-.655.072-1.512.106-2.4-.183a12.018 12.018 0 01-5.185-3.31 11.235 11.235 0 01-2.327-3.921 5.37 5.37 0 01-.186-2.146c.193-.834.729-1.285 1.13-1.621.282-.236.565-.295.753-.295.188 0 .377.004.54.011.173.008.406-.065.632.483.23.56.787 1.916.853 2.051.066.136.11.294.02.474-.09.18-.135.293-.27.452-.136.159-.286.356-.407.478-.136.137-.279.287-.12.56.159.273.708 1.17 1.517 1.892.83.74 1.533.97 1.834 1.12.302.15.48.125.66-.08.18-.205.78-.908.99-1.22.21-.312.42-.26.708-.153.287.106 1.823.859 2.138 1.016.316.156.527.236.602.366.075.13.075.75-.222 1.584z" />
    </svg>
  ),
  telegram: (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="w-5 h-5 shrink-0 transition-transform duration-300 group-hover:scale-110"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.11.02-1.93 1.23-5.46 3.62-.51.35-.98.53-1.39.51-.46-.01-1.33-.26-1.99-.47-.8-.27-1.44-.41-1.39-.87.03-.24.36-.49.99-.75 3.88-1.69 6.46-2.8 7.74-3.33 3.69-1.5 4.45-1.76 4.95-1.77.11 0 .36.03.52.16.14.12.18.28.19.45-.01.07 0 .14-.02.21z" />
    </svg>
  ),
};

const ButtonConnect: React.FC<ButtonConnectProps> = ({
  app,
  href = "#",
  children,
}) => {
  const label = app === "whatsapp" ? "Connect WhatsApp" : "Connect Telegram";

  // Skema gradasi warna brand premium yang disesuaikan agar menyatu dengan estetika website
  const bgClasses =
    app === "whatsapp"
      ? "bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 border-emerald-600/30 shadow-emerald-500/10 hover:shadow-emerald-500/20 focus:ring-green-400"
      : "bg-gradient-to-r from-sky-600 to-blue-500 hover:from-sky-500 hover:to-blue-400 border-sky-600/30 shadow-sky-500/10 hover:shadow-sky-500/20 focus:ring-blue-400";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-semibold text-sm text-white border transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-offset-2 ${bgClasses}`}
      style={{ minWidth: 140, width: "fit-content" }}
    >
      {icons[app]}
      <span className="tracking-wide">{children || label}</span>
    </a>
  );
};

export default ButtonConnect;

