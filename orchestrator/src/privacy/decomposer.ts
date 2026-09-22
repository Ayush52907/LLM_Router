/**
 * Outline-only Task Decomposer (PRD Addendum A).
 *
 * Invariant 2: Cloud services never see raw PII.
 * The decomposer sees ONLY:
 *   1. The user instruction
 *   2. The document outline (headings, section count, approximate token count)
 * It NEVER receives the document body.
 * Subtask descriptions are therefore PII-free by construction.
 */

import { v4 as uuidv4 } from 'uuid';
import type { Subtask, SubtaskType, ComplexityTier, DataSensitivity, PiiClass } from '../registry/types.js';

export interface DocumentOutline {
  title: string;
  sections: Array<{ number: string; heading: string }>;
  approximateTokenCount: number;
}

export function extractDocumentOutline(markdownText: string): DocumentOutline {
  const lines = markdownText.split('\n');
  let title = 'Document';
  const sections: Array<{ number: string; heading: string }> = [];

  for (const line of lines) {
    if (line.startsWith('# ') && title === 'Document') {
      title = line.replace('# ', '').trim();
    } else if (line.startsWith('## ')) {
      const heading = line.replace('## ', '').trim();
      const match = heading.match(/^(\d+[\.\d]*)\s*(.*)/);
      if (match && match[1] && match[2]) {
        sections.push({ number: match[1], heading: match[2] });
      } else {
        sections.push({ number: `${sections.length + 1}`, heading });
      }
    }
  }

  const approximateTokenCount = Math.round(markdownText.length / 4);

  return { title, sections, approximateTokenCount };
}

