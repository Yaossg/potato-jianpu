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
        <path d="M6 3.5h9.2L20 8.3V20a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 20V5A1.5 1.5 0 0 1 5.5 3.5H6Zm8 1.9V9h3.6L14 5.4ZM6 5.5v14h12V11h-6V5.5H6Z" />
        <path d="M8 9h2v2H8V9Zm0 4h2v2H8v-2Zm4-3h4v1.7h-4V10Zm0 4h4v1.7h-4V14Z" />
      </>
    ) : name === "open" ? (
      <>
        <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H10l2 2h6.5A1.5 1.5 0 0 1 20 9.5V11h-2V10h-6.8l-2-2H6v10h6v2H5.5A1.5 1.5 0 0 1 4 18.5v-11Z" />
        <path d="M15 12h2v3h3v2h-3v3h-2v-3h-3v-2h3v-3Z" />
      </>
    ) : name === "save" ? (
      <>
        <path d="M5 3.5h11.6L20.5 7.4V20A1.5 1.5 0 0 1 19 21.5H5A1.5 1.5 0 0 1 3.5 20V5A1.5 1.5 0 0 1 5 3.5Zm.5 2v14h13V8.2l-2.7-2.7H15V10H7V5.5H5.5ZM9 5.5V8h4V5.5H9Z" />
        <path d="M7 13h10v2H7v-2Zm0 3h10v2H7v-2Z" />
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
