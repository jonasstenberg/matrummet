export type EmailRecipientType =
  | "custom"
  | "event_registrants"
  | "event_attendees"
  | "event_reminder"
  | "all_users";

export type UnsubscribeType = "all" | "events" | "events_reminder" | "announcements";

/**
 * Maps email recipient type to unsubscribe type
 */
export const mapRecipientTypeToUnsubscribeType = (
  recipientType?: EmailRecipientType
): UnsubscribeType => {
  switch (recipientType) {
    case "event_registrants":
    case "event_attendees":
      return "events";
    case "event_reminder":
      return "events_reminder";
    case "custom":
    case "all_users":
    default:
      return "announcements";
  }
};

/**
 * Gets human-readable label for unsubscribe type
 */
export const unsubscribeLabel = (type: UnsubscribeType): string => {
  switch (type) {
    case "events":
      return "Event emails";
    case "events_reminder":
      return "Event reminders";
    case "announcements":
      return "Announcements";
    case "all":
    default:
      return "All emails";
  }
};

export type UnsubscribeLinks = {
  html: string;
  text: string;
};

/**
 * Generates unsubscribe links for email footer
 */
export const getUnsubscribeLinks = (
  baseUrl: string,
  token: string,
  recipientType?: EmailRecipientType
): UnsubscribeLinks => {
  const base = `${baseUrl}/unsubscribe/${token}`;
  const unsubscribeType = mapRecipientTypeToUnsubscribeType(recipientType);

  return {
    html: `
      <div style="margin-top:20px;padding-top:20px;border-top:1px solid #eee;font-size:12px;color:#666;">
        <p>
          Unsubscribe:
          <a href="${base}/${unsubscribeType}" style="color:#666;">
            ${unsubscribeLabel(unsubscribeType)}</a> |
          <a href="${base}/all" style="color:#666;">All emails</a>
        </p>
      </div>`,
    text: `\n\n---\nUnsubscribe:\n${unsubscribeLabel(unsubscribeType)}: ${base}/${unsubscribeType}\nAll emails: ${base}/all`,
  };
};

/**
 * Appends unsubscribe links to email content
 */
export const appendUnsubscribeToContent = (
  html: string,
  text: string | undefined,
  unsubscribeLinks: UnsubscribeLinks
): { html: string; text: string | undefined } => {
  const newHtml = html.includes("</body>")
    ? html.replace("</body>", `${unsubscribeLinks.html}</body>`)
    : `${html}${unsubscribeLinks.html}`;

  const newText = text
    ? `${text}${unsubscribeLinks.text}`
    : unsubscribeLinks.text;

  return { html: newHtml, text: newText };
};