export function decomposeContractTask(
  taskId: string,
  userInstruction: string,
  outline: DocumentOutline
): Subtask[] {
  const now = Date.now();

  // Subtask 1: Extract parties and dates (RAW PII - MUST STAY LOCAL)
  const st1Id = uuidv4();
  const st1: Subtask = {
    id: st1Id,
    task_id: taskId,
    description: `Extract contracting parties, effective dates, and contact entities from ${outline.title}`,
    prompt: `Extract provider and customer legal names, addresses, contacts, and key dates from Section 1 & 2.`,
    output: null,
    type: 'extraction',
    depends_on: [],
    input_from: [],
    urgency: 'normal',
    data_sensitivity: 'pii',
    pii_class: 'raw_pii', // FORCED LOCAL
    redacted_prompt: null,
    complexity_tier: 'low',
    status: 'queued',
    subtask_budget_allowance_usd: 0.05,
    routed_model: null,
    routed_location: null,
    jev_confidence: null,
    predicted_latency_ms: null,
    predicted_cost_usd: null,
    predicted_energy_kwh: null,
    predicted_carbon_kgco2eq: null,
    predicted_output_tokens: 150,
    actual_latency_ms: null,
    actual_cost_usd: null,
    actual_energy_kwh: null,
    actual_carbon_kgco2eq: null,
    actual_input_tokens: null,
    actual_output_tokens: null,
    verification_pass: null,
    verification_probability: null,
    escalation_count: 0,
    embedding: null,
    created_at: now,
    completed_at: null,
  };

  // Subtask 2: Classify clauses (REDACTED OK - TRIVIAL)
  const st2Id = uuidv4();
  const st2: Subtask = {
    id: st2Id,
    task_id: taskId,
    description: `Classify ${outline.sections.length} contract clauses into standard legal categories`,
    prompt: `Classify the following contract sections into standard taxonomy: ${outline.sections.map(s => s.heading).join(', ')}`,
    output: null,
    type: 'classification',
    depends_on: [],
    input_from: [],
    urgency: 'normal',
    data_sensitivity: 'internal',
    pii_class: 'redacted_ok',
    redacted_prompt: null,
    complexity_tier: 'trivial',
    status: 'queued',
    subtask_budget_allowance_usd: 0.02,
    routed_model: null,
    routed_location: null,
    jev_confidence: null,
    predicted_latency_ms: null,
    predicted_cost_usd: null,
    predicted_energy_kwh: null,
    predicted_carbon_kgco2eq: null,
    predicted_output_tokens: 50,
    actual_latency_ms: null,
    actual_cost_usd: null,
    actual_energy_kwh: null,
    actual_carbon_kgco2eq: null,
    actual_input_tokens: null,
    actual_output_tokens: null,
    verification_pass: null,
    verification_probability: null,
    escalation_count: 0,
    embedding: null,
    created_at: now,
    completed_at: null,
  };

  // Subtask 3: Flag risky clauses (REDACTED OK - HIGH COMPLEXITY)
  const st3Id = uuidv4();
  const st3: Subtask = {
    id: st3Id,
    task_id: taskId,
    description: `Identify and flag high-risk legal clauses (uncapped indemnity, asymmetric liability, IP loss)`,
    prompt: `Analyze the contract text for unilateral risks, uncapped liabilities, or unfair terms.`,
    output: null,
    type: 'extraction',
    depends_on: [st2Id],
    input_from: [st2Id],
    urgency: 'normal',
    data_sensitivity: 'internal',
    pii_class: 'redacted_ok',
    redacted_prompt: null,
    complexity_tier: 'high', // Floor forces strong model
    status: 'queued',
    subtask_budget_allowance_usd: 0.15,
    routed_model: null,
    routed_location: null,
    jev_confidence: null,
    predicted_latency_ms: null,
    predicted_cost_usd: null,
    predicted_energy_kwh: null,
    predicted_carbon_kgco2eq: null,
    predicted_output_tokens: 300,
    actual_latency_ms: null,
    actual_cost_usd: null,
    actual_energy_kwh: null,
    actual_carbon_kgco2eq: null,
    actual_input_tokens: null,
    actual_output_tokens: null,
    verification_pass: null,
    verification_probability: null,
    escalation_count: 0,
    embedding: null,
    created_at: now,
    completed_at: null,
  };

  // Subtask 4: Summarize obligations (REDACTED OK - MEDIUM)
  const st4Id = uuidv4();
  const st4: Subtask = {
    id: st4Id,
    task_id: taskId,
    description: `Summarize key operational and payment obligations across contract parties`,
    prompt: `Provide a bulleted executive summary of active obligations for both parties.`,
    output: null,
    type: 'summarization',
    depends_on: [st2Id],
    input_from: [st2Id],
    urgency: 'normal',
    data_sensitivity: 'internal',
    pii_class: 'redacted_ok',
    redacted_prompt: null,
    complexity_tier: 'medium',
    status: 'queued',
    subtask_budget_allowance_usd: 0.08,
    routed_model: null,
    routed_location: null,
    jev_confidence: null,
    predicted_latency_ms: null,
    predicted_cost_usd: null,
    predicted_energy_kwh: null,
    predicted_carbon_kgco2eq: null,
    predicted_output_tokens: 400,
    actual_latency_ms: null,
    actual_cost_usd: null,
    actual_energy_kwh: null,
    actual_carbon_kgco2eq: null,
    actual_input_tokens: null,
    actual_output_tokens: null,
    verification_pass: null,
    verification_probability: null,
    escalation_count: 0,
    embedding: null,
    created_at: now,
    completed_at: null,
  };

  // Subtask 5: Draft reply email (REDACTED OK WITH PLACEHOLDERS - MEDIUM)
  const st5Id = uuidv4();
  const st5: Subtask = {
    id: st5Id,
    task_id: taskId,
    description: `Draft formal negotiation reply email citing flagged risky clauses using placeholders`,
    prompt: `Draft a formal negotiation email to [PARTY_1] proposing amendments to flagged risky clauses.`,
    output: null,
    type: 'generation',
    depends_on: [st1Id, st3Id, st4Id],
    input_from: [st3Id, st4Id],
    urgency: 'normal',
    data_sensitivity: 'internal',
    pii_class: 'redacted_ok',
    redacted_prompt: null,
    complexity_tier: 'medium',
    status: 'queued',
    subtask_budget_allowance_usd: 0.10,
    routed_model: null,
    routed_location: null,
    jev_confidence: null,
    predicted_latency_ms: null,
    predicted_cost_usd: null,
    predicted_energy_kwh: null,
    predicted_carbon_kgco2eq: null,
    predicted_output_tokens: 600,
    actual_latency_ms: null,
    actual_cost_usd: null,
    actual_energy_kwh: null,
    actual_carbon_kgco2eq: null,
    actual_input_tokens: null,
    actual_output_tokens: null,
    verification_pass: null,
    verification_probability: null,
    escalation_count: 0,
    embedding: null,
    created_at: now,
    completed_at: null,
  };

  return [st1, st2, st3, st4, st5];
}
