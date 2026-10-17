// Android 12+: android:allowBackup="false" apaga la copia en la nube, pero NO la transferencia entre teléfonos
// (cable o Wi-Fi al configurar uno nuevo). Estas reglas excluyen todos los datos de la app de ambas.
// La única forma de llevar los datos a otro teléfono es la copia .fpbak cifrada (Ajustes → Respaldo).
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const DOMAINS = ['root', 'file', 'database', 'sharedpref', 'external', 'device_root', 'device_file', 'device_database', 'device_sharedpref'];
const excludeAll = DOMAINS.map((d) => `    <exclude domain="${d}" path="." />`).join('\n');
const RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
${excludeAll}
  </cloud-backup>
  <device-transfer>
${excludeAll}
  </device-transfer>
</data-extraction-rules>
`;

module.exports = function withNoDataExtraction(config) {
  config = withAndroidManifest(config, (c) => {
    c.modResults.manifest.application[0].$['android:dataExtractionRules'] = '@xml/data_extraction_rules';
    return c;
  });
  return withDangerousMod(config, [
    'android',
    async (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'data_extraction_rules.xml'), RULES);
      return c;
    },
  ]);
};
