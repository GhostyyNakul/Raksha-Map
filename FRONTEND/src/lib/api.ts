import { getIdToken } from './firebase'
import type { AdminSummary, Contribution, DashboardData } from '../types'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

async function request<T>(path: string, init: RequestInit = {}) {
  const token = await getIdToken()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const res = await fetch(`${API}${path}`, { ...init, headers })
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload.error || `Request failed (${res.status})`)
  return payload as T
}

export async function fetchDashboard() { return request<DashboardData>('/api/dashboard') }
export async function fetchApprovedSites() { return request<import('../types').ReliefSite[]>('/api/approved-sites') }
export async function fetchContributionHistory() { return request<Contribution[]>('/api/contributions/mine') }
export async function submitContribution(payload: Omit<Contribution, 'id' | 'userId' | 'userName' | 'status' | 'createdAt'>) {
  return request<{ id: string; status: 'pending' }>('/api/contributions', { method: 'POST', body: JSON.stringify(payload) })
}
export async function fetchAdminSummary() { return request<AdminSummary>('/api/admin/summary') }
export async function fetchAdminContributions(status = 'pending') { return request<Contribution[]>(`/api/admin/contributions?status=${encodeURIComponent(status)}`) }
export async function moderateContribution(id: string, status: 'approved' | 'rejected', moderationNote: string) {
  return request<{ ok: true }>(`/api/admin/contributions/${encodeURIComponent(id)}/status`, {
    method: 'POST', body: JSON.stringify({ status, moderationNote }),
  })
}
export async function fetchHealth() { return request<{ ok: boolean; sources: unknown[] }>('/api/health') }
