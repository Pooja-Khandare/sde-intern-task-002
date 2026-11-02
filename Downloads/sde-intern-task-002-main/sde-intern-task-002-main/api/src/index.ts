import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.get('/api/health', (c) => {
  return c.json({ status: 'ok' })
})

// 1. Create a home
app.post('/api/homes', async (c) => {
  try {
    const body = await c.req.json<{ name?: string }>()
    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ error: 'Invalid name' }, 422)
    }
    const id = crypto.randomUUID()
    const name = body.name.trim()
    await c.env.DB.prepare('INSERT INTO homes (id, name) VALUES (?, ?)').bind(id, name).run()
    return c.json({ id, name }, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return c.json({ error: message }, 500)
  }
})

// 2. Add members to a home
app.post('/api/homes/:homeId/members', async (c) => {
  try {
    const homeId = c.req.param('homeId')
    const body = await c.req.json<{ name?: string }>()

    const home = await c.env.DB.prepare('SELECT * FROM homes WHERE id = ?').bind(homeId).first()
    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    if (!body || typeof body.name !== 'string' || !body.name.trim()) {
      return c.json({ error: 'Invalid name' }, 422)
    }

    const id = crypto.randomUUID()
    const name = body.name.trim()
    await c.env.DB.prepare('INSERT INTO members (id, home_id, name) VALUES (?, ?, ?)')
      .bind(id, homeId, name)
      .run()
    return c.json({ id, homeId, name }, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return c.json({ error: message }, 500)
  }
})

// 3. Create a bill and split shares
app.post('/api/homes/:homeId/bills', async (c) => {
  try {
    const homeId = c.req.param('homeId')
    const body = await c.req.json<{ title?: string; totalCents?: number }>()

    const home = await c.env.DB.prepare('SELECT * FROM homes WHERE id = ?').bind(homeId).first()
    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const totalCents = body?.totalCents
    const title = body?.title

    if (
      !title ||
      typeof totalCents !== 'number' ||
      !Number.isInteger(totalCents) ||
      totalCents <= 0
    ) {
      return c.json({ error: 'Invalid title or totalCents' }, 422)
    }

    const membersResult = await c.env.DB.prepare(
      'SELECT id FROM members WHERE home_id = ? ORDER BY created_at ASC',
    )
      .bind(homeId)
      .all()
    const members = membersResult.results as { id: string }[]

    if (!members || members.length === 0) {
      return c.json({ error: 'Home has no members' }, 422)
    }

    const billId = crypto.randomUUID()
    await c.env.DB.prepare(
      'INSERT INTO bills (id, home_id, title, total_cents) VALUES (?, ?, ?, ?)',
    )
      .bind(billId, homeId, title, totalCents)
      .run()

    const count = members.length
    const baseShare = Math.floor(totalCents / count)
    const remainder = totalCents % count

    const shares: Array<{
      id: string
      memberId: string
      amountCents: number
      paidAt: string | null
    }> = []

    for (let i = 0; i < count; i++) {
      const shareId = crypto.randomUUID()
      const amountCents = baseShare + (i < remainder ? 1 : 0)
      const member = members[i]

      if (!member) continue

      await c.env.DB.prepare(
        'INSERT INTO shares (id, bill_id, member_id, amount_cents) VALUES (?, ?, ?, ?)',
      )
        .bind(shareId, billId, member.id, amountCents)
        .run()

      shares.push({
        id: shareId,
        memberId: member.id,
        amountCents,
        paidAt: null,
      })
    }

    return c.json(
      {
        id: billId,
        homeId,
        title,
        totalCents,
        shares,
      },
      201,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return c.json({ error: message }, 500)
  }
})

// 4. Pay a share
app.post('/api/bills/:billId/shares/:shareId/pay', async (c) => {
  try {
    const billId = c.req.param('billId')
    const shareId = c.req.param('shareId')
    const idempotencyKey = c.req.header('Idempotency-Key')

    if (!idempotencyKey) {
      return c.json({ error: 'Idempotency-Key missing' }, 400)
    }

    const share = (await c.env.DB.prepare('SELECT * FROM shares WHERE id = ? AND bill_id = ?')
      .bind(shareId, billId)
      .first()) as {
      id: string
      bill_id: string
      member_id: string
      amount_cents: number
      paid_at: string | null
      idempotency_key: string | null
    } | null

    if (!share) {
      return c.json({ error: 'Bill or share not found' }, 404)
    }

    if (share.paid_at !== null) {
      if (share.idempotency_key === idempotencyKey) {
        return c.json(
          {
            id: share.id,
            memberId: share.member_id,
            amountCents: share.amount_cents,
            paidAt: share.paid_at,
          },
          200,
        )
      } else {
        return c.json({ error: 'Share already paid with a different key' }, 409)
      }
    }

    const paidAt = new Date().toISOString()

    const updateResult = (await c.env.DB.prepare(
      'UPDATE shares SET paid_at = ?, idempotency_key = ? WHERE id = ? AND paid_at IS NULL',
    )
      .bind(paidAt, idempotencyKey, shareId)
      .run()) as { meta: { changes: number } }

    if (updateResult.meta.changes === 0) {
      const updatedShare = (await c.env.DB.prepare('SELECT * FROM shares WHERE id = ?')
        .bind(shareId)
        .first()) as {
        id: string
        member_id: string
        amount_cents: number
        paid_at: string | null
        idempotency_key: string | null
      } | null

      if (updatedShare?.idempotency_key === idempotencyKey) {
        return c.json(
          {
            id: updatedShare.id,
            memberId: updatedShare.member_id,
            amountCents: updatedShare.amount_cents,
            paidAt: updatedShare.paid_at,
          },
          200,
        )
      }
      return c.json({ error: 'Share already paid with a different key' }, 409)
    }

    return c.json(
      {
        id: share.id,
        memberId: share.member_id,
        amountCents: share.amount_cents,
        paidAt,
      },
      200,
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return c.json({ error: message }, 500)
  }
})

// 5. Get balances
app.get('/api/homes/:homeId/balances', async (c) => {
  try {
    const homeId = c.req.param('homeId')

    const home = await c.env.DB.prepare('SELECT * FROM homes WHERE id = ?').bind(homeId).first()
    if (!home) {
      return c.json({ error: 'Home not found' }, 404)
    }

    const membersResult = await c.env.DB.prepare(
      'SELECT id, name FROM members WHERE home_id = ? ORDER BY created_at ASC',
    )
      .bind(homeId)
      .all()
    const members = membersResult.results as { id: string; name: string }[]

    const balances = []
    for (const member of members) {
      const unpaidResult = await c.env.DB.prepare(`
        SELECT SUM(s.amount_cents) as total 
        FROM shares s 
        JOIN bills b ON s.bill_id = b.id 
        WHERE b.home_id = ? AND s.member_id = ? AND s.paid_at IS NULL
      `)
        .bind(homeId, member.id)
        .first()

      const outstandingCents = (unpaidResult?.total as number) || 0
      balances.push({
        memberId: member.id,
        name: member.name,
        outstandingCents,
      })
    }

    return c.json({ balances }, 200)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return c.json({ error: message }, 500)
  }
})

export default app
