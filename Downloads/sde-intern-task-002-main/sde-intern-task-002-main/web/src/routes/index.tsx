import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: Index,
})

interface Member {
  id: string
  name: string
}

interface Share {
  id: string
  memberId: string
  amountCents: number
  paidAt: string | null
}

interface Bill {
  id: string
  title: string
  totalCents: number
  shares: Share[]
}

interface Balance {
  memberId: string
  name: string
  outstandingCents: number
}

interface Home {
  id: string
  name: string
}

function Index() {
  const [homeName, setHomeName] = useState('')
  const [home, setHome] = useState<Home | null>(null)
  const [memberName, setMemberName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [billTitle, setBillTitle] = useState('')
  const [totalCents, setTotalCents] = useState('')
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])
  const [idempotencyKey, setIdempotencyKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchBalances = async (homeId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/homes/${homeId}/balances`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch balances')
      setBalances(data.balances)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch balances'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const createHome = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setError(null)
      const res = await fetch('/api/homes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: homeName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create home')
      setHome(data)
      setHomeName('')
      fetchBalances(data.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create home'
      setError(message)
    }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!home) return
    try {
      setError(null)
      const res = await fetch(`/api/homes/${home.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add member')
      setMembers([...members, { id: data.id, name: data.name }])
      setMemberName('')
      fetchBalances(home.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add member'
      setError(message)
    }
  }

  const createBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!home) return
    try {
      setError(null)
      const res = await fetch(`/api/homes/${home.id}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: billTitle, totalCents: parseInt(totalCents, 10) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create bill')
      setBills([...bills, data])
      setBillTitle('')
      setTotalCents('')
      fetchBalances(home.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create bill'
      setError(message)
    }
  }

  const payShare = async (billId: string, shareId: string) => {
    try {
      setError(null)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey
      }
      const res = await fetch(`/api/bills/${billId}/shares/${shareId}/pay`, {
        method: 'POST',
        headers,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')

      setBills(
        bills.map((b) => {
          if (b.id !== billId) return b
          return {
            ...b,
            shares: b.shares.map((s) => (s.id === shareId ? { ...s, paidAt: data.paidAt } : s)),
          }
        }),
      )
      if (home) fetchBalances(home.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      setError(message)
    }
  }

  return (
    <div
      style={{
        maxWidth: '800px',
        margin: '0 auto',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h1>Shared Bill Splitter</h1>

      {error && (
        <div
          style={{
            background: '#ffe6e6',
            color: '#cc0000',
            padding: '10px',
            marginBottom: '15px',
            borderRadius: '4px',
          }}
        >
          Error: {error}
        </div>
      )}
      {loading && <div style={{ color: '#0066cc', marginBottom: '15px' }}>Loading...</div>}

      {!home ? (
        <form
          onSubmit={createHome}
          style={{
            marginBottom: '20px',
            background: '#f9f9f9',
            padding: '15px',
            borderRadius: '5px',
          }}
        >
          <h3>1. Create Home</h3>
          <input
            type="text"
            placeholder="Home Name (e.g. Flat 402)"
            value={homeName}
            onChange={(e) => setHomeName(e.target.value)}
            required
            style={{ padding: '8px', marginRight: '10px', width: '250px' }}
          />
          <button type="submit" style={{ padding: '8px 15px' }}>
            Create Home
          </button>
        </form>
      ) : (
        <div>
          <h2>Home: {home.name}</h2>

          <form
            onSubmit={addMember}
            style={{
              marginBottom: '20px',
              background: '#f9f9f9',
              padding: '15px',
              borderRadius: '5px',
            }}
          >
            <h3>2. Add Member</h3>
            <input
              type="text"
              placeholder="Member Name"
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              required
              style={{ padding: '8px', marginRight: '10px', width: '250px' }}
            />
            <button type="submit" style={{ padding: '8px 15px' }}>
              Add Member
            </button>
          </form>

          <div style={{ marginBottom: '20px' }}>
            <h4>Members List:</h4>
            {members.length === 0 ? (
              <p>No members added yet.</p>
            ) : (
              <ul>
                {members.map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
            )}
          </div>

          <form
            onSubmit={createBill}
            style={{
              marginBottom: '20px',
              background: '#f9f9f9',
              padding: '15px',
              borderRadius: '5px',
            }}
          >
            <h3>3. Add Bill (Total Cents, e.g. 1000 = $10)</h3>
            <div style={{ marginBottom: '10px' }}>
              <input
                type="text"
                placeholder="Bill Title (e.g. Groceries)"
                value={billTitle}
                onChange={(e) => setBillTitle(e.target.value)}
                required
                style={{ padding: '8px', marginRight: '10px', width: '250px' }}
              />
              <input
                type="number"
                placeholder="Total Cents"
                value={totalCents}
                onChange={(e) => setTotalCents(e.target.value)}
                required
                style={{ padding: '8px', marginRight: '10px', width: '150px' }}
              />
              <button type="submit" style={{ padding: '8px 15px' }}>
                Create Bill
              </button>
            </div>
          </form>

          <div style={{ marginBottom: '20px' }}>
            <h3>Bills & Shares</h3>
            {bills.length === 0 ? (
              <p>No bills created yet.</p>
            ) : (
              bills.map((bill) => (
                <div
                  key={bill.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #ddd',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                  }}
                >
                  <h4>
                    {bill.title} (Total: {bill.totalCents} cents)
                  </h4>
                  <ul>
                    {bill.shares.map((share) => {
                      const member = members.find((m) => m.id === share.memberId)
                      return (
                        <li key={share.id} style={{ marginBottom: '5px' }}>
                          {member ? member.name : 'Unknown'}: {share.amountCents} cents{' '}
                          {share.paidAt ? (
                            <span style={{ color: 'green', marginLeft: '10px' }}>
                              [Paid at {new Date(share.paidAt).toLocaleTimeString()}]
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => payShare(bill.id, share.id)}
                              style={{
                                marginLeft: '10px',
                                padding: '3px 8px',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer',
                              }}
                            >
                              Pay Share
                            </button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>Balances</h3>
            {balances.length === 0 ? (
              <p>No balances to display.</p>
            ) : (
              <ul>
                {balances.map((b) => (
                  <li key={b.memberId}>
                    {b.name}: {b.outstandingCents} cents outstanding
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div
            style={{ marginTop: '20px', background: '#eee', padding: '10px', borderRadius: '5px' }}
          >
            <label htmlFor="idempotencyKeyInput">Idempotency Key for Payments: </label>
            <input
              id="idempotencyKeyInput"
              type="text"
              placeholder="Optional unique key"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              style={{ padding: '6px', marginLeft: '10px', width: '200px' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
