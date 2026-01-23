import { Octokit } from '@octokit/rest';
import sodium, { output_formats } from 'libsodium-wrappers';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { base64_variants } from 'libsodium-wrappers';

// Load environment variables
dotenv.config();

async function syncEnvToGitHubSecrets() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;

  if (!token || !owner || !repo) {
    console.error('Please set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in your environment.');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });

  try {
    // Get the public key for encrypting secrets
    const { data: publicKey } = await octokit.actions.getRepoPublicKey({
      owner,
      repo,
    });
    console.log(publicKey)
    // Wait for sodium to be ready
    await sodium.ready;

    // Parse .env file
    const envContent = fs.readFileSync('.env', 'utf-8');
    const envVars = dotenv.parse(envContent);

    console.log(`Syncing ${Object.keys(envVars).length} environment variables to GitHub secrets...`);

    for (const [key, value] of Object.entries(envVars)) {
      console.log(`Processing secret: ${key}`);
      if (!value || value.trim() === '') {
        console.log(`Skipping empty secret: ${key}`);
        continue;
      }

      // Encrypt the secret value
      const encrypted = sodium.crypto_box_seal(
        sodium.from_base64(value, sodium.base64_variants.ORIGINAL),
        sodium.from_string(publicKey.key)
      );

      // Convert to base64 for the API
      const encryptedValue = sodium.to_base64(encrypted);

      // Set the secret
      await octokit.actions.createOrUpdateRepoSecret({
        owner,
        repo,
        secret_name: key,
        encrypted_value: encryptedValue,
        key_id: publicKey.key_id,
      });

      console.log(`Synced secret: ${key}`);
    }

    console.log('All secrets synced successfully!');
  } catch (error) {
    console.error('Error syncing secrets:', error);
    //process.exit(1);
  }
}

syncEnvToGitHubSecrets();