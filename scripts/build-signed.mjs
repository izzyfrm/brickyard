// Builds the Windows installer and signs it with Azure Trusted Signing.
// Plain `npm run build:win` stays unsigned, so nobody needs an Azure account to build.
//
// Needs these environment variables (see SIGNING.md):
//   AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET   service principal
//   AZURE_SIGN_ENDPOINT     e.g. https://eus.codesigning.azure.net/
//   AZURE_SIGN_ACCOUNT      Trusted Signing account name
//   AZURE_SIGN_PROFILE      certificate profile name
//   AZURE_SIGN_PUBLISHER    must match the certificate subject exactly, e.g. "CN=Jane Doe"
import { spawnSync } from 'child_process'

const need = ['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_SIGN_ENDPOINT', 'AZURE_SIGN_ACCOUNT', 'AZURE_SIGN_PROFILE', 'AZURE_SIGN_PUBLISHER']
const missing = need.filter((k) => !process.env[k])
if (missing.length) {
  console.error(`Cannot sign: missing ${missing.join(', ')}. See SIGNING.md.`)
  process.exit(1)
}

const env = process.env
const args = [
  'electron-builder',
  '--win',
  `-c.win.azureSignOptions.endpoint=${env.AZURE_SIGN_ENDPOINT}`,
  `-c.win.azureSignOptions.codeSigningAccountName=${env.AZURE_SIGN_ACCOUNT}`,
  `-c.win.azureSignOptions.certificateProfileName=${env.AZURE_SIGN_PROFILE}`,
  `-c.win.azureSignOptions.publisherName=${env.AZURE_SIGN_PUBLISHER}`
]
// No shell: the publisher name contains spaces and must reach electron-builder as one argument.
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const r = spawnSync(npx, args, { stdio: 'inherit', shell: false })
if (r.error) console.error(r.error.message)
process.exit(r.status ?? 1)
