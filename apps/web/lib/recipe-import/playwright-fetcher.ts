import { chromium, Browser } from "playwright"
import { JsonLdRecipe } from "./types"
import { jsonLdRecipeSchema } from "../schemas"
import { logger as rootLogger } from '@/lib/logger'

const logger = rootLogger.child({ module: 'recipe-import' })

/**
 * Browser singleton for Playwright.
 * Shared across requests to avoid cold starts.
 */
let browserInstance: Browser | null = null
let browserPromise: Promise<Browser> | null = null
let lastUsed = Date.now()
let idleTimeoutId: ReturnType<typeof setTimeout> | null = null

const BROWSER_IDLE_TIMEOUT = 60000

function scheduleIdleCleanup(): void {
  if (idleTimeoutId) clearTimeout(idleTimeoutId)

  idleTimeoutId = setTimeout(async () => {
    if (Date.now() - lastUsed >= BROWSER_IDLE_TIMEOUT && browserInstance) {
      try {
        await browserInstance.close()
      } catch {
        // Ignore
      } finally {
        browserInstance = null
        browserPromise = null
      }
    }
  }, BROWSER_IDLE_TIMEOUT)
}

async function getBrowser(): Promise<Browser> {
  if (browserPromise) {
    const browser = await browserPromise
    lastUsed = Date.now()
    scheduleIdleCleanup()
    return browser
  }

  if (browserInstance?.isConnected()) {
    lastUsed = Date.now()
    scheduleIdleCleanup()
    return browserInstance
  }

  browserPromise = chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--no-sandbox",
    ],
  })
  try {
    browserInstance = await browserPromise
    lastUsed = Date.now()
    scheduleIdleCleanup()
    return browserInstance
  } catch (error) {
    browserPromise = null
    browserInstance = null
    throw error
  } finally {
    browserPromise = null
  }
}

/**
 * Parse JSON-LD Recipe data from an array of script contents
 */
function parseJsonLdFromScripts(scripts: (string | null)[]): JsonLdRecipe | null {
  for (const script of scripts) {
    if (!script) continue

    try {
      const parsed = JSON.parse(script)

      // Check if it's a single Recipe
      if (parsed["@type"] === "Recipe") {
        const result = jsonLdRecipeSchema.safeParse(parsed)
        if (result.success) {
          return result.data as JsonLdRecipe
        }
        logger.warn({ err: result.error.message }, 'JSON-LD Recipe validation failed')
        return null
      }

      // Check if it's wrapped in @graph structure
      if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
        const recipe = parsed["@graph"].find(
          (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            (item as Record<string, unknown>)["@type"] === "Recipe"
        )
        if (recipe) {
          const result = jsonLdRecipeSchema.safeParse(recipe)
          if (result.success) {
            return result.data as JsonLdRecipe
          }
          logger.warn({ err: result.error.message }, 'JSON-LD Recipe validation failed')
          return null
        }
      }

      // Check if it's an array of items
      if (Array.isArray(parsed)) {
        const recipe = parsed.find(
          (item: unknown) =>
            typeof item === "object" &&
            item !== null &&
            (item as Record<string, unknown>)["@type"] === "Recipe"
        )
        if (recipe) {
          const result = jsonLdRecipeSchema.safeParse(recipe)
          if (result.success) {
            return result.data as JsonLdRecipe
          }
          logger.warn({ err: result.error.message }, 'JSON-LD Recipe validation failed')
          return null
        }
      }
    } catch {
      continue
    }
  }

  return null
}

export interface PlaywrightFetchResult {
  jsonLd: JsonLdRecipe | null
  pageText: string | null
}

/**
 * Use Playwright to render JS-heavy pages and extract recipe data.
 * Returns JSON-LD if found, otherwise returns page text for AI parsing.
 */
