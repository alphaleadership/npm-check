# npm-check

Monitors newly published npm package versions and flags publishes that **introduce** a `preinstall` or `postinstall` script. These lifecycle scripts can pose security risks, as they execute automatically during package installation and may be introduced in updates without users noticing.

The tool uses npm's replicate database (`replicate.npmjs.com`) to track changes, then fetches full package metadata from the registry to compare scripts between versions.

## Author

**Daniel Lockyer** <hi@daniellockyer.com>
