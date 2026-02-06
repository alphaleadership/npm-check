
import { readFileSync,writeFileSync } from 'fs';

function calculateSuspicionScore(cmd) {
  if (!cmd) return 0;
  let score = 0;
  const lowerCmd = cmd.toLowerCase();

  if (lowerCmd.includes("| bash") || lowerCmd.includes("| sh") || lowerCmd.includes("| zsh")) score += 15;
  if (lowerCmd.includes("curl ") || lowerCmd.includes("wget ")) score += 8;
  if (lowerCmd.includes("cmd.exe") || lowerCmd.includes("powershell")) score += 5;
  if (lowerCmd.includes("eval(") || lowerCmd.includes("exec(")) score += 5;
  if (lowerCmd.includes("python -c") || lowerCmd.includes("perl -e") || lowerCmd.includes("node -e")) score += 5;
  if (lowerCmd.includes("base64")) score += 4;
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(cmd)) score += 8;
  if (lowerCmd.includes("rm -rf") && (lowerCmd.includes("/") || lowerCmd.includes("~"))) score += 3;
  if (lowerCmd.includes("nslookup") || lowerCmd.includes("dig ") || lowerCmd.includes("ping ")) score += 2;
  if (lowerCmd.includes("whoami") || lowerCmd.includes("hostname") || lowerCmd.includes("uname")) score += 2;
  if (lowerCmd.includes("id") && (lowerCmd.includes(" -u") || lowerCmd.includes(" -g"))) score += 2;
  if (lowerCmd.includes("env") || lowerCmd.includes("printenv")) score += 5;
  if (lowerCmd.includes("git config") || lowerCmd.includes("npm whoami") || lowerCmd.includes("npm config")) score += 4;
  if (lowerCmd.includes("aws configure") || lowerCmd.includes("gcloud config") || lowerCmd.includes("az account")) score += 8;
  if (lowerCmd.includes("/etc/passwd") || lowerCmd.includes("/etc/shadow")) score += 10;
  if (lowerCmd.includes(".ssh/") || lowerCmd.includes(".bash_history")) score += 10;

  return score;
}

const db = JSON.parse(readFileSync('docs/db.json', 'utf8'));
const ultraSuspects = new Set();
db.map((item)=>{
  item.suspicionScore=calculateSuspicionScore(item.scriptContent)
  return item
})
writeFileSync('docs/db.json',JSON.stringify(db,null,2))
db.forEach(finding => {

  if (calculateSuspicionScore(finding.scriptContent) >= 10) {
    ultraSuspects.add(finding.packageName);
  }
});

console.log(ultraSuspects.size);
writeFileSync("./README.md",`# npm-scan

Monitors newly published npm package versions and flags publishes that **introduce** a \`preinstall\`or \`postinstall\` script. These lifecycle scripts can pose security risks, as they execute automatically during package installation and may be introduced in updates without users noticing.

The tool uses npm's replicate database (\`replicate.npmjs.com\`) to track changes, then fetches full package metadata from the registry to compare scripts between versions.

## Configuration

The application is configured using environment variables. You can set them in your shell, or by creating a\`.env\`file in the root of the project.

| Variable              | Description                                                                                                | Default                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- |
|\`NPM_REPLICATE_DB_URL\`| The URL of the npm replicate database.                                                                     |\`https://replicate.npmjs.com/\`   |
|\`NPM_CHANGES_URL\`     | The URL of the npm\`_changes\`feed.                                                                        |\`https://replicate.npmjs.com/_changes\`|
|\`NPM_REGISTRY_URL\`    | The URL of the npm registry.                                                                               |\`https://registry.npmjs.org/\`     |
|\`MAX_CONCURRENCY\`     | The maximum number of packages to process concurrently.                                                    |\`10\`                              |
|\`CHANGES_LIMIT\`       | The maximum number of changes to fetch per request.                                                        |\`200\`                             |
|\`POLL_MS\`             | The polling interval in milliseconds.                                                                      |\`1500\`                            |
|\`TELEGRAM_BOT_TOKEN\`  | Your Telegram bot token.                                                                                   |\`\`                               |
|\`TELEGRAM_CHAT_ID\`    | The ID of the Telegram chat to send notifications to.                                                      |\`\`                               |
|\`DISCORD_WEBHOOK_URL\` | The URL of the Discord webhook to send notifications to.                                                   |\`\`                               |
|\`GITHUB_TOKEN\`        | Your GitHub personal access token with\`public_repo\`scope. Used for creating issues.                      |\`\`                               |

## Suspicion Score

To reduce noise and focus on the most dangerous changes, each detected script is assigned a **Suspicion Score**. This score is calculated based on several criteria:

- **Extreme Risk (+15)**: Direct shell execution (e.g.,\`| bash\`,\`| sh\`,\`| zsh\`).
- **High Risk (+8 to +10)**: 
    - Downloads via\`curl\`or\`wget\`.
    - Hardcoded IP addresses.
    - Accessing sensitive files (e.g.,\`/etc/passwd\`,\`.ssh/\`,\`.bash_history\`).
    - Attempting to access cloud credentials (AWS, GCP, Azure).
- **Medium Risk (+4 to +5)**: 
    - Information gathering (e.g.,\`env\`,\`printenv\`,\`git config\`,\`npm whoami\`).
    - Use of\`base64\`(obfuscation),\`eval()\`, or\`exec()\`.
- **Low Risk (+2 to +3)**: Basic reconnaissance (\`whoami\`,\`hostname\`,\`nslookup\`,\`ping\`).

### Notification Threshold

- **Telegram & Discord**: Receive all alerts regardless of the score.
- **GitHub Issues**: Only triggered if the score is **10 or higher** (extremely suspect).

## Usage

It is recommended to run this application with a process manager like PM2.

1.  Clone the repository.
2.  Install dependencies with\`npm install\`.
3.  Copy\`.env.example\`to\`.env\`and fill in the values.
4.  Start the application with\`pm2 startOrReload ecosystem.config.cjs --env production\`.
5.  Save the PM2 process list with\`pm2 save\`.

## Hall of Fame

Malicious packages are screened and reported by myself. This project has led to the following results as of January 20th, 2026:

- **20 packages** have been reported
- **19 packages** has been removed
- **${ultraSuspects.size} ultra suspect packages** have been detected by the suspicion score system

Including at least 6 instances of live malware:

<img width="363" height="150" alt="image" src="https://github.com/user-attachments/assets/f3d6822e-5aac-4600-a7ec-7a2c63112ea8" />

## Author

**Daniel Lockyer** <hi@daniellockyer.com>

[GitHub Sponsors](https://github.com/sponsors/daniellockyer)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
`)