// Debug builds on a phone find Metro through ip.txt, which React Native
// fills with the Mac's LAN IP at build time; DHCP hands out a new one and the
// installed app can no longer load its bundle. Overwrite it with the Mac's
// Bonjour name (<LocalHostName>.local), which survives IP changes. The phase
// is appended, so it runs after "Bundle React Native code and images".
const { withXcodeProject } = require('expo/config-plugins');

const NAME = 'Metro host: Bonjour name';
const SCRIPT = [
  'if [[ "$CONFIGURATION" = *Debug* && "$PLATFORM_NAME" != *simulator ]]; then',
  '  echo "$(scutil --get LocalHostName).local" > "$CONFIGURATION_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/ip.txt"',
  'fi',
].join('\n');

module.exports = function withMetroHostname(config) {
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    const exists = Object.values(phases).some((p) => typeof p === 'object' && p.name === `"${NAME}"`);
    if (!exists) {
      project.addBuildPhase([], 'PBXShellScriptBuildPhase', NAME, project.getFirstTarget().uuid, {
        shellPath: '/bin/sh',
        shellScript: SCRIPT,
        alwaysOutOfDate: 1,
      });
    }
    return mod;
  });
};
