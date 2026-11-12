# Signing the Windows installer

Windows SmartScreen warns about any installer that is not code signed, and Chrome and Edge
show a warning in the download bar instead of the file's icon. Signing is the only real fix.

## Recommended: Azure Trusted Signing

About US$10 a month. Microsoft verifies who you are, then signs each build in the cloud,
so there is no USB token or certificate file to lose. Check Microsoft's current eligibility
rules before you start: individual developers have been limited to some countries.

1. Create an Azure account and a **Trusted Signing** account (Basic tier).
2. Complete **identity validation** (individual or organization). This can take a few days.
3. Create a **certificate profile** (Public Trust).
4. Create an **app registration** (service principal), give it the
   "Trusted Signing Certificate Profile Signer" role on the account, and create a client secret.
5. Set these environment variables, then run `npm run build:win:signed`:

| Variable | Value |
|---|---|
| `AZURE_TENANT_ID` | Directory (tenant) ID of the app registration |
| `AZURE_CLIENT_ID` | Application (client) ID |
| `AZURE_CLIENT_SECRET` | The client secret |
| `AZURE_SIGN_ENDPOINT` | Your account's region endpoint, for example `https://eus.codesigning.azure.net/` |
| `AZURE_SIGN_ACCOUNT` | Trusted Signing account name |
| `AZURE_SIGN_PROFILE` | Certificate profile name |
| `AZURE_SIGN_PUBLISHER` | The certificate subject, exactly as shown in Azure, for example `CN=Jane Doe` |

Never commit these values. Keep them in your shell or in GitHub Actions secrets.

## Alternative: buy a certificate

An OV code signing certificate from a certificate authority costs roughly US$200 to US$400 a year
and now ships on a hardware token or a cloud HSM. EV certificates no longer skip the SmartScreen
warning, so they are not worth the extra cost for this.

## What to expect

Signing removes "Unknown publisher". SmartScreen may still warn for the first downloads of a new
certificate while it builds reputation. That fades on its own and cannot be bought. You can help
by submitting each release to Microsoft at https://www.microsoft.com/wdsi/filesubmission
as a software developer.