export async function fetchWithPlaywright(
  url: string
): Promise<PlaywrightFetchResult> {
  let browser: Browser
  try {
    browser = await getBrowser()
  } catch (error) {
    logger.error({ err: error }, 'Failed to get browser')
    return { jsonLd: null, pageText: null }
  }

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    viewport: { width: 1920, height: 1080 },
    locale: "sv-SE",
    timezoneId: "Europe/Stockholm",
    extraHTTPHeaders: {
      "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Encoding": "gzip, deflate, br",
      "Sec-Ch-Ua": '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      "Sec-Ch-Ua-Mobile": "?0",
      "Sec-Ch-Ua-Platform": '"Windows"',
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    },
  })

  try {
    const page = await context.newPage()

    // Hide automation indicators before page loads
    await page.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      })

      // Override plugins to look more realistic
      Object.defineProperty(navigator, "plugins", {
        get: () => [
          { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
          { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
          { name: "Native Client", filename: "internal-nacl-plugin" },
        ],
      })

      // Override languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["sv-SE", "sv", "en-US", "en"],
      })

      // Hide automation in chrome object
      const originalChrome = (window as unknown as Record<string, unknown>).chrome
      ;(window as unknown as Record<string, unknown>).chrome = {
        ...((typeof originalChrome === "object" && originalChrome) || {}),
        runtime: {},
      }

      // Override permissions query
      const originalQuery = window.navigator.permissions.query
      window.navigator.permissions.query = (parameters: PermissionDescriptor) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: "prompt", onchange: null } as PermissionStatus)
          : originalQuery(parameters)
    })

    await page.goto(url, { waitUntil: "load", timeout: 30000 })

    // Wait for JS to render content (SPAs). Poll until body has substantial text.
    await page.waitForFunction(
      () => (document.body?.innerText?.length || 0) > 200,
      { timeout: 15000 }
    ).catch(() => {})

    // Check if we hit a browser challenge page (Cloudflare, WordPress.com, etc.)
    // Wait for it to resolve by checking for challenge indicators
    const challengePatterns = [
      "Checking your browser",
      "Just a moment",
      "Please wait",
      "Verifying you are human",
      "DDoS protection",
    ]

    let attempts = 0
    const maxAttempts = 10

    while (attempts < maxAttempts) {
      const bodyText = await page.evaluate(() => document.body?.innerText || "")
      const isChallenge = challengePatterns.some(pattern =>
        bodyText.toLowerCase().includes(pattern.toLowerCase())
      )

      if (!isChallenge) break

      // Challenge page detected, wait for it to resolve
      await page.waitForTimeout(2000)
      attempts++
    }

    if (attempts > 0 && attempts < maxAttempts) {
      // Challenge resolved, wait for the actual page to load
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {})
    }

    await page.waitForTimeout(1000)

    // Try to extract JSON-LD first
    const jsonLdScripts = await page.evaluate(() => {
      const scripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      )
      return Array.from(scripts).map((s) => s.textContent)
    })

    const jsonLd = parseJsonLdFromScripts(jsonLdScripts)

    // Always extract page text (needed for AI import even when JSON-LD exists)
    const pageText = await page.evaluate(() => {
      // Extract image URL from meta tags first
      const ogImage = document.querySelector('meta[property="og:image"]') as HTMLMetaElement | null
      const twitterImage = document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement | null
      const imageUrl = ogImage?.content || twitterImage?.content || null

      // Remove script, style, nav, header, footer, sidebar elements
      const elementsToRemove = document.querySelectorAll(
        "script, style, nav, header, footer, aside, [role='navigation'], [role='banner'], [role='contentinfo'], .sidebar, #sidebar, .widget-area, .comments, #comments, .comment-respond, .related-posts, .share-buttons, .social-share"
      )
      elementsToRemove.forEach((el) => el.remove())

      // Try multiple selectors for main content, in order of specificity
      const contentSelectors = [
        // Semantic HTML5
        "main article",
        "article",
        "main",
        "[role='main']",
        // Common blog/WordPress content classes
        ".entry-content",
        ".post-content",
        ".article-content",
        ".content-area",
        ".hentry",
        ".post",
        // Generic content containers
        "#content",
        ".content",
        "#main",
        ".main",
      ]

      let content: HTMLElement | null = null
      for (const selector of contentSelectors) {
        const el = document.querySelector(selector) as HTMLElement | null
        if (el && el.innerText.trim().length > 200) {
          content = el
          break
        }
      }

      // Fallback to body if no content container found
      if (!content) {
        content = document.body
      }

      // Get text content and clean it up
      const text = content?.innerText || ""
      const cleanedText = text
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .join("\n")

      // Prepend image URL if found so AI can use it
      if (imageUrl) {
        return `[Receptbild: ${imageUrl}]\n\n${cleanedText}`
      }
      return cleanedText
    })

    return { jsonLd, pageText: pageText || null }
  } catch (error) {
    logger.error({ err: error, url }, 'Playwright fetch failed')
    return { jsonLd: null, pageText: null }
  } finally {
    await context.close().catch(() => {})
  }
}
