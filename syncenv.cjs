const sodium = require('libsodium-wrappers')
const Octokit = require('@octokit/rest').Octokit
require('dotenv').config()
const dotenv = require('dotenv')
const fs = require('fs')
const secret = 'YOUR_SECRET'
const key = 'YOUR_BASE64_KEY'
const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
const octokit = new Octokit({ auth: token });
//Check if libsodium is ready and then proceed.
sodium.ready.then(async () => {
   const data = await octokit.actions.getRepoPublicKey({
      owner,
      repo,
    });
    console.log(data)
    const publicKey = data.data;
    const envContent = fs.readFileSync('.env', 'utf-8');
        const envVars = dotenv.parse(envContent);
  // Convert the secret and key to a Uint8Array.
   console.log(`Syncing ${Object.keys(envVars).length} environment variables to GitHub secrets...`);

    /*for (const [key, value] of Object.entries(envVars)) {
      console.log(`Processing secret: ${key}`);
      if (!value || value.trim() === '') {
        console.log(`Skipping empty secret: ${key}`);
        continue;
    }}
  let binkey = sodium.from_base64(publicKey.key, sodium.base64_variants.ORIGINAL)
  let binsec = sodium.from_string(secret)

  // Encrypt the secret using libsodium
  let encBytes = sodium.crypto_box_seal(binsec, binkey)

  // Convert the encrypted Uint8Array to Base64
  let output = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL)

  // Print the output
  console.log(output)*/
});
