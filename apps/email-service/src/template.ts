import Handlebars from "handlebars";

type AutolinkStyle = {
  wordBreak?: boolean;
};

/**
 * Converts URLs in text to clickable HTML links
 */
export const autolink = (
  text: string,
  style?: AutolinkStyle
): Handlebars.SafeString | string => {
  if (!text) return "";

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const wordBreakStyle = style?.wordBreak ? " word-break: break-all;" : "";

  return new Handlebars.SafeString(
    text.replace(
      urlRegex,
      `<a href="$1" style="color: #3498db; text-decoration: none;${wordBreakStyle}">$1</a>`
    )
  );
};

/**
 * Converts newlines to <br> tags
 */
export const nl2br = (text: string): Handlebars.SafeString | string => {
  if (!text) return "";

  return new Handlebars.SafeString(text.replace(/\n/g, "<br>"));
};

/**
 * Formats message with both URL linking and newline conversion
 */
export const formatMessage = (text: string): Handlebars.SafeString | string => {
  if (!text) return "";

  const linkedText = autolink(text, { wordBreak: true }).toString();
  const formatted = linkedText.replace(/\n/g, "<br>");

  return new Handlebars.SafeString(formatted);
};

/**
 * Register all Handlebars helpers
 */
export const registerHelpers = (): void => {
  Handlebars.registerHelper("autolink", autolink);
  Handlebars.registerHelper("nl2br", nl2br);
  Handlebars.registerHelper("formatMessage", formatMessage);
};

/**
 * Render a Handlebars template with variables
 */
export const renderTemplate = (
  source: string,
  variables: Record<string, unknown>
): string => {
  return Handlebars.compile(source)(variables);
};
