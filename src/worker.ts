/**
 * npm preinstall/postinstall monitor - Worker
 *
 * Processes packages from BullMQ queue and runs heuristics to detect
 * malicious packages (specifically checking for newly introduced preinstall/postinstall scripts).
 */

import "dotenv/config";
import { Worker } from "bullmq";
import semver from "semver";
import { type PackageJobData } from "./queue.ts";
import { fetchPackument, type Packument } from "./lib/fetch-packument.ts";
import { sendScriptAlertNotifications } from "./lib/notifications.ts";

const DEFAULT_REGISTRY_URL = "https://registry.npmjs.org/";

interface VersionDoc {
  scripts?: {
    preinstall?: string;
    postinstall?: string;
    [key: string]: string | undefined;
  };
  [key: string]: unknown;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error);
}

function isLikelyVersionKey(key: unknown): key is string {
  return typeof key === "string" && semver.valid(key) !== null;
}

function hasScript(versionDoc: unknown, scriptName: string): boolean {
  if (!versionDoc || typeof versionDoc !== "object") return false;
  const doc = versionDoc as VersionDoc;
  const scripts = doc.scripts;
  if (!scripts || typeof scripts !== "object") return false;
  const val = scripts[scriptName];
  return typeof val === "string" && val.trim().length > 0;
}

function getScript(
  versionDoc: VersionDoc | undefined,
  scriptName: string,
): string {
  return versionDoc?.scripts?.[scriptName] ?? "";
}

function pickLatestAndPreviousVersions(doc: Packument): {
  latest: string | null;
  previous: string | null;
} {
  const versions =
    doc.versions && typeof doc.versions === "object"
      ? (doc.versions as Record<string, VersionDoc>)
      : null;

  if (!versions) return { latest: null, previous: null };

  // Always find the highest semver version from all available versions
  // Don't trust dist-tags as they may not reflect the actual highest version
  const versionKeys = Object.keys(versions);
  const sortedVersions = versionKeys
    .filter((v) => isLikelyVersionKey(v))
    .sort((a, b) => semver.compare(b, a) ?? 0);

  const latest = sortedVersions[0] || null;
  const previous = sortedVersions[1] || null;

  return { latest, previous };
}

async function processPackage(job: { data: PackageJobData }): Promise<void> {
  const { packageName } = job.data;
  const registryBaseUrl = process.env.NPM_REGISTRY_URL || DEFAULT_REGISTRY_URL;

  process.stdout.write(`[${nowIso()}] Processing: ${packageName}\n`);

  let packument: Packument;
  try {
    packument = await fetchPackument(registryBaseUrl, packageName);
  } catch (e) {
    throw new Error(
      `packument fetch failed for ${packageName}: ${getErrorMessage(e)}`,
    );
  }

  const { latest, previous } = pickLatestAndPreviousVersions(packument);

  process.stdout.write(
    `[${nowIso()}] ${packageName}: latest=${latest ?? "null"}, previous=${previous ?? "null"}\n`,
  );

  if (!latest) {
    process.stdout.write(
      `[${nowIso()}] Skipping ${packageName}: no versions found\n`,
    );
    return;
  }

  const versions = (packument.versions ?? {}) as Record<string, VersionDoc>;
  const latestDoc = versions[latest];
  const prevDoc = previous ? versions[previous] : undefined;

  for (const scriptType of ["postinstall", "preinstall"] as const) {
    const latestHasScript = hasScript(latestDoc, scriptType);
    const prevHasScript = prevDoc ? hasScript(prevDoc, scriptType) : false;

    // Skip if latest version doesn't have the script
    if (!latestHasScript) continue;

    const latestCmd = getScript(latestDoc, scriptType);
    const prevCmd = prevDoc ? getScript(prevDoc, scriptType) : null;
    const prevTxt = previous
      ? ` (prev: ${previous})`
      : " (first publish / unknown prev)";

    // Detect script added (wasn't in previous version)
    if (!prevHasScript) {
      process.stdout.write(
        `[${nowIso()}] 🚨 MALICIOUS PACKAGE DETECTED: ${scriptType} added: ${packageName}@${latest}${prevTxt}\n` +
          `  ${scriptType}: ${JSON.stringify(latestCmd)}\n`,
      );

      await sendScriptAlertNotifications(
        packageName,
        latest,
        previous,
        scriptType,
        latestCmd,
        null,
        packument,
        "added",
      );
      continue;
    }

    // Detect script changed (both versions have it but content differs)
    if (prevHasScript && latestCmd !== prevCmd) {
      process.stdout.write(
        `[${nowIso()}] 🚨 MALICIOUS PACKAGE DETECTED: ${scriptType} changed: ${packageName}@${latest}${prevTxt}\n` +
          `  Previous ${scriptType}: ${JSON.stringify(prevCmd)}\n` +
          `  New ${scriptType}: ${JSON.stringify(latestCmd)}\n`,
      );

      await sendScriptAlertNotifications(
        packageName,
        latest,
        previous,
        scriptType,
        latestCmd,
        prevCmd,
        packument,
        "changed",
      );
    }
  }
}

const connection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: null,
};

const worker = new Worker<PackageJobData>(
  "package-scan",
  async (job) => {
    await processPackage(job);
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
    limiter: {
      max: Number(process.env.WORKER_MAX_JOBS_PER_SECOND || 10),
      duration: 1000,
    },
  },
);

worker.on("completed", (job) => {
  process.stdout.write(
    `[${nowIso()}] JOB COMPLETED: ${job.data.packageName}\n`,
  );
});

worker.on("failed", (job, err) => {
  process.stderr.write(
    `[${nowIso()}] JOB FAILED: ${job?.data.packageName}: ${getErrorMessage(err)}\n`,
  );
});

worker.on("error", (err) => {
  process.stderr.write(`[${nowIso()}] WORKER ERROR: ${getErrorMessage(err)}\n`);
});

process.stdout.write(
  `[${nowIso()}] Worker started: concurrency=${process.env.WORKER_CONCURRENCY || 5}\n`,
);

// Graceful shutdown
process.on("SIGTERM", async () => {
  process.stdout.write(`[${nowIso()}] SIGTERM received, closing worker...\n`);
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  process.stdout.write(`[${nowIso()}] SIGINT received, closing worker...\n`);
  await worker.close();
  process.exit(0);
});
