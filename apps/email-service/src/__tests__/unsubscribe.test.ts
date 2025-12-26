import { describe, it, expect } from "vitest";
import {
  mapRecipientTypeToUnsubscribeType,
  unsubscribeLabel,
  getUnsubscribeLinks,
  appendUnsubscribeToContent,
  type EmailRecipientType,
  type UnsubscribeType,
} from "../unsubscribe.js";

describe("mapRecipientTypeToUnsubscribeType", () => {
  it("should map event_registrants to events", () => {
    expect(mapRecipientTypeToUnsubscribeType("event_registrants")).toBe("events");
  });

  it("should map event_attendees to events", () => {
    expect(mapRecipientTypeToUnsubscribeType("event_attendees")).toBe("events");
  });

  it("should map event_reminder to events_reminder", () => {
    expect(mapRecipientTypeToUnsubscribeType("event_reminder")).toBe("events_reminder");
  });

  it("should map custom to announcements", () => {
    expect(mapRecipientTypeToUnsubscribeType("custom")).toBe("announcements");
  });

  it("should map all_users to announcements", () => {
    expect(mapRecipientTypeToUnsubscribeType("all_users")).toBe("announcements");
  });

  it("should default to announcements for undefined", () => {
    expect(mapRecipientTypeToUnsubscribeType(undefined)).toBe("announcements");
  });

  it("should default to announcements for unknown types", () => {
    expect(mapRecipientTypeToUnsubscribeType("unknown" as EmailRecipientType)).toBe(
      "announcements"
    );
  });
});

describe("unsubscribeLabel", () => {
  it("should return 'Event emails' for events type", () => {
    expect(unsubscribeLabel("events")).toBe("Event emails");
  });

  it("should return 'Event reminders' for events_reminder type", () => {
    expect(unsubscribeLabel("events_reminder")).toBe("Event reminders");
  });

  it("should return 'Announcements' for announcements type", () => {
    expect(unsubscribeLabel("announcements")).toBe("Announcements");
  });

  it("should return 'All emails' for all type", () => {
    expect(unsubscribeLabel("all")).toBe("All emails");
  });

  it("should default to 'All emails' for unknown types", () => {
    expect(unsubscribeLabel("unknown" as UnsubscribeType)).toBe("All emails");
  });
});

describe("getUnsubscribeLinks", () => {
  const baseUrl = "https://example.com";
  const token = "abc123";

  it("should generate correct HTML link for event_registrants", () => {
    const result = getUnsubscribeLinks(baseUrl, token, "event_registrants");
    expect(result.html).toContain(`${baseUrl}/unsubscribe/${token}/events`);
    expect(result.html).toContain(`${baseUrl}/unsubscribe/${token}/all`);
    expect(result.html).toContain("Event emails");
    expect(result.html).toContain("All emails");
  });

  it("should generate correct text link for event_registrants", () => {
    const result = getUnsubscribeLinks(baseUrl, token, "event_registrants");
    expect(result.text).toContain(`Event emails: ${baseUrl}/unsubscribe/${token}/events`);
    expect(result.text).toContain(`All emails: ${baseUrl}/unsubscribe/${token}/all`);
  });

  it("should generate correct links for event_reminder", () => {
    const result = getUnsubscribeLinks(baseUrl, token, "event_reminder");
    expect(result.html).toContain(`${baseUrl}/unsubscribe/${token}/events_reminder`);
    expect(result.text).toContain("Event reminders");
  });

  it("should generate correct links for custom emails", () => {
    const result = getUnsubscribeLinks(baseUrl, token, "custom");
    expect(result.html).toContain(`${baseUrl}/unsubscribe/${token}/announcements`);
    expect(result.text).toContain("Announcements");
  });

  it("should handle undefined recipient type", () => {
    const result = getUnsubscribeLinks(baseUrl, token, undefined);
    expect(result.html).toContain(`${baseUrl}/unsubscribe/${token}/announcements`);
  });

  it("should include proper HTML styling", () => {
    const result = getUnsubscribeLinks(baseUrl, token, "custom");
    expect(result.html).toContain('style="margin-top:20px');
    expect(result.html).toContain('style="color:#666;"');
  });
});

describe("appendUnsubscribeToContent", () => {
  const unsubscribeLinks = {
    html: '<div class="unsub">Unsubscribe</div>',
    text: "\n\n---\nUnsubscribe link",
  };

  it("should append HTML before closing body tag", () => {
    const html = "<html><body><p>Content</p></body></html>";
    const result = appendUnsubscribeToContent(html, "Text content", unsubscribeLinks);
    expect(result.html).toContain('<div class="unsub">Unsubscribe</div></body>');
  });

  it("should append HTML at end if no body tag", () => {
    const html = "<p>Content</p>";
    const result = appendUnsubscribeToContent(html, "Text content", unsubscribeLinks);
    expect(result.html).toBe('<p>Content</p><div class="unsub">Unsubscribe</div>');
  });

  it("should append to existing text content", () => {
    const result = appendUnsubscribeToContent(
      "<p>HTML</p>",
      "Original text",
      unsubscribeLinks
    );
    expect(result.text).toBe("Original text\n\n---\nUnsubscribe link");
  });

  it("should use unsubscribe text if no original text", () => {
    const result = appendUnsubscribeToContent("<p>HTML</p>", undefined, unsubscribeLinks);
    expect(result.text).toBe("\n\n---\nUnsubscribe link");
  });
});
