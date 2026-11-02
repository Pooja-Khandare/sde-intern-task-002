import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/')({
  component: Home,
})

interface HomeType {
  id: string
  name: string
}

interface Member {
  id: string
  homeId: string
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
  homeId: string
  title: string
  totalCents: number
  shares: Share[]
}

interface Balance {
  memberId: string
  name: string
  outstandingCents: number
}

function Home() {
  const [homeName, setHomeName] = useState('')
  const [home, setHome] = useState<HomeType | null>(null)
  const [memberName, setMemberName] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  
  const [billTitle, setBillTitle] = useState('')
  const [totalCents, setTotalCents] = useState('')
  const [bills, setBills] = useState<Bill[]>([])
  const [balances, setBalances] = useState<Balance[]>([])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState('key-123')

  const createHome = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!home) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/homes/${home.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: memberName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add member')
      setMembers([...members, data])
      setMemberName('')
      fetchBalances(home.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createBill = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!home) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/homes/${home.id}/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: billTitle, totalCents: Number(totalCents) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create bill')
      setBills([data, ...bills])
      setBillTitle('')
      setTotalCents('')
      fetchBalances(home.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const payShare = async (billId: string, shareId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/bills/${billId}/shares/${shareId}/pay`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Payment failed')
      
      setBills(bills.map(b => {
        if (b.id !== billId) return b
        return {
          ...b,
          shares: b.shares.map(s => s.id === shareId ? { ...s, paidAt: data.paidAt } : s)
        }
      }))
      if (home) fetchBalances(home.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchBalances = async (homeId: string) => {
    try {
      const res = await fetch(`/api/homes/${homeId}/balances`)
      const data = await res.json()
      if (res.ok) setBalances(data.balances)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Shared Bill Splitter</h1>

      {error && <div style={{ background: '#ffe6e6', color: '#cc0000', padding: '10px', marginBottom: '15px', borderRadius: '4px' }}>Error: {error}</div>}
      {loading && <div style={{ color: '#0066cc', marginBottom: '15px' }}>Loading...</div>}

      {!home ? (
        <form onSubmit={createHome} style={{ marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
          <h3>1. Create Home</h3>
          <input 
            type="text" 
            placeholder="Home Name (e.g. Flat 402)" 
            value={homeName} 
            onChange={(e) => setHomeName(e.target.value)} 
            required
            style={{ padding: '8px', marginRight: '10px', width: '250px' }}
          />
          <button type="submit" style={{ padding: '8px 15px' }}>Create Home</button>
        </form>
      ) : (
        <div>
          <h2>Home: {home.name}</h2>

          <form onSubmit={addMember} style={{ marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
            <h3>2. Add Member</h3>
            <input 
              type="text" 
              placeholder="Member Name" 
              value={memberName} 
              onChange={(e) => setMemberName(e.target.value)} 
              required
              style={{ padding: '8px', marginRight: '10px', width: '250px' }}
            />
            <button type="submit" style={{ padding: '8px 15px' }}>Add Member</button>
          </form>

          <div style={{ marginBottom: '20px' }}>
            <h4>Members List:</h4>
            {members.length === 0 ? <p>No members added yet.</p> : (
              <ul>
                {members.map(m => <li key={m.id}>{m.name}</li>)}
              </ul>
            )}
          </div>

          <form onSubmit={createBill} style={{ marginBottom: '20px', background: '#f9f9f9', padding: '15px', borderRadius: '5px' }}>
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
            </div>
            <div style={{ marginBottom: '10px' }}>
              <input 
                type="number" 
                placeholder="Total Cents" 
                value={totalCents} 
                onChange={(e) => setTotalCents(e.target.value)} 
                required
                style={{ padding: '8px', marginRight: '10px', width: '250px' }}
              />
            </div>
            <button type="submit" style={{ padding: '8px 15px' }}>Create & Split Bill</button>
          </form>

          <div style={{ marginBottom: '20px' }}>
            <h3>Balances</h3>
            <ul>
              {balances.map(b => (
                <li key={b.memberId}>
                  {b.name}: <b>{b.outstandingCents} cents</b> outstanding
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3>Bills & Shares</h3>
            {bills.length === 0 ? <p>No bills added yet.</p> : (
              bills.map(bill => (
                <div key={bill.id} style={{ border: '1px solid #ddd', padding: '15px', marginBottom: '10px', borderRadius: '5px' }}>
                  <h4>{bill.title} — Total: {bill.totalCents} cents</h4>
                  <ul>
                    {bill.shares.map(share => {
                      const member = members.find(m => m.id === share.memberId)
                      return (
                        <li key={share.id} style={{ margin: '5px 0' }}>
                          {member ? member.name : 'Member'}: {share.amountCents} cents 
                          {share.paidAt ? (
                            <span style={{ color: 'green', marginLeft: '10px' }}>[Paid at {new Date(share.paidAt).toLocaleTimeString()}]</span>
                          ) : (
                            <button 
                              onClick={() => payShare(bill.id, share.id)} 
                              style={{ marginLeft: '10px', padding: '3px 8px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
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

          <div style={{ marginTop: '20px', background: '#eee', padding: '10px', borderRadius: '5px' }}>
            <label>Idempotency Key for Payments: </label>
            <input 
              type="text" 
              value={idempotencyKey} 
              onChange={(e) => setIdempotencyKey(e.target.value)} 
              style={{ padding: '5px', marginLeft: '10px' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}