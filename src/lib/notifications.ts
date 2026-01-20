import { type Packument, encodePackageNameForRegistry } from "./fetch-packument.ts";

function nowIso(): string {
  return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error);
}

async function httpPostJson(
  url: string | URL,
  body: unknown,
  {
    headers = {},
    timeoutMs = 10000,
    timeoutMessage = "request timeout",
  }: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    timeoutMessage?: string;
  } = {},
): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function sendTelegramNotification(
  botToken: string,
  chatId: string,
  message: string,
): Promise<void> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  await httpPostJson(
    url,
    {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
    },
    { timeoutMessage: "Telegram notification timeout" },
  );
}

export async function sendDiscordNotification(
  webhookUrl: string,
  message: string,
): Promise<void> {
  await httpPostJson(
    webhookUrl,
    { content: message },
    { timeoutMessage: "Discord notification timeout" },
  );
}

export async function createGitHubIssue(
  githubToken: string,
  repoUrl: string,
  packageName: string,
  packageVersion: string,
  scriptType: "preinstall" | "postinstall",
  scriptContent: string,
  previousVersion: string | null = null,
  previousScriptContent: string | null = null,
): Promise<void> {
  const url = new URL(repoUrl);
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts.length < 2) {
    throw new Error(`Invalid GitHub repository URL: ${repoUrl}`);
  }
  const owner = pathParts[0];
  const repo = pathParts[1];
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;

  const isChanged = previousScriptContent !== null;
  const issueTitle = isChanged
    ? `[Security Alert] \`${scriptType}\` script changed in \`${packageName}@${packageVersion}\``
    : `[Security Alert] New \`${scriptType}\` script added in \`${packageName}@${packageVersion}\``;

  let issueBody: string;
  if (isChanged) {
    issueBody = `
The \`${scriptType}\` script was changed in version \`${packageVersion}\` of the package \`${packageName}\`.

**Previous version:** ${previousVersion ?? "none"}
**Previous script:**
\`\`\`
${previousScriptContent}
\`\`\`

**New script:**
\`\`\`
${scriptContent}
\`\`\`

This could be a security risk. Please investigate.
`;
  } else {
    issueBody = `
A new \`${scriptType}\` script was detected in version \`${packageVersion}\` of the package \`${packageName}\`.

**Script content:**
\`\`\`
${scriptContent}
\`\`\`

This could be a security risk. Please investigate.
`;
  }

  await httpPostJson(
    apiUrl,
    {
      title: issueTitle,
      body: issueBody,
    },
    {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
      timeoutMessage: "GitHub issue creation timeout",
    },
  );
}

export async function sendScriptAlertNotifications(
  packageName: string,
  latest: string,
  previous: string | null,
  scriptType: "preinstall" | "postinstall",
  latestCmd: string,
  prevCmd: string | null,
  packument: Packument,
  alertType: "added" | "changed",
): Promise<void> {
  const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = process.env.TELEGRAM_CHAT_ID;
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const githubToken = process.env.GITHUB_TOKEN;

  const scriptLabel = scriptType.charAt(0).toUpperCase() + scriptType.slice(1);
  const npmPackageUrl = `https://www.npmjs.com/package/${encodePackageNameForRegistry(packageName)}`;

  // Send Telegram notification if configured
  if (telegramBotToken && telegramChatId) {
    try {
      let message: string;
      if (alertType === "added") {
        message =
          `🚨 <b>${scriptLabel} script added</b>\n\n` +
          `Package: <code>${packageName}@${latest}</code>\n` +
          `<a href="${npmPackageUrl}">View on npm</a>\n` +
          `Previous version: ${previous ?? "none"}\n` +
          `<code>${latestCmd.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`;
      } else {
        message =
          `🚨 <b>${scriptLabel} script changed</b>\n\n` +
          `Package: <code>${packageName}@${latest}</code>\n` +
          `<a href="${npmPackageUrl}">View on npm</a>\n` +
          `Previous version: ${previous ?? "none"}\n` +
          `Previous ${scriptLabel}: <code>${(prevCmd ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>\n` +
          `New ${scriptLabel}: <code>${latestCmd.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code>`;
      }
      await sendTelegramNotification(telegramBotToken, telegramChatId, message);
    } catch (e) {
      process.stderr.write(
        `[${nowIso()}] WARN Telegram notification failed: ${getErrorMessage(e)}\n`,
      );
    }
  }

  // Send Discord notification if configured
  if (discordWebhookUrl) {
    try {
      let message: string;
      if (alertType === "added") {
        message =
          `🚨 **${scriptLabel} script added**\n\n` +
          `**Package:** \`${packageName}@${latest}\`\n` +
          `**Previous version:** ${previous ?? "none"}\n` +
          `**${scriptLabel}:** \`\`\`${latestCmd}\`\`\``;
      } else {
        message =
          `🚨 **${scriptLabel} script changed**\n\n` +
          `**Package:** \`${packageName}@${latest}\`\n` +
          `**Previous version:** ${previous ?? "none"}\n` +
          `**Previous ${scriptLabel}:** \`\`\`${prevCmd ?? ""}\`\`\`\n` +
          `**New ${scriptLabel}:** \`\`\`${latestCmd}\`\`\``;
      }
      await sendDiscordNotification(discordWebhookUrl, message);
    } catch (e) {
      process.stderr.write(
        `[${nowIso()}] WARN Discord notification failed: ${getErrorMessage(e)}\n`,
      );
    }
  }

  // Create GitHub issue if configured
  if (githubToken && packument.repository?.url) {
    try {
      await createGitHubIssue(
        githubToken,
        packument.repository.url,
        packageName,
        latest,
        scriptType,
        latestCmd,
        previous,
        alertType === "changed" ? prevCmd : null,
      );
    } catch (e) {
      process.stderr.write(
        `[${nowIso()}] WARN GitHub issue creation failed: ${getErrorMessage(e)}\n`,
      );
    }
  }
}
