import { randomUUID } from 'node:crypto';
export const Roles = Object.freeze({ REQUESTER: 'requester', CONTROL_ANALYST: 'control_analyst', REINSTATEMENT_AUTHORITY: 'reinstatement_authority', ACCESS_ADMINISTRATOR: 'access_administrator', ASSURANCE_REVIEWER: 'assurance_reviewer' });
export const Statuses = Object.freeze({ REQUESTED: 'requested', ASSESSED: 'assessed', APPROVED: 'approved', REINSTATED: 'reinstated', CLOSED: 'closed' });
export class DomainError extends Error { constructor(message, code = 'DOMAIN_RULE', statusCode = 422) { super(message); this.name = 'DomainError'; this.code = code; this.statusCode = statusCode; } }
const text = (value, label) => { if (typeof value !== 'string' || !value.trim()) throw new DomainError(`${label} is required.`, 'VALIDATION_ERROR', 400); return value.trim(); };
export class ReinstatementGovernanceService {
  constructor({ cases = [], persist = async () => {}, now = () => new Date().toISOString() } = {}) { this.cases = structuredClone(cases); this.persist = persist; this.now = now; }
  list() { return structuredClone(this.cases); }
  get(id) { return structuredClone(this.#find(id)); }
  async request(actor, input) { this.#role(actor, Roles.REQUESTER); const item = { id: randomUUID(), supplier: text(input.supplier, 'supplier'), subjectId: text(input.subjectId, 'subjectId'), businessJustification: text(input.businessJustification, 'businessJustification'), status: Statuses.REQUESTED, audit: [this.#event('reinstatement_requested', actor, {})] }; this.cases.push(item); await this.persist({ cases: this.cases }); return this.get(item.id); }
  async assess(id, actor, input) { this.#role(actor, Roles.CONTROL_ANALYST); return this.#advance(id, Statuses.REQUESTED, Statuses.ASSESSED, 'controls_assessed', actor, { assessmentReference: text(input.assessmentReference, 'assessmentReference') }); }
  async approve(id, actor, input) { this.#role(actor, Roles.REINSTATEMENT_AUTHORITY); return this.#advance(id, Statuses.ASSESSED, Statuses.APPROVED, 'reinstatement_approved', actor, { approvalReference: text(input.approvalReference, 'approvalReference') }); }
  async reinstate(id, actor, input) { this.#role(actor, Roles.ACCESS_ADMINISTRATOR); return this.#advance(id, Statuses.APPROVED, Statuses.REINSTATED, 'access_reinstated', actor, { executionReference: text(input.executionReference, 'executionReference') }); }
  async close(id, actor, input) { this.#role(actor, Roles.ASSURANCE_REVIEWER); return this.#advance(id, Statuses.REINSTATED, Statuses.CLOSED, 'reinstatement_closed', actor, { outcome: text(input.outcome, 'outcome') }); }
  #find(id) { const item = this.cases.find((candidate) => candidate.id === id); if (!item) throw new DomainError('Reinstatement case was not found.', 'NOT_FOUND', 404); return item; }
  #role(actor, role) { if (!actor?.id || actor.role !== role) throw new DomainError(`Only ${role} may perform this action.`, 'FORBIDDEN', 403); }
  async #advance(id, from, to, type, actor, detail) { const item = this.#find(id); if (item.status !== from) throw new DomainError(`Case must be ${from} before this action.`, 'INVALID_STATE'); item.status = to; item.audit.push(this.#event(type, actor, detail)); await this.persist({ cases: this.cases }); return this.get(item.id); }
  #event(type, actor, detail) { return { id: randomUUID(), type, actorId: actor.id, actorRole: actor.role, occurredAt: this.now(), detail }; }
}
