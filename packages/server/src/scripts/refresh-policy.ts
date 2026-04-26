import * as tencentcloud from 'tencentcloud-sdk-nodejs'
import { buildUserEnvPolicyStatements } from '../cloudbase/provision.js'

const CamClient = (tencentcloud as any).cam.v20190116.Client
const ENV_ID = process.env.ENV_ID || 'coder-2gp91yxib2c34730'
const POLICY_NAME = `coder_policy_${ENV_ID}`

async function main() {
  const credential = {
    secretId: process.env.TCB_SECRET_ID || process.env.TENCENT_SECRET_ID || '',
    secretKey: process.env.TCB_SECRET_KEY || process.env.TENCENT_SECRET_KEY || '',
    token: process.env.TCB_TOKEN || process.env.TENCENTCLOUD_SESSIONTOKEN || '',
  }
  if (!credential.secretId) {
    console.error('TCB_SECRET_ID not set in env')
    process.exit(1)
  }
  const camClient: any = new CamClient({
    credential,
    region: '',
    profile: { httpProfile: { endpoint: 'cam.tencentcloudapi.com' } },
  })

  console.log(`[1/4] Listing policy: ${POLICY_NAME}`)
  const listResp = await camClient.ListPolicies({ Keyword: POLICY_NAME, Scope: 'Local' })
  const found = (listResp.List || []).find((p: any) => p.PolicyName === POLICY_NAME)
  if (!found) {
    console.error('Policy not found. Provision may not have run.')
    process.exit(2)
  }
  const policyId = found.PolicyId
  console.log(`  policyId = ${policyId}`)

  console.log(`[2/4] GetPolicy current content`)
  const detail = await camClient.GetPolicy({ PolicyId: policyId })
  console.log('  --- BEFORE ---')
  console.log('  ' + String(detail.PolicyDocument).replace(/\n/g, '\n  '))

  const newDoc = JSON.stringify(
    {
      version: '2.0',
      statement: buildUserEnvPolicyStatements(ENV_ID),
    },
    null,
    0,
  )
  console.log(`\n[3/4] UpdatePolicy with newest statements (scf:* / flexdb:* / tcb:* ...)`)
  const upd = await camClient.UpdatePolicy({
    PolicyId: policyId,
    PolicyDocument: newDoc,
    Description: 'Coder env access (refreshed)',
  })
  console.log('  resp:', JSON.stringify(upd))

  console.log(`[4/4] Re-fetch`)
  const after = await camClient.GetPolicy({ PolicyId: policyId })
  console.log('  --- AFTER ---')
  console.log('  ' + String(after.PolicyDocument).replace(/\n/g, '\n  '))

  console.log('\n✓ DONE. CAM changes typically take effect within ~1 minute.')
}

main().catch((err) => {
  console.error('FAILED:', err?.message || err)
  if (err?.stack) console.error(err.stack)
  process.exit(1)
})
