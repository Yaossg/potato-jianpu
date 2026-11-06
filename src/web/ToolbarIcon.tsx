export type ToolbarIconName = "dark" | "examples" | "export" | "help" | "language" | "light" | "open" | "play" | "save" | "settings" | "stop";

export function ToolbarIcon({ name }: { name: ToolbarIconName }) {
  const icon =
    name === "play" ? (
      <path d="M8 5v14l11-7z" />
    ) : name === "stop" ? (
      <path d="M7 7h10v10H7z" />
    ) : name === "language" ? (
      <>
        <circle cx="9" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M3 12h12M9 6c1.5 1.6 2.2 3.6 2.2 6S10.5 16.4 9 18M9 6c-1.5 1.6-2.2 3.6-2.2 6S7.5 16.4 9 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M15.8 9h5.4M18.5 6.4v2.8M17 17l3-7h1l3 7h-2.1l-.5-1.4h-2.8l-.5 1.4H17Zm2.2-3.1h1.7l-.8-2.4-.9 2.4Z" />
      </>
    ) : name === "light" ? (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.9 4.9 7 7M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
      </>
    ) : name === "dark" ? (
      <path d="M20 15.2A7.7 7.7 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" />
    ) : name === "examples" ? (
      <>
        <path d="M12 6C9 3.5 5.5 3.5 2 4.5v14c3.5-1 7-1 10 1.5 3-2.5 6.5-2.5 10-1.5v-14C18.5 3.5 15 3.5 12 6Zm0 0v14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M5.5 8.5c1.2-.1 2.2.1 3 .5m-3 3c1.2-.1 2.2.1 3 .5m7-3.5c.8-.4 1.8-.6 3-.5m-3 4c.8-.4 1.8-.6 3-.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ) : name === "open" ? (
      <>
        <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5V11h-2V10h-6.8l-2-2H6v10h6v2H5.5A1.5 1.5 0 0 1 4 18.5v-11Z" />
        <path d="M15 12h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" />
      </>
    ) : name === "save" ? (
      <>
        <path d="M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 0v6h8V3M7 21v-8h10v8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M13 4h2v4h-2z" />
      </>
    ) : name === "export" ? (
      <>
        <path d="M5 8h5V6H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2v-5h-2v5H5V8Z" />
        <path d="M13 4h7v7h-2V7.4l-6.1 6.1-1.4-1.4L16.6 6H13V4Z" />
      </>
    ) : name === "settings" ? (
      <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a8.3 8.3 0 0 0-2.6-1.5L14 2h-4l-.4 2.5A8.3 8.3 0 0 0 7 6L4.6 5 2.6 8.5l2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a8.3 8.3 0 0 0 2.6 1.5L10 22h4l.4-2.5A8.3 8.3 0 0 0 17 18l2.4 1 2-3.5-2-1.5ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z" />
    ) : (
      <>
        <circle cx="12" cy="12" r="9" />
        <path className="toolbar-icon-cutout" d="M11 16h2v2h-2zM12 6.1a3.7 3.7 0 0 0-3.8 3.7h2.2a1.6 1.6 0 1 1 1.6 1.6c-.7 0-1.1.5-1.1 1.1V15h2.2v-1.5A3.7 3.7 0 0 0 12 6.1Z" />
      </>
    );

  return (
    <svg className={`toolbar-icon toolbar-icon-${name}`} aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      {icon}
    </svg>
  );
}
