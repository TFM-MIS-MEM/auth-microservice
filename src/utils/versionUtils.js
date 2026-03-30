const fs = require('fs');
const path = require('path');

/**
 * Reads the .version file and returns its content.
 * Falls back to the package.json version if .version doesn't exist.
 */
const getVersion = () => {
  try {
    const versionPath = path.join(process.cwd(), '.version');
    return fs.readFileSync(versionPath, 'utf8').trim();
  } catch {
    try {
      const pkg = require('../../package.json');
      return pkg.version;
    } catch {
      return 'unknown';
    }
  }
};

module.exports = { getVersion };
