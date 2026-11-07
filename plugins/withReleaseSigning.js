/**
 * Signs release builds with the Play upload key, so it survives
 * `expo prebuild --clean`. The key details come from the VILARCI_UPLOAD_*
 * properties in ~/.gradle/gradle.properties (never in the repo). Without
 * them, release builds fall back to the debug key.
 */
const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');

const MARKER = 'VILARCI_UPLOAD_STORE_FILE';

const RELEASE_CONFIG = `signingConfigs {
        if (findProperty('${MARKER}')) {
            release {
                storeFile file(findProperty('${MARKER}'))
                storePassword findProperty('VILARCI_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('VILARCI_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('VILARCI_UPLOAD_KEY_PASSWORD')
            }
        }`;

function withSigningConfig(config) {
  return withAppBuildGradle(config, (config) => {
    let gradle = config.modResults.contents;
    if (gradle.includes(MARKER)) return config;
    gradle = gradle.replace(/signingConfigs \{/, RELEASE_CONFIG);
    // Only the release buildType: search after "buildTypes {", since the
    // signingConfigs block above now has a "release {" of its own.
    const types = gradle.indexOf('buildTypes {');
    gradle =
      gradle.slice(0, types) +
      gradle
        .slice(types)
        .replace(
          /(release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
          `$1signingConfig findProperty('${MARKER}') ? signingConfigs.release : signingConfigs.debug`,
        );
    if (!gradle.includes(`signingConfigs.release :`)) {
      throw new Error('withReleaseSigning: android/app/build.gradle layout changed');
    }
    config.modResults.contents = gradle;
    return config;
  });
}

// Lint runs out of Metaspace with the default limits.
function withGradleMemory(config) {
  return withGradleProperties(config, (config) => {
    const props = config.modResults.filter(
      (p) => !(p.type === 'property' && p.key === 'org.gradle.jvmargs'),
    );
    props.push({
      type: 'property',
      key: 'org.gradle.jvmargs',
      value: '-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8',
    });
    config.modResults = props;
    return config;
  });
}

module.exports = (config) => withGradleMemory(withSigningConfig(config));
