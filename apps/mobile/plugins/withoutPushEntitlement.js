// A free (personal) Apple team cannot sign the Push Notifications
// capability, but expo-notifications always adds `aps-environment`. Strip
// it for personal-team builds; local notifications don't need it.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults['aps-environment'];
    return mod;
  });
};
