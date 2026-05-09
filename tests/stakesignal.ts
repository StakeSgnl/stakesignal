import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { assert } from 'chai'

describe('stakesignal', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  it('initializes factory', async () => {
    // TODO: initialize factory with accepted LST mints
    assert.ok(true)
  })

  it('creates a market', async () => {
    // TODO: create prediction market with Pyth resolution
    assert.ok(true)
  })

  it('places a position', async () => {
    // TODO: deposit LST, take YES/NO side
    assert.ok(true)
  })
})
