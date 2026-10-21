export const FINANCING_ANNUAL_INCOME_INPUT = {
  min: 1,
  step: 1,
} as const

/**
 * Native required/number/checkbox validity controls eligibility. Calculator
 * values are optional context and must never disable an otherwise valid
 * financing application; only an in-flight submission disables the button.
 */
export function isFinancingSubmitDisabled(isApplying: boolean) {
  return isApplying
}
