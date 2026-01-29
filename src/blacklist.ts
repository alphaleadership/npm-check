import { getConfig, saveConfig } from "./lib/config-db.ts";

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const username = args[1];

    if (!command || !username) {
        console.error("Usage: npm run blacklist <add|remove> <username>");
        return;
    }

    const config = await getConfig();
    const blacklistedAuthors = config.blacklistedAuthors || [];

    if (command === "add") {
        if (blacklistedAuthors.includes(username)) {
            console.log(`Username ${username} is already blacklisted.`);
        } else {
            blacklistedAuthors.push(username);
            config.blacklistedAuthors = blacklistedAuthors;
            await saveConfig(config);
            console.log(`Username ${username} has been added to the blacklist.`);
        }
    } else if (command === "remove") {
        const index = blacklistedAuthors.indexOf(username);
        if (index > -1) {
            blacklistedAuthors.splice(index, 1);
            config.blacklistedAuthors = blacklistedAuthors;
            await saveConfig(config);
            console.log(`Username ${username} has been removed from the blacklist.`);
        } else {
            console.log(`Username ${username} is not in the blacklist.`);
        }
    } else {
        console.error("Invalid command. Use 'add' or 'remove'.");
    }
}

main().catch(console.error);
