/* Copyright (c) 2026 jiongjiong123441. All rights reserved.
 * Licensed under PolyForm Noncommercial 1.0.0.
 * Noncommercial use, modification, and distribution are permitted.
 * Keep this notice and the LICENSE file with all copies and modified versions. */

import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CLOUDINARY_IMAGE_BYTES, uploadCloudinaryImage, uploadCloudinaryImages } from '../src/lib/cloudinary'

const env = {
  CLOUDINARY_CLOUD_NAME: 'demo',
  CLOUDINARY_API_KEY: 'api-key',
  CLOUDINARY_API_SECRET: 'api-secret',
}

test('Cloudinary upload returns secure URL and signs the expected fields', async () => {
  const originalFetch = globalThis.fetch
  let request: Request | undefined
  globalThis.fetch = async (_input, init) => {
    request = new Request('https://api.cloudinary.com/v1_1/demo/image/upload', init)
    return new Response(JSON.stringify({ secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/rent/test.png' }), { status: 200 })
  }
  try {
    const url = await uploadCloudinaryImage(new File(['image'], 'proof.png', { type: 'image/png' }), env, 'rent/payment-proofs')
    assert.match(url, /^https:\/\//)
    const body = await request!.formData()
    assert.equal(body.get('folder'), 'rent/payment-proofs')
    assert.equal(body.get('api_key'), 'api-key')
    assert.match(String(body.get('signature')), /^[0-9a-f]{40}$/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Cloudinary upload rejects unsupported or oversized images', async () => {
  await assert.rejects(
    () => uploadCloudinaryImage(new File(['text'], 'proof.txt', { type: 'text/plain' }), env, 'rent/payment-proofs'),
    /只支持 JPG、PNG 或 WebP/,
  )
  const oversized = new File([new Uint8Array(MAX_CLOUDINARY_IMAGE_BYTES + 1)], 'large.png', { type: 'image/png' })
  await assert.rejects(() => uploadCloudinaryImage(oversized, env, 'rent/payment-proofs'), /不能超过 5MB/)
})

test('Cloudinary upload ignores an empty optional file field', async () => {
  assert.deepEqual(await uploadCloudinaryImages(new File([], '', { type: '' }), env, 'rent/damage-photos'), [])
})
