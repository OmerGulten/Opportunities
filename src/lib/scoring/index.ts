export { RULE_OPERATORS, isRuleOperator, coerceNumber, coerceBoolean, looseEquals, evaluateOperator } from "./operators";
export { EVALUABLE_STATUSES, isEvaluableSignal, indexSignalsByType } from "./signal-index";
export { toJsonValue, toJsonArray } from "./json";
export { DIGITAL_GAP_ORDER, deriveDigitalGaps } from "./gaps";
export { DEFAULT_SECONDARY_THRESHOLD, scoreBusiness, scoreService, serviceConfidence } from "./engine";
export {
  ruleFromRow,
  serviceFromRow,
  signalFromRow,
  signalToRow,
  toOpportunityScoreRows,
  toOpportunityRow,
  type OpportunitySignalInsert,
  type OpportunityScoreInsert,
  type OpportunityInsert,
  type SignalRowIds,
  type OpportunityScoreRowIds,
  type OpportunityRowIds,
} from "./mappers";
export { explainServiceScore, summarizeOpportunity, type ServiceScoreExplanation } from "./explain";
export {
  DEFAULT_SERVICES,
  DEFAULT_RULES,
  DEFAULT_RULES_VERSION,
  loadDefaultRules,
  defaultServiceId,
  defaultRuleId,
  type DefaultServiceSeed,
  type DefaultRuleSeed,
} from "./defaults";
