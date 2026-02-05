
export function calculateSuspicionScore(cmd: string): number {
  if (!cmd) return 0;
  let score = 0;
  const lowerCmd = cmd.toLowerCase();

  // High Risk: Remote execution & Data exfiltration
  if (lowerCmd.includes("| bash") || lowerCmd.includes("| sh") || lowerCmd.includes("| zsh")) score += 15;
  if (lowerCmd.includes("curl ") || lowerCmd.includes("wget ")) score += 8;
  
  // Medium Risk: Shell execution context
  if (lowerCmd.includes("cmd.exe") || lowerCmd.includes("powershell")) score += 5;
  if (lowerCmd.includes("eval(") || lowerCmd.includes("exec(")) score += 5;
  if (lowerCmd.includes("python -c") || lowerCmd.includes("perl -e") || lowerCmd.includes("node -e")) score += 5;

  // Suspicious Patterns
  if (lowerCmd.includes("base64")) score += 4; // Often used for obfuscation
  if (/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(cmd)) score += 8; // IP Address present
  if (lowerCmd.includes("rm -rf") && (lowerCmd.includes("/") || lowerCmd.includes("~"))) score += 3; // Destructive
  
  // DNS / Network checks (reconnaissance)
  if (lowerCmd.includes("nslookup") || lowerCmd.includes("dig ") || lowerCmd.includes("ping ")) score += 2;
  
  // User and System Information gathering
  if (lowerCmd.includes("whoami") || lowerCmd.includes("hostname") || lowerCmd.includes("uname")) score += 2;
  if (lowerCmd.includes("id") && (lowerCmd.includes(" -u") || lowerCmd.includes(" -g"))) score += 2;
  if (lowerCmd.includes("env") || lowerCmd.includes("printenv")) score += 5; // Environment variables often contain secrets
  if (lowerCmd.includes("git config") || lowerCmd.includes("npm whoami") || lowerCmd.includes("npm config")) score += 4; // Developer identity
  if (lowerCmd.includes("aws configure") || lowerCmd.includes("gcloud config") || lowerCmd.includes("az account")) score += 8; // Cloud credentials
  if (lowerCmd.includes("/etc/passwd") || lowerCmd.includes("/etc/shadow")) score += 10; // System users
  if (lowerCmd.includes(".ssh/") || lowerCmd.includes(".bash_history")) score += 10; // Sensitive files

  return score;
}
